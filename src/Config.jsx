// Config.jsx
const config = {
  defaultChatType: "OpenAI",

  models: {
    openAI: [
      { name: "o1" },
      { name: "o3-mini" },
      { name: "o1-preview" },
      { name: "o1-mini" },
      { name: "gpt-4.5-preview" },
      { name: "gpt-4o" },
      { name: "gpt-4o-mini" },
      { name: "gpt-4-turbo" },
      { name: "gpt-4" },
      { name: "gpt-3.5-turbo" },
    ],
    anthropic: [
      { name: "claude-3-7-sonnet-20250219" },
      { name: "claude-3-5-sonnet-20241022" },
      { name: "claude-3-5-haiku-20241022" },
      { name: "claude-3-opus-20240229" },
      { name: "claude-3-sonnet-20240229" },
      { name: "claude-3-haiku-20240307" },
    ],
    google: [
      { name: "gemini-2.0-flash-exp" },
      { name: "gemini-1.5-pro" },
      { name: "gemini-1.5-flash" },
      { name: "gemini-1.5-flash-8b" },
    ],
    grok: [
      { name: "grok-2" },
      { name: "grok-beta" },
    ],
    deepseek: [
      { name: "deepseek-chat" },
      { name: "deepseek-reasoner" },
    ],
  },

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
    ]
};

export default config;