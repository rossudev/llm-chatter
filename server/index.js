import express from "express";
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import axios from "axios";
import cors from "cors";
import bodyParser from "body-parser";
import path from 'path';
import fs from 'fs';
import stripAnsi from 'strip-ansi';
import chalk from 'chalk';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import "@tensorflow/tfjs-node";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RetrievalQAChain } from "langchain/chains";
import { TensorFlowEmbeddings } from "langchain/embeddings/tensorflow";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { Ollama } from "langchain/llms/ollama";
import OpenAI from 'openai';
import { RealtimeRelay } from './relay.js';



//.env file containing the API keys
dotenv.config({ path: path.join(process.cwd(), '.env') });



//Realtime Relay
const relay = new RealtimeRelay(process.env['OPENAI_API_KEY']);
relay.listen(8081);



//Express server to handle client requests
const app = express();
const port = 8080;

app.use(bodyParser.json());

//Configure allowed-to-connect domains here, for real deployment
app.use(cors());

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 2000, // limit each IP to 2000 requests per windowMs
  validate: {xForwardedForHeader: false},
});
app.use(limiter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});



// Function to get the current time as a string in 'HH:MM:SS' format
function getCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// Function to get the log file path, system local time
function getLogFilePath() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  return path.join(process.cwd(), `log-${dateStr}.txt`);
}

// Create a write stream for the log file
const logStream = fs.createWriteStream(getLogFilePath(), { flags: 'a' });

// Override console.log to write to the log file and console
const originalConsoleLog = console.log;
console.log = function (...args) {
  const message = args.join(' ');
  const timestamp = getCurrentTime(); // Use the current time
  // Write to the log file without ANSI codes
  const cleanMessage = stripAnsi(message);
  logStream.write(`[${timestamp}] ${cleanMessage}\n`);
  // Write to the console with ANSI codes
  originalConsoleLog.apply(console, [`[${timestamp}]`, ...args]);
};



//Heartbeat: Clients ping this /check URL every few seconds seconds
app.post('/check', async (req, res) => {
  res.send("ok");
}); 



// Function to authenticate passphrase
const verifyPassphrase = async (plainPassphrase, hashedPassphrase) => {
  const match = await bcrypt.compare(plainPassphrase, hashedPassphrase);
  return match;
};



// Function to generate a token
const generateToken = (userId) => {
  const token = jwt.sign({ userId }, process.env['LLM_SERVER_HASH'], { expiresIn: '1d' });
  return token;
};



const validateGetModels =[
  body('serverPassphrase').isString().trim(),
];

//Client check-in
app.post('/checkin', validateGetModels, async (req, res) => {
  const errors = validationResult(req);
  
  const clientIp = ( req.headers['x-forwarded-for'] || req.ip );
  const origin = req.headers.origin;

  if (!errors.isEmpty()) {
    console.log(errors);
    res.status(400).json({ error: 'Internal Server Error' });
  }

  const checkPass = await verifyPassphrase(req.body.serverPassphrase, process.env['LLM_CHATTER_PASSPHRASE']);
  if (!checkPass) { 
    console.log(chalk.cyan("\nWrong password." +
      "\nSource (Origin): " + origin +
      "\nConnector's Address (IP): " + clientIp + "\n"));
    return res.status(400).json({ error: 'Passphrase Failure' }); 
  }

  const token = generateToken(req.body.sessionHash);

  console.log(chalk.cyan("\nClient successfully checked in." +
  "\nSource (Origin): " + origin +
  "\nConnector's Address (IP): " + clientIp + "\n"));

  res.send(token);
});



const validateInput = [
  // Validation checks
  body('model').optional().isString().trim(),
  body('prompt').optional().isString().trim(),
  body('system').optional().isString().trim(),
  body('context').optional().isArray(),
  body('options.temperature').optional().isFloat({ min: 0, max: 1 }),
  body('options.top_p').optional().isFloat({ min: 0, max: 1 }),
  body('options.top_k').optional().isFloat({ min: 1, max: 20 }),
  body('temperature').optional().isFloat({ min: 0, max: 1 }),
  body('top_p').optional().isFloat({ min: 0, max: 1 }),
  body('top_k').optional().isFloat({ min: 1, max: 20 }),
  body('stream').optional().isBoolean(),
  body('keep_alive').optional().isInt({ min: 0 }),
  body('messages').optional().isArray(),

  // Middleware function to handle validation and token verification
  (req, res, next) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Internal Server Error' });
    }
    // Verify token
    let token;
    if (req.query.token) {
      token = req.query.token;
    } else {
      token = req.headers['authorization']?.split(' ')[1]; // Bearer token scheme
    }

    if (!token) {
      return res.status(401).send('Access Denied');
    }
    try {
      const verified = jwt.verify(token, process.env['LLM_SERVER_HASH']);
      req.user = verified; // Store user information in request
    } catch (err) {
      return res.status(400).send('Invalid Token');
    }
    // If both validation and token verification succeed, proceed
    next();
  }
];



//Client requests the list of local Ollama models
app.post('/getmodels', validateInput, async (req, res) => {
  const clientIp = ( req.headers['x-forwarded-for'] || req.ip );
  const origin = req.headers.origin;

  try {
    const response = await axios.get('http://localhost:11434/api/tags');

    console.log(chalk.cyan("\nSent model list.") +
    "\nSource (Origin): " + origin +
    "\nConnector's Address (IP): " + clientIp + "\n");

    res.send(response.data.models);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'GetModels Failure' });
  }
});



//Local Ollama API
app.post('/ollama', validateInput, async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors);
    res.status(400).json({ error: 'Internal Server Error' });
  }

  try {
    const theData = req.body;

    const response = await axios.post(
      "http://localhost:11434/api/generate",
      theData,
      { headers: { "Content-Type": "application/json" } },
    );

    res.send(response.data);

    const {
      xForwardedFor = req.ip,
    } = req.headers;
    console.log(`
    ${chalk.bgGreen.bold('\n////////////////////////////////////////')}
    ${chalk.underline('Remote IP:')} ${chalk.white(xForwardedFor)}
    ${chalk.blue.bold.underline('Model')}: ${chalk.blue(theData.model)}
    ${chalk.yellow.bold.underline('Temperature')}: ${chalk.yellow(theData.options.temperature)}
    ${chalk.red.bold.underline('Top-P')}: ${chalk.red(theData.options.top_p)}
    ${chalk.red.bold.underline('Top-K')}: ${chalk.red(theData.options.top_k)}
    ${chalk.magenta.bold.underline('System')}:
    ${chalk.magenta(theData.system)}
    ${chalk.cyan.bold.underline('Prompt')}:
    ${chalk.cyan(theData.prompt)}
    ${chalk.white.bold.underline('Response')}:
    ${chalk.bgBlack.white(response.data.response)}
    ${chalk.bgGreen.bold('////////////////////////////////////////\n')}
    `);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Ollama Failure' });
  }
});



app.post('/langchain', validateInput, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    res.status(400).json({ error: 'Internal Server Error' });
  }

  const theData = req.body;

  if (!theData) {
    console.log("LangChain failed");
    return res.status(400).send("Invalid request data.");
  }

  const requiredFields = ['model', 'input', 'langchainURL'];
  for (const field of requiredFields) {
    if (typeof theData[field] === 'undefined') {
      console.log(`${field} is undefined`);
      return res.status(400).send(`Missing required field: ${field}`);
    }
  }

  const ollama = new Ollama({
    baseUrl: "http://localhost:11434",
    model: theData.model,
    temperature: theData.temperature,
    topP: theData.topP,
    topK: theData.topK,
    keepAlive: "0"
  });

  const loader = new CheerioWebBaseLoader( theData.langchainURL );
  const data = await loader.load();
      
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 20
  });
  const splitDocs = await textSplitter.splitDocuments(data);
      
  const vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, new TensorFlowEmbeddings());

  const retriever = vectorStore.asRetriever();
  const chain = RetrievalQAChain.fromLLM(ollama, retriever);

  const result = await chain.call({query: theData.input});

  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  res.status(200).json(result);

  const {
    xForwardedFor = req.ip,
  } = req.headers;
  console.log(`
  ${chalk.bgGreen.bold('\n////////////////////////////////////////')}
  ${chalk.underline('Remote IP:')} ${chalk.white(xForwardedFor)}
  ${chalk.blue.bold.underline('Model')}: ${chalk.blue(theData.model)}
  ${chalk.yellow.bold.underline('Temperature')}: ${chalk.yellow(theData.temperature)}
  ${chalk.red.bold.underline('Top-P')}: ${chalk.red(theData.topP)}
  ${chalk.red.bold.underline('Top-K')}: ${chalk.red(theData.topK)}
  ${chalk.magenta.bold.underline('LangChain Embed')}:
  ${chalk.magenta(theData.langchainURL)}
  ${chalk.cyan.bold.underline('Prompt')}:
  ${chalk.cyan(theData.input)}
  ${chalk.white.bold.underline('Response')}:
  ${chalk.bgBlack.white(result.text)}
  ${chalk.bgGreen.bold('////////////////////////////////////////\n')}
  `);
});



//app.post('/anthropic', async (req, res) => {
app.post('/anthropic', validateInput, async (req, res) => {
  //Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    res.status(400).json({ error: 'Internal Server Error' });
  }

  try {
    const theData = req.body;
    const theMsgs = theData.messages;

    if (!theData.model || !theMsgs) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const anthropic = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });

    const msg = await anthropic.messages.create({
      model: theData.model,
      max_tokens: 1000,
      temperature: theData.temperature,
      top_p: theData.top_p,
      top_k: theData.top_k,
      system: theData.system,
      messages: theMsgs,
    });

    res.status(200).json(msg);

    const {
      xForwardedFor = req.ip,
    } = req.headers;
    console.log(`
    ${chalk.bgGreen.bold('\n////////////////////////////////////////')}
    ${chalk.underline('Remote IP:')} ${chalk.white(xForwardedFor)}
    ${chalk.blue.bold.underline('Model')}: ${chalk.blue(theData.model)}
    ${chalk.yellow.bold.underline('Temperature')}: ${chalk.yellow(theData.temperature)}
    ${chalk.red.bold.underline('Top-P')}: ${chalk.red(theData.top_p)}
    ${chalk.red.bold.underline('Top-K')}: ${chalk.red(theData.top_k)}
    ${chalk.magenta.bold.underline('System')}:
    ${chalk.magenta(theData.system)}
    ${chalk.cyan.bold.underline('Prompt')}:
    ${chalk.cyan(((theMsgs[theMsgs.length - 1])).content[0].text)}
    ${chalk.white.bold.underline('Response')}:
    ${chalk.bgBlack.white(msg.content[0].text)}
    ${chalk.bgGreen.bold('////////////////////////////////////////\n')}
    `);
  } catch (error) {
    console.error('Error:\n', error);
    res.status(500).json({ error: 'Anthropic Failure' });
  }
});



//OpenAI and Grok, Deepseek share the same SDK -- Grok and DeepSeek need to have baseUrl set
async function makeAIRequest(req, res, apiKeyEnvVar, baseUrl = null) {
  // Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    return res.status(400).json({ error: 'Internal Server Error' });
  }
  try {
    let { model, messages, temperature, top_p } = req.body;
    let system = messages[0] ? messages[0].content : "";

    // Validate required fields
    if (!model || !messages) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Check the model and alter messages if necessary
      if (model === "o3-mini" || model === "o1-mini" || model === "o1-preview") {
      // Filter out the object with role "system"
      //messages = messages.filter(message => message.role !== "system");
      temperature = 1;
      top_p = 1;
      system = "";
      messages = messages.filter(message => message.role !== "system");
    }
    // Set up client with the appropriate API key and optional base URL
    const client = new OpenAI({
      apiKey: process.env[apiKeyEnvVar],
      ...(baseUrl && { baseURL: baseUrl })
    });
    // Make the API call
    const response = await client.chat.completions.create({
      model,
      //max_tokens: 1000,
      //max_completion_tokens: 1000,
      temperature,
      top_p,
      messages,
    });
    res.status(200).json(response);

    const {
      xForwardedFor = req.ip,
    } = req.headers;
    const lastMessage = messages[messages.length - 1];
    const promptText = lastMessage && lastMessage.content[0].text ? lastMessage.content[0].text : 'N/A';
    const responseContent = response.choices?.[0]?.message?.content || 'No response content available';
    console.log(`
    ${chalk.bgGreen.bold('\n////////////////////////////////////////')}
    ${chalk.underline('Remote IP:')} ${chalk.white(xForwardedFor)}
    ${chalk.blue.bold.underline('Model')}: ${chalk.blue(model)}
    ${chalk.yellow.bold.underline('Temperature')}: ${chalk.yellow(temperature)}
    ${chalk.red.bold.underline('Top-P')}: ${chalk.red(top_p)}
    ${chalk.magenta.bold.underline('System')}:
    ${chalk.magenta(system)}
    ${chalk.cyan.bold.underline('Prompt')}:
    ${chalk.cyan(promptText)}
    ${chalk.white.bold.underline('Response')}:
    ${chalk.bgBlack.white(responseContent)}
    ${chalk.bgGreen.bold('////////////////////////////////////////\n')}
    `);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: `API Failure` }); // Generic error message
  }
}
app.post('/openai', validateInput, (req, res) => makeAIRequest(req, res, 'OPENAI_API_KEY'));
app.post('/grok', validateInput, (req, res) => makeAIRequest(req, res, 'GROK_API_KEY', "https://api.x.ai/v1"));
app.post('/deepseek', validateInput, (req, res) => makeAIRequest(req, res, 'DEEPSEEK_API_KEY', "https://api.deepseek.com"));




//Convert function needed here because the Google API handles messages differently than other models
const convertMessages = (messages) => {
  return messages.map(message => {
    // Change 'assistant' role to 'model' if applicable
    const newRole = message.role === 'assistant' ? 'model' : message.role;

    return {
      role: newRole,
      parts: message.content.map(contentItem => ({
        text: contentItem.text
      })),
    };
  });
};



app.post('/google', validateInput, async (req, res) => {
  //Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    res.status(400).json({ error: 'Internal Server Error' });
  }

  try {
    const theData = req.body;
    const theMsgs = theData.messages;

    if (!theData.model || !theMsgs) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const safetySettings = [
      {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ];

    const genAI = new GoogleGenerativeAI(process.env['GOOGLE_API_KEY']);
    const model = genAI.getGenerativeModel({ 
      model: theData.model,
      systemInstruction: theData.system,
      safetySettings: safetySettings
     });

    const generationConfig = {
      temperature: theData.temperature,
      topP: theData.top_p,
      topK: theData.top_k,
      maxOutputTokens: 1000,
    };

    const result = await model.generateContent({
      contents: convertMessages(theData.messages),
      generationConfig,
    });

    const response = result.response.text();

    res.status(200).json(response);

    const {
      xForwardedFor = req.ip,
    } = req.headers;
    console.log(`
    ${chalk.bgGreen.bold('\n////////////////////////////////////////')}
    ${chalk.underline('Remote IP:')} ${chalk.white(xForwardedFor)}
    ${chalk.blue.bold.underline('Model')}: ${chalk.blue(theData.model)}
    ${chalk.yellow.bold.underline('Temperature')}: ${chalk.yellow(theData.temperature)}
    ${chalk.red.bold.underline('Top-P')}: ${chalk.red(theData.top_p)}
    ${chalk.red.bold.underline('Top-K')}: ${chalk.red(theData.top_k)}
    ${chalk.magenta.bold.underline('System')}:
    ${chalk.magenta(theData.system)}
    ${chalk.cyan.bold.underline('Prompt')}:
    ${chalk.cyan(((theMsgs[theMsgs.length - 1])).content[0].text)}
    ${chalk.white.bold.underline('Response')}:
    ${chalk.bgBlack.white(response)}
    ${chalk.bgGreen.bold('////////////////////////////////////////\n')}
    `);
  } catch (error) {
    console.error('Error:', error);
    console.log(error);
    if (error.message.includes("overloaded")) {
      return res.status(503).json("The model is overloaded. Please try again later.\n");
    } else {
      return res.status(500).json({ error: 'An unexpected error occurred.' }); // More generic error message
    }
  }
});



//Express server
app.listen(port, () => {
  console.log(`\n\nServer running at http://localhost:${port}\n` + chalk.bgCyan.bold("////////////////////////////////////////\n"));
});