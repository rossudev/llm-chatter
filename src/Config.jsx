// This file contains the configuration for the app.

const openAIModels = [
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "chatgpt-4o-latest",
  "o4-mini",
  "o3-mini",
  //"o1-pro",
  "o1",
  "o1-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
];

const anthropicModels = [
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
  "claude-3-opus-20240229",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
];

const googleModels = [
  "gemini-2.5-pro-exp-03-25",
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

const grokModels = [
  "grok-3-beta",
  "grok-3-mini-beta",
  "grok-2",
  "grok-2-vision",
  "grok-vision-beta",
  "grok-beta",
];

const deepseekModels = [
  "deepseek-chat", //DeepSeek-V3
  "deepseek-reasoner", //DeepSeek-R1
];

const Config = {
  serverURL: "http://localhost:8080",
  relayURL: "http://localhost:8081",

  ollamaEnabled: true,

  temperature: "0.8",
  topp: "1",
  topk: "1",

  sysMsg: "Let's work this out in a step by step way to be sure we have the right answer.",

  defaultChatType: "OpenAI",
  defaultModel: { name: "o4-mini" },
  defaultModelList: openAIModels,

  models: {
    openAI: openAIModels,
    anthropic: anthropicModels,
    google: googleModels,
    grok: grokModels,
    deepseek: deepseekModels,
  },

  reasoningModels:
    [
      "o1-pro",
      "o1",
      "o1-mini",
      "o3-mini",
      "o4-mini",
    ],

  visionModels:
    [
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "chatgpt-4o-latest",
      "o1",
      "o4-mini",
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
      "gemini-2.5-pro-exp-03-25",
      "gemini-2.0-flash-exp",
      "gemini-2.0-flash-lite",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "grok-2-vision",
      "grok-vision-beta",
      "granite3.2-vision:latest",
      "llava-phi3:latest",
      "bakllava:latest",
      "moondream:latest",
      "llava-llama3:latest",
      "minicpm-v:latest",
      "llama3.2-vision:latest",
      "llama3.2-vision:11b",
      "llama3.2-vision:90b",
      "llava:latest",
      "llava:7b",
      "llava:13b",
      "llava:34b",
      "gemma3:latest",
      "gemma3:1b",
      "gemma3:4b",
      "gemma3:12b",
      "gemma3:27b",
    ]
};

export default Config;