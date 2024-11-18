import express from "express";
import axios from "axios";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";
import path from 'path';
import dotenv from 'dotenv';
import { exec } from "child_process";
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



//.env file containing the API keys
dotenv.config({ path: path.join(process.cwd(), '.env') });



//Express server to handle client requests
const app = express();
const port = 8080;
app.use(bodyParser.json());
app.use(cors());



//Heartbeat: Clients ping this /check URL every second
app.post('/check', async (req, res) => {
  res.send("ok");
});



//Client requests the list of local Ollama models
app.post('/getmodels', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:11434/api/tags');

    res.send(response.data.models);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'GetModels Failure' });
  }
});



//Local Ollama API
app.post('/ollama', async (req, res) => {
  try {
    const theData = req.body;

    const response = await axios.post(
      "http://localhost:11434/api/generate",
      theData,
      { headers: { "Content-Type": "application/json" } },
  );

    res.send(response.data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Ollama Failure' });
  }
});



//Whisper Medusa-supported voice-to-text
const pyFilePath = "/home/opec/Documents/programming/python/whisper-medusa/whisper_medusa/go.py";
const upload = multer({ dest: 'uploads/' });

app.post('/whisper-medusa', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ error: 'No file uploaded' });
    }

    const audioFilePath = req.file.path;
    exec(`cp ${audioFilePath} ${audioFilePath}.webm; ffmpeg -i ${audioFilePath}.webm -ar 16000 ${audioFilePath}.wav; PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True conda run -n whisper-medusa python ${pyFilePath} "${audioFilePath}.wav"`, (error, stdout, stderr) => {
        if (error) {
            console.log(stderr);
            return res.status(500).send(stderr);
        } res.send(stdout); 
    }); 
});



//LangChain embedding of URL content
app.post('/langchain', async (req, res) => {
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
    topP: theData.topp,
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
});



//Anthropic SDK
app.post('/anthropic', async (req, res) => {
  try {
    const theData = req.body;

    if (!theData.model || !theData.messages) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const anthropic = new Anthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });

    const msg = await anthropic.messages.create({
      model: theData.model,
      max_tokens: 1000,
      temperature: theData.temperature,
      top_p: theData.topp,
      system: theData.system,
      messages: theData.messages,
    });

    res.status(200).json(msg);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Anthropic Failure' });
  }
});



//OpenAI and Grok share the same SDK
async function makeAIRequest(req, res, apiKeyEnvVar, baseUrl = null) {
  try {
    const { model, messages, temperature, topp, system } = req.body;

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
      top_p: topp,
      system,
      messages,
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: `API Failure` }); // Generic error message
  }
}

// Define both model-type routes using makeAIRequest()
app.post('/openai', (req, res) => makeAIRequest(req, res, 'OPENAI_API_KEY'));
app.post('/grok', (req, res) => makeAIRequest(req, res, 'GROK_API_KEY', "https://api.x.ai/v1"));



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

//Google SDK
app.post('/google', async (req, res) => {
  try {
    const theData = req.body;

    if (!theData.model || !theData.messages) {
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
      topP: theData.topp,
      maxOutputTokens: 1000,
    };

    const result = await model.generateContent({
      contents: convertMessages(theData.messages),
      generationConfig,
    });

    const response = result.response.text();

    res.status(200).json(response);


  } catch (error) {
    console.error('Error:', error);
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