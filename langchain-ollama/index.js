import express from "express";
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import axios from "axios";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";
import path from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { execFile } from 'child_process';
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
const pyFilePath = "/home/opec/Documents/programming/python/whisper-medusa/whisper_medusa/go.py";



//.env file containing the API keys
dotenv.config({ path: path.join(process.cwd(), '.env') });



//Express server to handle client requests
const app = express();
const port = 8080;

app.use(bodyParser.json());
app.use(cors());

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 1400 // limit each IP to 1400 requests per windowMs
});
app.use(limiter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});



//Heartbeat: Clients ping this /check URL every second
app.post('/check', async (req, res) => {
  res.send("ok");
});



//Client requests the list of local Ollama models
app.post('/getmodels', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:11434/api/tags');

    console.log(chalk.cyan("Sent model list."))
    res.send(response.data.models);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'GetModels Failure' });
  }
});



const validateInput = [
  body('model').optional().isString().trim(),
  body('prompt').optional().isString().trim(),
  body('system').optional().isString().trim(),
  body('context').optional().isArray(),
  body('options.temperature').optional().isFloat({ min: 0, max: 1 }),
  body('options.top_p').optional().isFloat({ min: 0, max: 1 }),
  body('temperature').optional().isFloat({ min: 0, max: 1 }),
  body('top_p').optional().isFloat({ min: 0, max: 1 }),
  body('stream').optional().isBoolean(),
  body('keep_alive').optional().isInt({ min: 0 }),
  body('messages').optional().isArray(),
];



//Local Ollama API
app.post('/ollama', validateInput, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
    console.log(errors);
  }
  try {
    const theData = req.body;

    const response = await axios.post(
      "http://localhost:11434/api/generate",
      theData,
      { headers: { "Content-Type": "application/json" } },
    );

    res.send(response.data);

    console.log("\n" + chalk.bgGreen.bold("////////////////////////////////////////") + "\n");
    console.log(chalk.blue(chalk.underline.bold("Model") + ": ") + theData.model);
    console.log(chalk.yellow(chalk.underline.bold("Temperature") + ": ") + theData.options.temperature);
    console.log(chalk.red(chalk.underline.bold("Top-P") + ": ") + theData.options.top_p);
    console.log(chalk.magenta(chalk.underline.bold("System") + ":\n") + chalk.magenta(theData.system));
    console.log(chalk.cyan(chalk.underline.bold("Prompt") + ":\n") + chalk.cyan(theData.prompt) + "\n");
    console.log(chalk.white.underline.bold("Response") + ":\n" + chalk.bgBlack(response.data.response) + "\n");

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Ollama Failure' });
  }
});



//Whisper Medusa-supported voice-to-text
const upload = multer({ dest: 'uploads/' });
app.post('/whisper-medusa', upload.single('audio'), (req, res) => {
  // Check if file is uploaded
  if (!req.file) {
    return res.status(400).send({ error: 'No file uploaded. Please include an audio file for processing.' });
    console.log("No file.");
  }
  const acceptableMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/webm'];
  if (!acceptableMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).send({ error: 'Unsupported file type. Please upload an audio file in MP3, WAV, or WEBM format.' });
    console.log("Wrong filetype.");
  }
  // Proceed if file is valid
  const audioFilePath = req.file.path;
  execFile('/bin/bash', ['-c', `cp ${audioFilePath} ${audioFilePath}.webm; ffmpeg -i ${audioFilePath}.webm -ar 16000 ${audioFilePath}.wav; PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True conda run -n whisper-medusa python ${pyFilePath} "${audioFilePath}.wav"`], (error, stdout, stderr) => {
    if (error) {
      console.log(stderr);
      return res.status(500).send(stderr);
    }
    res.send(stdout);

    console.log("\n" + chalk.bgGreen.bold("////////////////////////////////////////") + "\n");
    console.log(chalk.blue("Whisper-Medusa:\n") + chalk.bgBlack(stdout));
  });
});



app.post('/langchain', validateInput, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
    console.log(errors);
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

  console.log("\n" + chalk.bgGreen.bold("////////////////////////////////////////") + "\n");
  console.log(chalk.blue(chalk.underline.bold("Model") + ": ") + theData.model);
  console.log(chalk.yellow(chalk.underline.bold("Temperature") + ": ") + theData.temperature);
  console.log(chalk.red(chalk.underline.bold("Top-P") + ": ") + theData.topP);
  console.log(chalk.white(chalk.underline.bold("LangChain Embed") + ":\n") + chalk.white(theData.langchainURL) + "\n");
  console.log(chalk.cyan(chalk.underline.bold("Prompt") + ":\n") + chalk.cyan(theData.input) + "\n");
  console.log(chalk.white.underline.bold("Response") + ":\n" + chalk.bgBlack(result.text) + "\n");
});



//app.post('/anthropic', async (req, res) => {
app.post('/anthropic', validateInput, async (req, res) => {
  //Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
    console.log(errors);
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
      system: theData.system,
      messages: theMsgs,
    });

    res.status(200).json(msg);

    console.log("\n" + chalk.bgGreen.bold("////////////////////////////////////////") + "\n");
    console.log(chalk.blue(chalk.underline.bold("Model") + ": ") + theData.model);
    console.log(chalk.yellow(chalk.underline.bold("Temperature") + ": ") + theData.temperature);
    console.log(chalk.red(chalk.underline.bold("Top-P") + ": ") + theData.top_p);
    console.log(chalk.magenta(chalk.underline.bold("System") + ":\n") + chalk.magenta(theData.system));
    console.log(chalk.cyan(chalk.underline.bold("Prompt") + ":\n") + chalk.cyan(((theMsgs[theMsgs.length - 1])).content[0].text) + "\n");
    console.log(chalk.white.underline.bold("Response") + ":\n" + chalk.bgBlack(msg.content[0].text) + "\n");

  } catch (error) {
    console.error('Error:\n', error);
    res.status(500).json({ error: 'Anthropic Failure' });
  }
});



//OpenAI and Grok share the same SDK
async function makeAIRequest(req, res, apiKeyEnvVar, baseUrl = null) {
  // Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
    console.log(errors);
  }

  try {
    const { model, messages, temperature, top_p } = req.body;

    // Validate required fields
    if (!model || !messages) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Set up client with the appropriate API key and optional base URL
    const client = new OpenAI({
      apiKey: process.env[apiKeyEnvVar],
      ...(baseUrl && { baseURL: baseUrl })
    });

    // Make the API call
    const response = await client.chat.completions.create({
      model,
      max_tokens: 1000,
      temperature,
      top_p: top_p,
      messages,
    });

    res.status(200).json(response);

    console.log("\n" + chalk.bgGreen.bold("////////////////////////////////////////") + "\n");
    console.log(chalk.blue(chalk.underline.bold("Model") + ": ") + model);
    console.log(chalk.yellow(chalk.underline.bold("Temperature") + ": ") + temperature);
    console.log(chalk.red(chalk.underline.bold("Top-P") + ": ") + top_p);
    console.log(chalk.magenta(chalk.underline.bold("System") + ":\n") + chalk.magenta(messages[0].content));
    console.log(chalk.cyan(chalk.underline.bold("Prompt") + ":\n") + chalk.cyan(((messages[messages.length - 1])).content[0].text) + "\n");
    console.log(chalk.white.underline.bold("Response") + ":\n" + chalk.bgBlack(response.choices[0].message.content) + "\n");

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: `API Failure` }); // Generic error message
  }
}

// Define both model-type routes using makeAIRequest()
app.post('/openai', validateInput, (req, res) => makeAIRequest(req, res, 'OPENAI_API_KEY'));
app.post('/grok', validateInput, (req, res) => makeAIRequest(req, res, 'GROK_API_KEY', "https://api.x.ai/v1"));



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
    return res.status(400).json({ errors: errors.array() });
    console.log(errors);
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
      maxOutputTokens: 1000,
    };

    const result = await model.generateContent({
      contents: convertMessages(theData.messages),
      generationConfig,
    });

    const response = result.response.text();

    res.status(200).json(response);

    console.log("\n" + chalk.bgGreen.bold("////////////////////////////////////////") + "\n");
    console.log(chalk.blue(chalk.underline.bold("Model") + ": ") + theData.model);
    console.log(chalk.yellow(chalk.underline.bold("Temperature") + ": ") + theData.temperature);
    console.log(chalk.red(chalk.underline.bold("Top-P") + ": ") + theData.top_p);
    console.log(chalk.magenta(chalk.underline.bold("System") + ":\n") + chalk.magenta(theData.system));
    console.log(chalk.cyan(chalk.underline.bold("Prompt") + ":\n") + chalk.cyan(((theMsgs[theMsgs.length - 1])).content[0].text) + "\n");
    console.log(chalk.white.underline.bold("Response") + ":\n" + chalk.bgBlack(response) + "\n");

  } catch (error) {
    console.error('Error:', error);
    console.log(error);
    if (error.message.includes("overloaded")) {
      return res.status(503).json("The model is overloaded. Please try again later.");
    } else {
      return res.status(500).json({ error: 'An unexpected error occurred.' }); // More generic error message
    }
  }
});



//Express server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});