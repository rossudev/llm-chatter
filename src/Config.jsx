// This file contains the configuration for the app.

const openAIModels = [
  "o1",
  "o3-mini",
  "o1-preview",
  "o1-mini",
  "gpt-4.5-preview",
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
  "gemini-2.0-flash-exp",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

const grokModels = [
  "grok-2",
  "grok-beta",
];

const deepseekModels = [
  "deepseek-chat",
  "deepseek-reasoner",
];

const config = {
  serverURL: "http://localhost:8080",
  relayURL: "http://localhost:8081",

  temperature: "0.8",
  topp: "1",
  topk: "1",

  sysMsg: "Let's work this out in a step by step way to be sure we have the right answer.",

  defaultChatType: "OpenAI",
  defaultModel: { name: "o1" },
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
      "o1",
      "o1-preview",
      "o1-mini",
      "o3-mini",
    ],

  visionModels:
    [
      "o1",
      "gpt-4.5-preview",
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
      "gemini-2.0-flash-exp",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
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

export default config;