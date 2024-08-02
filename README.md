# LLM Chatter, v0.0.3

Single HTML file interface to chat with Ollama local large language models (LLMs) or OpenAI.com LLMs.

![Application screenshot](https://github.com/rossuber/llm-chatter/blob/main/dist/screenshot.webp?raw=true)

# Installation

1. Install Ollama and [add at least one model](https://www.ollama.ai/library).
   - `curl https://ollama.ai/install.sh | sh`
   - `ollama pull mistral-openorca:7b`
3. Run `wget https://raw.githubusercontent.com/rossuber/llm-chatter/master/dist/index.html`
4. Run `python3 -m http.server 8181`
5. Open `localhost:8181` in your web browser.
6. Optional: Register an account at [openai.com](https://openai.com/) and subscribe for an API key. Paste it into the 'Open AI' password field while OpenAI Chat is selected.

# Optional LangChain node.js server installation steps

Now supports LangChain URL embedding! The LangChain Ollama implementation is incompatible with something (like React? I am not sure), so it is necessary to run a separate node.js Express server to handle API requests at http://localhost:8080

1. Run `mkdir langchain-ollama`
2. Run `cd langchain-ollama`
3. Run `wget https://raw.githubusercontent.com/rossuber/llm-chatter/master/langchain-ollama/index.js`
4. Run `wget https://raw.githubusercontent.com/rossuber/llm-chatter/master/langchain-ollama/package.json`
5. Run `npm install`
6. Run `node index.js`

Built with: [Vite](https://vitejs.dev/) / [Bun](https://bun.sh/) / [React](https://react.dev/) / [TailwindCSS](https://tailwindcss.com/) / [FontAwesome](https://fontawesome.com/)

The web app pulls icon images from https://ka-f.fontawesome.com.

The web app makes API calls to http://localhost:11434 (ollama), http://localhost:8080 (the langchain-ollama node.js Express server), and https://api.openai.com.

[Ollama API docs](https://github.com/jmorganca/ollama/blob/main/docs/api.md)

[OpenAI API docs](https://platform.openai.com/docs/api-reference)

# Thank you
[Ollama.ai](https://www.ollama.ai/)

[OpenAI.com](https://www.openai.com/)
