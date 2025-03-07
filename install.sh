#!/bin/bash
set -e
# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
echo -e "${GREEN}Installing LLM-Chatter v0.0.9...${NC}"
echo -e ""
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
npm install > /dev/null 2>&1
# Prompt for .env configuration
echo -e "${YELLOW}Configuration needed:${NC}"
echo -e "Please configure your .env file at $(pwd)/.env with the following:"
echo -e ""
echo -e "- LLM_CHATTER_PASSPHRASE (generate at https://bcrypt.online/) default: password"
echo -e "- LLM_SERVER_HASH (please generate a fresh 32-character string: https://duckduckgo.com/?q=generate+password+32+characters)"
echo -e "- ANTHROPIC_API_KEY (from https://www.anthropic.com/api)"
echo -e "- DEEPSEEK_API_KEY (from https://platform.deepseek.com/api_keys)"
echo -e "- GOOGLE_API_KEY (from https://ai.google.dev/gemini-api/docs/billing)"
echo -e "- GROK_API_KEY (from https://console.x.ai/)"
echo -e "- OPENAI_API_KEY (from https://platform.openai.com/account/billing)"
# Create start scripts
echo -e ""
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
echo "Client running at http://localhost:8181"
python3 -m http.server 8181
EOF
chmod +x start-client.sh
# Create combined start script
cat > start-all.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "Starting server and client..."
echo ""
./start-server.sh > server.log 2>&1 &
echo "Server started"
./start-client.sh > client.log 2>&1 &
echo "Client started"
echo ""
echo "Both services are running in the background."
echo "View logs in server.log and client.log"
echo ""
echo "Access the application at http://localhost:8181"
echo ""
echo "To stop the services, run:"
echo "pkill -f 'node index.js'; pkill -f 'python3 -m http.server 8181'"
EOF
chmod +x start-all.sh
echo -e "${GREEN}Installation complete!${NC}"
echo -e ""
echo -e "Navigate to the installation: ${YELLOW}cd llm-chatter${NC}"
echo -e ""
echo -e "To start both server and client: ${YELLOW}./start-all.sh${NC}"
echo -e ""
echo -e "To start only the server: ${YELLOW}./start-server.sh${NC}"
echo -e "To start only the client: ${YELLOW}./start-client.sh${NC}"
echo -e ""
echo -e "Then open ${YELLOW}http://localhost:8181${NC} in your browser"
# Option to start services immediately
echo -e ""
read -p "Would you like to start the server and client now? (y/n): " START_NOW
if [[ $START_NOW == "y" || $START_NOW == "Y" ]]; then
    echo -e "${YELLOW}Default passphrase is 'password'${NC}"
    ./start-all.sh
fi