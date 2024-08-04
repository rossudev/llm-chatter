import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Ollama } from "langchain/llms/ollama";
import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import "@tensorflow/tfjs-node";
import { TensorFlowEmbeddings } from "langchain/embeddings/tensorflow";
import { RetrievalQAChain } from "langchain/chains";
import { exec } from 'child_process';
import multer from 'multer';

const app = express();
const port = 8080;
app.use(bodyParser.json());
app.use(cors());

const pyFilePath = "/path/to/your/script.py";
const upload = multer({ dest: 'uploads/' });

app.post('/whisper-medusa', upload.single('audio'), (req, res) => {
    console.log("Received audio file");
    
    if (!req.file) {
        return res.status(400).send({ error: 'No file uploaded' });
    }

    console.log(req.file); // Log the details of the uploaded file

    // Get the path of the uploaded file
    const audioFilePath = req.file.path;

    // Pass the file path to the shell command
    exec(`cp ${audioFilePath} ${audioFilePath}.webm; ffmpeg -i ${audioFilePath}.webm -ar 16000 ${audioFilePath}.wav; PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True conda run -n whisper-medusa python ${pyFilePath} "${audioFilePath}.wav"`, (error, stdout, stderr) => {
        if (error) {
            console.log(stderr);
            return res.status(500).send(stderr);
        } res.send(stdout); }); });

app.post('/langchain', async (req, res) => {
  const theData = req.body;

  // Step 1: Check if theData is defined
  if (!theData) {
    console.log("undefined");
    return res.status(400).send("Invalid request data.");
  }

  // Step 2: Validate required properties
  const requiredFields = ['model', 'input', 'langchainURL'];
  for (const field of requiredFields) {
    if (typeof theData[field] === 'undefined') {
      console.log(`${field} is undefined`);
      return res.status(400).send(`Missing required field: ${field}`);
    }
  }

  console.log(theData.model);
  console.log(theData.input);
  console.log(theData.langchainURL);

  const ollama = new Ollama({
    baseUrl: "http://localhost:11434",
    model: theData.model,
    temperature: theData.temperature,
    topP: theData.topp
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
  console.log(result)

  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  res.send(result);
});

app.post('/check', async (req, res) => {
  //console.log("ok");
  res.send("ok");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
