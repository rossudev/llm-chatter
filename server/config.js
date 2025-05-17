const Config = {
  serverBehindCloudflare: true,
  reasoningModels: ["o1", "o1-mini", "o3-mini", "o4-mini"],
  imgOutputModels: ["gpt-image-1", "gemini-2.0-flash-preview-image-generation"],
  timeFormat: "DD/MM/YYYY HH:mm:ss",
  ollamaEnabled: true,
  clientDomains: [
    "http://localhost:8181",
  ],
};

export default Config;
