# LLM Chatter, v0.0.7

A web interface to chat by text (and voice!) with various large language models.

# Client setup

1. Install Ollama and [add at least one model](https://www.ollama.ai/library).
2. `wget https://raw.githubusercontent.com/rossudev/llm-chatter/master/dist/index.html`

# Client start-up

1. `cd [path-to-file]; python3 -m http.server 8181`
2. Open `localhost:8181` in your web browser.

# Server setup

1. `mkdir llm-chatter-server; cd llm-chatter-server; wget https://raw.githubusercontent.com/rossudev/llm-chatter/master/server/index.js; wget https://raw.githubusercontent.com/rossudev/llm-chatter/master/server/package.json; wget https://raw.githubusercontent.com/rossudev/llm-chatter/master/server/.env; wget https://raw.githubusercontent.com/rossudev/llm-chatter/master/server/relay.js; npm install`
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
- [Anthropic](https://docs.anthropic.com/)
- [Google](https://ai.google.dev/gemini-api/docs)
- [Grok](https://docs.x.ai/docs)
- [Ollama](https://github.com/jmorganca/ollama/blob/main/docs/api.md)
- [Ollama LangChain](https://js.langchain.com/docs/integrations/llms/ollama/)
- [OpenAI](https://platform.openai.com/docs/overview)

# Proprietary Models List
- o3-mini
- o1-preview
- o1-mini
- gpt-4o-realtime-preview (voice-in, voice/text-out)
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
- grok-3
- grok-2