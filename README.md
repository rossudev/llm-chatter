# LLM Chatter, v0.0.6

A web interface to chat by text (and voice!) with various large language models.

# Client setup

1. Install Ollama and [add at least one model](https://www.ollama.ai/library).
2. `wget https://raw.githubusercontent.com/rossudev/llm-chatter/master/dist/index.html`

# Client start-up

1. `cd [path-to-file]; python3 -m http.server 8181`
2. Open `localhost:8181` in your web browser.

# Server setup

1. `mkdir langchain-ollama; cd langchain-ollama; wget https://raw.githubusercontent.com/rossudev/llm-chatter/master/langchain-ollama/index.js; wget https://raw.githubusercontent.com/rossudev/llm-chatter/master/langchain-ollama/package.json; wget https://raw.githubusercontent.com/rossudev/llm-chatter/master/langchain-ollama/.env; npm install`
2. Configure .env file
   - [LLM_CHATTER_PASSPHRASE](https://bcrypt.online/)
   - [LLM_SERVER_HASH](https://duckduckgo.com/?q=generate+password+32+characters)
   - [ANTHROPIC_API_KEY](https://www.anthropic.com/api)
   - [GOOGLE_API_KEY](https://ai.google.dev/gemini-api/docs/billing)
   - [GROK_API_KEY](https://console.x.ai/)
   - [OPENAI_API_KEY](https://platform.openai.com/account/billing)

# Server start-up

1. `cd [path-to-file]; node index.js`

# Thanks

Built with: 

- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
- [TailwindCSS](https://tailwindcss.com/)
- [FontAwesome](https://fontawesome.com/)

# Models Documentation Reference
- [Ollama.ai](https://github.com/jmorganca/ollama/blob/main/docs/api.md)
- [Whisper Medusa](https://github.com/aiola-lab/whisper-medusa)
- [OpenAI.com](https://platform.openai.com/docs/overview)
- [Google.ai](https://ai.google.dev/gemini-api/docs)
- [Anthropic](https://docs.anthropic.com/)
- [Grok](https://docs.x.ai/docs)

# Proprietary Models List
- gpt-4o
- gpt-4o-mini
- gpt-4-turbo
- gpt-4
- gpt-3.5-turbo
- claude-3-5-sonnet-20241022
- claude-3-5-haiku-20241022
- claude-3-opus-20240229
- claude-3-sonnet-20240229
- claude-3-haiku-20240307
- gemini-1.5-pro
- gemini-1.5-flash
- gemini-1.5-flash-8b
- grok-beta