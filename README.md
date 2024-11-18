# LLM Chatter, v0.0.4

A web interface to chat by text (and voice!) with various large language models.

![Application screenshot](https://github.com/rossuber/llm-chatter/blob/main/dist/screenshot.webp?raw=true)

# Installation

1. Install Ollama and [add at least one model](https://www.ollama.ai/library).
   - `curl https://ollama.ai/install.sh | sh`
   - `ollama pull mistral-openorca:7b`
3. Run `wget https://raw.githubusercontent.com/rossuber/llm-chatter/master/dist/index.html`
4. Run `python3 -m http.server 8181`
5. Open `localhost:8181` in your web browser.
6. Paste API keys into .env file for the NodeJS server

# NodeJS server

This handles API post requests at http://localhost:8080

1. Run `mkdir langchain-ollama`
2. Run `cd langchain-ollama`
3. Run `wget https://raw.githubusercontent.com/rossuber/llm-chatter/master/langchain-ollama/index.js`
4. Run `wget https://raw.githubusercontent.com/rossuber/llm-chatter/master/langchain-ollama/package.json`
5. Run `wget https://raw.githubusercontent.com/rossuber/llm-chatter/master/langchain-ollama/script.py`
6. Run `npm install`
7. Configure line 19 of `index.js` with the path to `script.py`
8. Install [Whisper Medusa](https://github.com/aiola-lab/whisper-medusa) - see below
9. Adjust line & Run `cd [path-to-file]; node index.js`

# Whisper Medusa
[Whisper Medusa](https://github.com/aiola-lab/whisper-medusa)

- `conda create -n whisper-medusa python=3.11 -y`
- `conda activate whisper-medusa`
- `pip install torch==2.2.2 torchvision==0.17.2 torchaudio==2.2.2 --index-url https://download.pytorch.org/whl/cu118`
- `git clone https://github.com/aiola-lab/whisper-medusa.git`
- `cd whisper-medusa`
- `pip install -e .`

Built with: [Vite](https://vitejs.dev/) / [Bun](https://bun.sh/) / [React](https://react.dev/) / [TailwindCSS](https://tailwindcss.com/) / [FontAwesome](https://fontawesome.com/)

The web app pulls icon images from https://ka-f.fontawesome.com.

The web app makes API calls to http://localhost:8080 by default. This is the NodeJS server running from index.js). The NodeJS server handles each model's API calls through various SDK's.

# Models Documentation Reference
[Ollama.ai](https://github.com/jmorganca/ollama/blob/main/docs/api.md)
[Whisper Medusa](https://github.com/aiola-lab/whisper-medusa)
[OpenAI.com](https://platform.openai.com/docs/overview)
[Google.ai](https://ai.google.dev/gemini-api/docs)
[Anthropic](https://docs.anthropic.com/)
[Grok](https://docs.x.ai/docs)

#Proprietary Models
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