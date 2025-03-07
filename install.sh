#!/bin/bash
set -e
# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
echo -e "${GREEN}Installing LLM-Chatter v0.0.9ls...${NC}"
# Create main directory
mkdir -p llm-chatter/client
cd llm-chatter
# Download server files
echo -e "${GREEN}Downloading server files...${NC}"
wget -q https://raw.githubusercontent.com/rossudev/llm-chatter/master/server/index.js
wget -q https://raw.githubusercontent.com/rossudev/llm-chatter/master/server/package.json
wget -q https://raw.githubusercontent.com/rossudev/llm-chatter/master/server/.env
wget -q https://raw.githubusercontent.com/rossudev/llm-chatter/master/server/relay.js
# Download client file
echo -e "${GREEN}Downloading client files...${NC}"
wget -q https://raw.githubusercontent.com/rossudev/llm-chatter/master/dist/index.html -O client/index.html
# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install
# Prompt for .env configuration
echo -e "${YELLOW}Configuration needed:${NC}"
echo -e "Please configure your .env file at $(pwd)/.env with the following:"
echo -e "- LLM_CHATTER_PASSPHRASE (generate at https://bcrypt.online/) default: password"
echo -e "- LLM_SERVER_HASH (please generate a fresh 32-character string: https://duckduckgo.com/?q=generate+password+32+characters)"
echo -e "- ANTHROPIC_API_KEY (from https://www.anthropic.com/api)"
echo -e "- DEEPSEEK_API_KEY (from https://platform.deepseek.com/api_keys)"
echo -e "- GOOGLE_API_KEY (from https://ai.google.dev/gemini-api/docs/billing)"
echo -e "- GROK_API_KEY (from https://console.x.ai/)"
echo -e "- OPENAI_API_KEY (from https://platform.openai.com/account/billing)"
# Create start scripts
echo -e "${GREEN}Creating start scripts...${NC}"
# Create server start script
cat > start-server.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
node index.js
EOF
chmod +x start-server.sh
# Create client start script
cat > start-client.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/client"
python3 -m http.server 8181
echo "Client running at http://localhost:8181"
EOF
chmod +x start-client.sh
echo -e "${GREEN}Installation complete!${NC}"
echo -e "Navigate to the installation: ${YELLOW}cd llm-chatter${NC}"
echo -e "To start the server: ${YELLOW}./start-server.sh${NC}"
echo -e "To start the client: ${YELLOW}./start-client.sh${NC}"
echo -e "Then open ${YELLOW}http://localhost:8181${NC} in your browser"
# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}Note: Ollama is required but not detected.${NC}"
    echo -e "Install Ollama with: ${YELLOW}curl -fsSL https://ollama.com/install.sh | sh${NC}"
    echo -e "Then add at least one model from: https://www.ollama.ai/library"
fi