# LLM Chatter, v0.0.9

Large Language Model chat by text, vision and voice. Proprietary models by API request, local Ollama model and LangChain (by URL) supported.

# Ollama Setup

1. Install Ollama and [add at least one model](https://www.ollama.ai/library).
   - `curl -fsSL https://ollama.com/install.sh | sh`

# Installation

1. `curl -fsSL https://raw.githubusercontent.com/rossudev/llm-chatter/master/install.sh | sh`
2. Configure .env file
   - [LLM_CHATTER_PASSPHRASE](https://bcrypt.online/)
   - [LLM_SERVER_HASH](https://duckduckgo.com/?q=generate+password+32+characters)
   - [ANTHROPIC_API_KEY](https://www.anthropic.com/api)
   - [DEEPSEEK_API_KEY](https://platform.deepseek.com/api_keys)
   - [GOOGLE_API_KEY](https://ai.google.dev/gemini-api/docs/billing)
   - [GROK_API_KEY](https://console.x.ai/)
   - [OPENAI_API_KEY](https://platform.openai.com/account/billing)

# Startup

1. To start the server: `./start-server.sh`
2. To start the client: `./start-client.sh`

# Thanks!

Built with: 

- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
- [TailwindCSS](https://tailwindcss.com/)
- [FontAwesome](https://fontawesome.com/)

# Models Documentation Reference
- [Anthropic](https://docs.anthropic.com/)
- [Deepseek](https://api-docs.deepseek.com/)
- [Google](https://ai.google.dev/gemini-api/docs)
- [Grok](https://docs.x.ai/docs)
- [Ollama](https://github.com/jmorganca/ollama/blob/main/docs/api.md)
- [Ollama LangChain](https://js.langchain.com/docs/integrations/llms/ollama/)
- [OpenAI](https://platform.openai.com/docs/overview)

# Models List
- o3-mini
- o1*
- o1-preview
- o1-mini
- gpt-4.5-preview*
- gpt-4o-realtime-preview (Audio In/Out)
- gpt-4o*
- gpt-4o-mini*
- gpt-4-turbo*
- gpt-4
- gpt-3.5-turbo
- claude-3-7-sonnet-20250219*
- claude-3-5-sonnet-20241022*
- claude-3-5-haiku-20241022*
- claude-3-opus-20240229*
- claude-3-sonnet-20240229*
- claude-3-haiku-20240307*
- deepseek-chat
- deepseek-reasoner
- gemini-2.0-flash-exp*
- gemini-1.5-pro*
- gemini-1.5-flash*
- gemini-1.5-flash-8b
- grok-2
- grok-beta

 *Vision image support (img & text in, text out)