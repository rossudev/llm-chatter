import { useState } from 'react';
import axios from "axios";
import TextareaAutosize from 'react-textarea-autosize';
import XClose from "./XClose";
import Voice from "./Voice";
import { debounce } from 'lodash';
import copy from "copy-to-clipboard";
import Hyphenated from 'react-hyphen';
import { animated, Spring } from "react-spring";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const Chat = ({numba, onClose, systemMessage, responseType, model, temperature, topp, userID, apiKey, langchainURL}) => {

    let sysMsgs = [];
    switch (responseType) {
        case "Ollama: LangChain (Text)" :
            sysMsgs = [];
            break;
        case "Ollama: LangChain (Voice)" :
            sysMsgs = [];
            break;
        default :
            sysMsgs = [{"role": "system", "content": systemMessage}];
            break;
    }

    const [chatInput, setChatInput] = useState("");
    const [isClicked, setIsClicked] = useState(false);
    const [isError, setIsError] = useState(false);
    const [sentOne, setSentOne] = useState(false);
    const [chatMessages, setChatMessages] = useState(sysMsgs);
    const [chatContext, setChatContext] = useState([]);
    const [chatDuration, setChatDuration] = useState(0.0);
    const [media, setMedia] = useState();

    const fetchVoice = async (input) => {
        const formData = new FormData();
        formData.append('audio', input);
    
        let response = await axios.post(
            "http://localhost:8080/whisper-medusa", // End path
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        //console.log(response.data);
        return response.data;
    }

    const fetchData = async (input) => {
        let endPath = "";
        let sendPacket = {};
        let sendHeaders = {};
        const bearer = "Bearer " + apiKey;
        const contType = { "Content-Type": "application/json" };

        switch (responseType) {
          case "OpenAI: Chat (Text)" :
              endPath = "https://api.openai.com/v1/chat/completions";
              sendPacket = {
                  model: model,
                  messages: chatMessages.concat({ "role": "user", "content": [ { "type": "text", "text": input } ] }),
                  temperature: parseFloat(temperature),
                  top_p: parseFloat(topp),
                  user: userID
              };
              sendHeaders = {
                headers: {
                  "Content-Type": "application/json",
                  'Authorization': bearer
                }
              };
          break;
          case "OpenAI: Chat (Voice)" :
              endPath = "https://api.openai.com/v1/chat/completions";
              sendPacket = {
                  model: model,
                  messages: chatMessages.concat({ "role": "user", "content": [ { "type": "text", "text": input } ] }),
                  temperature: parseFloat(temperature),
                  top_p: parseFloat(topp),
                  user: userID
              };
              sendHeaders = {
                headers: {
                  "Content-Type": "application/json",
                  'Authorization': bearer
                }
              };
          break;
          case "Ollama: LangChain (Text)" :
              endPath = "http://localhost:8080/langchain";
              sendPacket = {
                  model: model,
                  input: input,
                  temperature: parseFloat(temperature),
                  topP: parseFloat(topp),
                  langchainURL: langchainURL
              };
              sendHeaders = { headers: contType };
          break;
          case "Ollama: LangChain (Voice)" :
              endPath = "http://localhost:8080/langchain";
              sendPacket = {
                  model: model,
                  input: input,
                  temperature: parseFloat(temperature),
                  topP: parseFloat(topp),
                  langchainURL: langchainURL
              };
              sendHeaders = { headers: contType };
          break;
          default :
              endPath = "http://localhost:11434/api/generate";
              sendPacket = {
                  model: model,
                  prompt: input,
                  system: systemMessage,
                  context: chatContext,
                  options: {"temperature": parseFloat(temperature), "top_p": parseFloat(topp)},
                  stream: false,
                  keep_alive: 0
              };
              sendHeaders = { headers: contType };
          break;
        }

        try {
            const startTime = Date.now();

            let response = await axios.post(
                endPath,
                sendPacket,
                sendHeaders
            );
            
            const endTime = Date.now();
            const durTime = ((endTime - startTime) / 1000).toFixed(2);
            setChatDuration(durTime);

            let theEnd = "";

            switch (responseType) {
                case "OpenAI: Chat (Text)" : 
                    theEnd = response.data.choices[0].message.content;
                    break;
                case "OpenAI: Chat (Voice)" : 
                    theEnd = response.data.choices[0].message.content;
                    break;
                case "Ollama: LangChain (Text)" : 
                    theEnd = response.data.text.trim();
                    break;
                case "Ollama: LangChain (Voice)" : 
                    theEnd = response.data.text.trim();
                    break;
                default : 
                    theEnd = response.data.response.trim();
                    setChatContext(response.data.context);
                    break;
              }
  
              return theEnd;
        } catch (error) {
          console.log(error);
          setIsError(true);
          return "Error: " + error.code;
        }
    };

    const handleChat = debounce(async () => {
        if ( chatInput ) {
            setIsClicked(true);
            setChatInput("");
            try {
                const chatOut = await fetchData(chatInput);
                setSentOne(true);
                setIsClicked(false);
                setChatMessages(chatMessages.concat({ "role": "user", "content": [ { "type": "text", "text": chatInput } ] }, { "role": "assistant", "content": chatOut }));
            } catch (error) {
                setIsClicked(false);
                console.error(error);
                setIsError(true);
                setChatMessages(chatMessages.concat({ "role": "user", "content": [ { "type": "text", "text": chatInput } ] }, { "role": "assistant", "content": "Error: " + error }));
            }
        }
    }, 1000, { leading: true, trailing: false });

    const handleSave = async (url) => {
        const audioBlob = await fetch(url).then((r) => r.blob());
        const audioFile = new File([audioBlob], 'voice.wav', { type: 'audio/wav' });
        return audioFile;
    };

    const handleVoice = debounce(async () => {
        if ( media ) {
            setIsClicked(true);
            try {
                const audioFiler = await handleSave(media);
                console.log(audioFiler);
                const voiceOut = await fetchVoice(audioFiler);
                console.log(voiceOut);
                const chatOut = await fetchData(voiceOut);
                console.log(chatOut);

                setSentOne(true);
                setIsClicked(false);
                setChatMessages(chatMessages.concat({ "role": "user", "content": [ { "type": "text", "text": voiceOut } ] }, { "role": "assistant", "content": chatOut }));
                setMedia();
            } catch (error) {
                setIsClicked(false);
                console.error(error);
                setIsError(true);
                setChatMessages(chatMessages.concat({ "role": "user", "content": [ { "type": "text", "text": "Error" } ] }, { "role": "assistant", "content": "Error: " + error }));
            }
        }
    }, 1000, { leading: true, trailing: false });
     
    const handleEnterKey = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleChat();
        }
    };

    const chatHandler = () => event => {
        const value = event.target.value;
        setChatInput(value);
    };

    const handleCopy = (e) => {
        e.preventDefault();
        const selectedText = document.getSelection().toString();

        //Remove soft hyphens
        const textContent = selectedText.replace(/\xAD/g, '');

        navigator.clipboard.writeText(textContent);
    };

    const copyClick = (value) => {
        if (typeof value === 'string') {
          copy(value);
        }
    };

    const getContentText = (content) => {
        if (Array.isArray(content)) {
            // If content is an array, access the text property of the first element
            return content[0]?.text || '';
        } else {
            // If content is a string, return it directly
            return content || '';
        }
    };

    const CodeBlock = ({ inline, className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
          <pre className={`border p-4 rounded bg-gray-800 text-white text-xs language-${match[1]} ${className} overflow-auto`}>
            <code {...props} className={`${className} whitespace-pre-wrap break-all`}>
              {children}
            </code>
          </pre>
        ) : (
          <code className={`${className} bg-gray-800 text-white rounded p-1 whitespace-pre-wrap break-all`} {...props}>
            {children}
          </code>
        );
    };

    return (
        <Spring
        from={{ opacity: 0 }}
        to={[
          { opacity: 1 }
        ]}
        delay={80}>
        {styles => (
          <animated.div style={styles} className="min-w-full self-start mt-1 mb-1 inline p-6 bg-nosferatu-200 rounded-3xl bg-gradient-to-tl from-nosferatu-500 shadow-2xl">
            <table className="border-separate border-spacing-y-2 border-spacing-x-2">
                <tbody>
                    <tr>
                        <td colSpan="2" className="pb-4 tracking-wide text-4xl text-center font-bold text-nosferatu-900">
                            <span className="mr-6">#{numba}</span>
                            <i className="fa-regular fa-comments mr-6 text-nosferatu-800"></i>
                            {responseType}
                        </td>
                        <td>
                            <XClose onClose={onClose} />
                        </td>
                    </tr>
                    <tr>
                        <td className="w-3/5 bg-buffy-200 rounded-xl bg-gradient-to-tl from-buffy-500 shadow-2xl p-1">
                            <table><tr>
                                <td className="w-1/6"><i class="fa-solid fa-splotch text-2xl text-dracula-500 ml-2"></i></td>
                                <td className="w-5/6 p-3"><b>Model:</b><br/>{model}</td>
                            </tr></table>
                        </td>

                        <td className="w-1/5 bg-vanHelsing-200 rounded-xl bg-gradient-to-tl from-vanHelsing-500 shadow-2xl p-1">
                            <table><tr>
                                <td className="w-1/6"><i class="fa-solid fa-temperature-three-quarters text-2xl text-buffy-500 ml-2"></i></td>
                                <td className="w-5/6 p-3"><b>temperature:</b><br/>{temperature}</td>
                            </tr></table>
                        </td>

                        <td className="w-1/5 bg-cullen-200 rounded-xl bg-gradient-to-tl from-cullen-500 shadow-2xl p-1">
                            <table><tr>
                                <td className="w-1/6"><i class="fa-brands fa-react text-2xl text-vanHelsing-900 ml-2"></i></td>
                                <td className="w-5/6 p-3"><b>top-p:</b><br/>{topp}</td>
                            </tr></table>
                        </td>
                    </tr>
                    { responseType.includes("LangChain") &&
                        <tr>
                            <td colSpan="3"><b>Embed Source:</b><br/>
                            <a className="underline" href={langchainURL} alt={langchainURL} target="_blank" rel="noopener noreferrer">Link</a></td>
                        </tr>
                    }
                    {chatMessages.map((obj, index) => { 
                        const contentText = getContentText(obj.content);

                        return (
                            <tr key={index}>
                                <td onCopy={handleCopy} colSpan="3" className={obj.role === "user" || obj.role === "system" ? 
                                    "py-3 p-3 bg-morbius-300 font-sans rounded-xl text-black-800 text-sm ring-1 whitespace-pre-wrap" : 
                                    "py-3 whitespace-pre-wrap p-3 bg-nosferatu-800 font-mono rounded-xl text-vanHelsing-200 text-sm ring-1"}>
                                    <div className="items-end justify-end text-right mb-3">
                                        <i onClick={() => copyClick(contentText)} className="m-2 fa-solid fa-copy fa-2x cursor-pointer shadow-xl hover:shadow-dracula-900"></i>
                                    </div>
                                    <div>
                                        <Hyphenated>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code: CodeBlock
                                                }}
                                                className="markdown"
                                            >
                                                {contentText}
                                            </ReactMarkdown>
                                        </Hyphenated>
                                    </div>
                                </td>
                            </tr>
                        )
                    })}

                    { (responseType.includes("(Voice")) &&
                        <tr>
                            <td colSpan="3"><Voice setMedia={setMedia} handleVoice={handleVoice} media={media} isClicked={isClicked} /></td>
                        </tr>
                    }
                    
                    { (!isError && ((!responseType.includes("LangChain") || !sentOne))) && 
                        <>
                            {sentOne &&
                                <tr>
                                    <td colSpan="3">
                                        <span><b>Process time:</b> {chatDuration} seconds</span>
                                    </td>
                                </tr>
                            }
                            {(!(responseType.includes("(Voice")))&&
                                <tr>
                                    <td colSpan="2">
                                        <TextareaAutosize 
                                            autoFocus 
                                            onKeyDown={handleEnterKey} 
                                            minRows="3" 
                                            maxRows="15" 
                                            className="placeholder:text-6xl placeholder:italic mt-3 hover:bg-nosferatu-400 p-4 min-w-full bg-nosferatu-100 text-sm font-mono text-black ring-1 hover:ring-2 ring-vonCount-900 rounded-xl" 
                                            placeholder="Chat" 
                                            onChange={chatHandler()} 
                                            value={chatInput} 
                                        />
                                    </td>
                                    <td className="items-baseline justify-evenly text-center align-middle text-4xl">
                                        <i 
                                            onClick={ !isClicked ? () => handleChat() : null } 
                                            className={ isClicked ? "text-dracula-900 mt-4 m-2 fa-solid fa-hat-wizard fa-2x cursor-pointer hover:text-dracula-100" : "text-blade-300 mt-4 m-2 fa-solid fa-message fa-2x cursor-pointer hover:text-blade-900" }
                                        />
                                    </td>
                                </tr>
                            }
                        </>
                    }
                </tbody>
            </table>
            </animated.div>
          )}
        </Spring>
    )
};

export default Chat;
