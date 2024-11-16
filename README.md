# LLM Chatter, v0.0.3

A web interface to chat by text or voice with Ollama- or OpenAI-powered language models.

![Application screenshot](https://github.com/rossuber/llm-chatter/blob/main/dist/screenshot.webp?raw=true)

# Installation

1. Install Ollama and [add at least one model](https://www.ollama.ai/library).
   - `curl https://ollama.ai/install.sh | sh`
   - `ollama pull mistral-openorca:7b`
3. Run `wget https://raw.githubusercontent.com/rossuber/llm-chatter/master/dist/index.html`
4. Run `python3 -m http.server 8181`
5. Open `localhost:8181` in your web browser.
6. Optional: Register an account at [openai.com](https://openai.com/) and subscribe for an API key. Paste it into the "Open API key" input field, while OpenAI Chat mode is selected.

# Optional NodeJS server (Voice/LangChain support)

This handles API post requests at http://localhost:8080

1. Run `mkdir langchain-ollama`
2. Run `cd langchain-ollama`
3. Run `wget https://raw.githubusercontent.com/rossuber/llm-chatter/master/langchain-ollama/index.js`
4. Run `wget https://raw.githubusercontent.com/rossuber/llm-chatter/master/langchain-ollama/package.json`
5. Run `wget https://raw.githubusercontent.com/rossuber/llm-chatter/master/langchain-ollama/script.py`
6. Run `npm install`
7. Configure line 19 of `index.js` with the path to `script.py`
8. Install [Whisper Medusa](https://github.com/aiola-lab/whisper-medusa) - see below
9. Run `node index.js`

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

The web app makes API calls to http://localhost:11434 (ollama), http://localhost:8080 (the NodeJS Express server running from index.js), and https://api.openai.com.

[Ollama API docs](https://github.com/jmorganca/ollama/blob/main/docs/api.md)

[OpenAI API docs](https://platform.openai.com/docs/api-reference)

# Thank you
[Ollama.ai](https://www.ollama.ai/)
[Whisper Medusa](https://github.com/aiola-lab/whisper-medusa)
[OpenAI.com](https://www.openai.com/)