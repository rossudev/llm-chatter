/* eslint-disable no-undef */
import express from "express";
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import axios from "axios";
import cors from "cors";
import bodyParser from "body-parser";
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import OpenAI from 'openai';
import { RealtimeRelay } from './relay.js';
import Config from './config.js';
import crypto from 'crypto';



//.env file containing the API keys
dotenv.config({ path: path.join(process.cwd(), '.env') });



//Realtime Relay
const relay = new RealtimeRelay(process.env['OPENAI_API_KEY']);
relay.listen(8081);



//Express server to handle client requests
const app = express();
const port = 8080;

app.use(bodyParser.json({ limit: '50mb' }));

//Configure allowed-to-connect domains here, for real deployment
app.use(cors());

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 2000, // limit each IP to 2000 requests per windowMs
  validate: { xForwardedForHeader: false },
});
app.use(limiter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Bad Request' });
});



// Function to get the current time as a string in 'HH:MM:SS' format
function getCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/* // Function to get the log file path, system local time
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
}; */









const chatHistoryDir = path.join(process.cwd(), 'chat-histories');

if (!fs.existsSync(chatHistoryDir)) {
  fs.mkdirSync(chatHistoryDir);
};

const decrypt = (encrypted, pwd) => {
  const iv = encrypted.slice(0, 16);
  encrypted = encrypted.slice(16);
  const key = crypto.scryptSync(pwd, process.env['LLM_SERVER_HASH'], 32);
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const result = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return result;
};

//Read the chat history for a specific user
function readChatHistory(username) {
  const chatSpecificPath = path.join(chatHistoryDir, `${username}.chat`);
  
  try {
    // Check if the file exists
    if (!fs.existsSync(chatSpecificPath)) {
      // Get the user's passphrase
      const passphraseData = JSON.parse(process.env['LLM_CHATTER_PASSPHRASE']);
      const user = passphraseData.users.find(u => u.name === username);
      
      if (!user) {
        console.error(`User ${username} not found in passphrase data`);
        return [];
      }
      
      const passphrase = user.value;
      
      // Create an empty chat history array
      const emptyHistory = [];
      
      // Encrypt and save the empty array
      const encrypted = encrypt(JSON.stringify(emptyHistory), passphrase);
      
      // Make sure the directory exists
      if (!fs.existsSync(chatHistoryDir)) {
        fs.mkdirSync(chatHistoryDir, { recursive: true });
      }
      
      // Write the encrypted empty array to the file
      fs.writeFileSync(chatSpecificPath, encrypted, 'utf8');
      
      // Return the empty array
      return emptyHistory;
    }
    
    // If the file exists, read and decrypt it
    const passphraseData = JSON.parse(process.env['LLM_CHATTER_PASSPHRASE']);
    const user = passphraseData.users.find(u => u.name === username);
    
    if (!user) {
      console.error(`User ${username} not found in passphrase data`);
      return [];
    }
    
    const passphrase = user.value;
    const fileContent = fs.readFileSync(chatSpecificPath, 'utf8');
    const decrypted = decrypt(fileContent, passphrase);
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error(`Error reading chat history for ${username}:`, error);
    return [];
  }
}

// Function to log chat events
function logChatEvent(username, data) {
  const logEntry = {
    ...data
  };
  const passphraseData = JSON.parse(process.env['LLM_CHATTER_PASSPHRASE']);
  const user = passphraseData.users.find(u => u.name === username);
  
  if (!user) {
    console.error(`User ${username} not found in passphrase data`);
    return;
  }
  
  const passphrase = user.value;
  const chatSpecificPath = path.join(chatHistoryDir, `${username}.chat`);
  
  // Initialize with an empty array
  let chatHistory = [];
  
  // Check if the file exists
  if (fs.existsSync(chatSpecificPath)) {
    try {
      const fileContent = fs.readFileSync(chatSpecificPath, 'utf8');
      chatHistory = JSON.parse(decrypt(fileContent, passphrase) || '[]');
    } catch (error) {
      console.error(`Error reading existing chat history for ${username}:`, error);
      // Continue with empty array if there's an error reading the file
    }
  } else {
    // Make sure the directory exists
    if (!fs.existsSync(chatHistoryDir)) {
      fs.mkdirSync(chatHistoryDir, { recursive: true });
    }
  }
  
  // Add the new log entry
  chatHistory.push(logEntry);
  
  // Encrypt and save
  const stringy = JSON.stringify(chatHistory);
  const buffer = Buffer.from(stringy, 'utf8');
  const key = crypto.scryptSync(passphrase, process.env['LLM_SERVER_HASH'], 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-ctr", key, iv);
  const result = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
  // Use writeFileSync to ensure the file is written before continuing
  fs.writeFileSync(chatSpecificPath, result);
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

const validateCheckin = [
  body('serverUsername').isString().trim(),
  body('serverPassphrase').isString().trim(),
  body('sessionHash').isString().trim(),
];

const activeSessions = new Map();

//Client check-in
app.post('/checkin', validateCheckin, async (req, res) => {
  const errors = validationResult(req);

  const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip;
  const agent = req.headers['user-agent'];
  const origin = req.headers.origin;
  const sessionHash = req.body.sessionHash;
  //const headers = JSON.stringify(req.headers, null, 2);
  const sentPhrase = req.body.serverPassphrase;
  const serverUsername = req.body.serverUsername;

  if (!errors.isEmpty()) {
    console.log(errors);
    return res.status(400).json({ error: 'Bad Request' });
  }

  let passphraseData;

  try {
    passphraseData = JSON.parse(process.env['LLM_CHATTER_PASSPHRASE']);
  } catch (e) {
    return res.status(400).json({ error: 'Bad Request' });
  }
  // Check if the username exists and passphrase matches
  let checkPass = false;
  let userName = "Unknown";

  // Find the user with the matching name
  const user = passphraseData.users.find(u => u.name === serverUsername);

  if (user) {
    const isValid = await verifyPassphrase(sentPhrase, user.value);
    if (isValid) {
      checkPass = true;
      userName = user.name;
    }
  }
  if (!checkPass) {
    console.log(chalk.cyan("\nAuthentication failed." +
      "\nUsername: " + serverUsername +
      "\nSource (Origin): " + origin +
      "\nConnector's Address (IP): " + clientIp + "\n"));

    return res.status(400).json({ error: 'Authentication Failure' });
  }

  const token = generateToken(sessionHash);

  // Store user session information
  activeSessions.set(token, {
    userName,
    clientIp,
    agent,
    origin,
    sessionHash,
    createdAt: new Date(),
  });

  console.log(chalk.cyan("\nClient checked in." +
    "\nUser: " + userName +
    "\nSource: " + origin +
    "\nConnector IP: " + clientIp +
    "\nUser-Agent: " + agent + "\n")
  );

  const userChatHistory = readChatHistory(userName);

  res.json({ token, userChatHistory });
});




const validateInput = [
  // Validation checks
  body('uniqueChatID').optional().isString().trim(),
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
  body('sentOne').optional().isBoolean(),
  body('keep_alive').optional().isInt({ min: 0 }),
  body('messages').optional().isArray(),
  body('images').optional().isArray(),

  // Middleware function to handle validation and token verification
  (req, res, next) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: 'Bad Request' });
    }
    // Verify token
    let token;
    if (req.query.token) {
      token = req.query.token;
    } else {
      token = req.headers['authorization']?.split(' ')[1]; // Bearer token scheme
    }

    if (!token || !activeSessions.has(token)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // If both validation and token verification succeed, proceed
    next();
  }
];



//Client requests the list of local Ollama models
app.post('/getmodels', validateInput, async (req, res) => {
  const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip;
  const origin = req.headers['origin'];

  try {
    const response = await axios.get('http://localhost:11434/api/tags');

    console.log(chalk.cyan("\nSent model list.") +
      "\nSource: " + origin +
      "\nConnector IP: " + clientIp + "\n");

    res.send(response.data.models);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Ollama GetModels Error' });
  }
});



//Local Ollama API
app.post('/ollama', validateInput, async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors);
    res.status(400).json({ error: 'Bad Request' });
  }


  try {
    const theData = { ...req.body };
    delete theData.uniqueChatID;
    delete theData.sentOne;
    delete theData.serverUsername;

    const timeNow = new Date().toISOString();
    const chatId = req.body.uniqueChatID;
    const sent1 = req.body.sentOne;
    const username = req.body.serverUsername;

    const logData = {
      chatId: chatId,
      model: theData.model,
      temp: theData.options.temperature || 0.8,
      topp: theData.options.top_p || 1,
      topk: theData.options.top_k || 1,
    }

    if (!sent1 && theData.system) {
      logChatEvent(username, {
        ...logData,
        role: "system",
        time: timeNow,
        message: theData.system,
      });
    };

    logChatEvent(username, {
      ...logData,
      role: "user",
      time: timeNow,
      message: theData.prompt,
    });

    const response = await axios.post(
      "http://localhost:11434/api/generate",
      theData,
      { headers: { "Content-Type": "application/json" } },
    );

    res.send(response.data);

    const timestamp = new Date().toISOString();

    logChatEvent(username, {
      ...logData,
      role: "assistant",
      time: timestamp,
      message: response.data.response,
    });

    console.log(`
    ${chalk.bgGreen.bold('\n////////////////////////////////////////')}
    ${chalk.underline('Remote IP:')} ${chalk.white((req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip))}
    ${chalk.underline('User:')} ${chalk.white(username)}
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




//app.post('/anthropic', async (req, res) => {
app.post('/anthropic', validateInput, async (req, res) => {
  //Handle validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    res.status(400).json({ error: 'Bad Request' });
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

    const timeNow = new Date().toISOString();
    const chatId = req.body.uniqueChatID;
    const sent1 = req.body.sentOne;
    const username = req.body.serverUsername;

    const logData = {
      chatId: chatId,
      model: theData.model,
      temp: theData.temperature || 0.8,
      topp: theData.top_p || 1,
      topk: theData.top_k || 1,
    }

    if (!sent1 && theData.system) {
      logChatEvent(username, {
        ...logData,
        role: "system",
        time: timeNow,
        message: theData.system,
      });
    };

    logChatEvent(username, {
      ...logData,
      role: "user",
      time: timeNow,
      message: ((theMsgs[theMsgs.length - 1])).content[0].text,
    });

    const msg = await anthropic.messages.create({
      model: theData.model,
      max_tokens: 10000,
      temperature: theData.temperature,
      top_p: theData.top_p,
      top_k: theData.top_k,
      system: theData.system,
      messages: theMsgs,
    });

    res.status(200).json(msg);

    const timestamp = new Date().toISOString();

    logChatEvent(username, {
      ...logData,
      role: "assistant",
      time: timestamp,
      message: msg.content[0].text,
    });

    console.log(`
    ${chalk.bgGreen.bold('\n////////////////////////////////////////')}
    ${chalk.underline('Remote IP:')} ${chalk.white((req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip))}
    ${chalk.underline('User:')} ${chalk.white(theData.serverUsername)}
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



//OpenAI
//Grok
//DeepSeek

//Grok and DeepSeek need to have baseUrl set
async function makeAIRequest(req, res, apiKeyEnvVar, baseUrl = null) {
  // Handle validation errors
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors);
    return res.status(400).json({ error: 'Bad Request' });
  }

  try {
    const theData = req.body;
    let { model, messages, temperature, top_p } = req.body;
    let system = messages[0] ? messages[0].content : "";

    // Validate required fields
    if (!model || !messages) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check the model and alter messages if necessary
    if (Config.reasoningModels.includes(model)) {
      // Filter out the object with role "system"
      //messages = messages.filter(message => message.role !== "system");
      temperature = 1;
      top_p = 1;
      system = "";
      messages = messages.filter(message => message.role !== "system");
    }

    const lastMessage = messages[messages.length - 1];
    const promptText = lastMessage && lastMessage.content[0].text ? lastMessage.content[0].text : 'N/A';

    const timeNow = new Date().toISOString();
    const chatId = req.body.uniqueChatID;
    const sent1 = req.body.sentOne;
    const username = req.body.serverUsername;

    const logData = {
      chatId: chatId,
      model: model,
      temp: temperature || 0.8,
      topp: top_p || 1,
      topk: theData.top_k || 1,
    }

    if (!sent1 && system) {
      logChatEvent(username, {
        ...logData,
        role: "system",
        time: timeNow,
        message: system,
      });
    };

    logChatEvent(username, {
      ...logData,
      role: "user",
      time: timeNow,
      message: promptText,
    });

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

    const timestamp = new Date().toISOString();

    logChatEvent(username, {
      ...logData,
      role: "assistant",
      time: timestamp,
      message: response.choices?.[0]?.message?.content || 'No response content available',
    });

    const responseContent = response.choices?.[0]?.message?.content || 'No response content available';
    console.log(`
    ${chalk.bgGreen.bold('\n////////////////////////////////////////')}
    ${chalk.underline('Remote IP:')} ${chalk.white((req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip))}
    ${chalk.underline('User:')} ${chalk.white(theData.serverUsername)}
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
    res.status(400).json({ error: 'Bad Request' });
  }

  try {
    const theData = req.body;
    const theMsgs = theData.messages;
    const convertedMsgs = convertMessages(theMsgs);

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

    const timeNow = new Date().toISOString();
    const chatId = req.body.uniqueChatID;
    const sent1 = req.body.sentOne;
    const username = req.body.serverUsername;

    const logData = {
      chatId: chatId,
      model: theData.model,
      temp: theData.temperature || 0.8,
      topp: theData.top_p || 1,
      topk: theData.top_k || 1,
    }

    if (!sent1 && theData.system) {
      logChatEvent(username, {
        ...logData,
        role: "system",
        time: timeNow,
        message: theData.system,
      });
    };

    logChatEvent(username, {
      ...logData,
      role: "user",
      time: timeNow,
      message: ((theMsgs[theMsgs.length - 1])).content[0].text,
    });

    const generationConfig = {
      temperature: theData.temperature,
      topP: theData.top_p,
      topK: theData.top_k,
      maxOutputTokens: 10000,
    };

    const googleImg = theData.images;

    const sendGoogle = (googleImg && (googleImg.length > 0 )) ?
      googleImg :
      {
        contents: convertedMsgs,
        generationConfig: generationConfig
      };

    const result = await model.generateContent(sendGoogle);
    const response = result.response.text();
    res.status(200).json(response);

    const timestamp = new Date().toISOString();

    logChatEvent(username, {
      ...logData,
      role: "assistant",
      time: timestamp,
      message: response,
    });

    console.log(`
    ${chalk.bgGreen.bold('\n////////////////////////////////////////')}
    ${chalk.underline('Remote IP:')} ${chalk.white((req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip))}
    ${chalk.underline('User:')} ${chalk.white(theData.serverUsername)}
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