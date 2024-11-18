import { useState, useCallback } from "react";
import Hyphenated from "react-hyphen";
import { animated, Spring } from "react-spring";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import TextareaAutosize from "react-textarea-autosize";
import axios from "axios";
import copy from "copy-to-clipboard";
import { debounce } from "lodash";

import XClose from "./XClose";
import Voice from "./Voice";

const Chat = ({ numba, onClose, systemMessage, chatType, model, temperature, topp, langchainURL, listModels, serverURL }) => {
    let sysMsgs = [];
    let firstMeta = [];

    switch (chatType) {
        case "Anthropic":
        case "Anthropic (Voice)":
        case "Ollama: LangChain":
        case "Ollama: LangChain (Voice)":
        case "Google":
        case "Google (Voice)":
            sysMsgs = [];
            firstMeta = [];
            break;
        default: //OpenAI
            sysMsgs = [{ "role": "system", "content": systemMessage }];
            firstMeta = [["Starting Prompt", ""]];
            break;
    }

    const [chatInput, setChatInput] = useState("");
    const [isClicked, setIsClicked] = useState(false);
    const [isError, setIsError] = useState(false);
    const [sentOne, setSentOne] = useState(false);
    const [chatMessages, setChatMessages] = useState(sysMsgs);
    const [chatMessagesPlusMore, setChatMessagesPlusMore] = useState(sysMsgs);
    const [chatContext, setChatContext] = useState([]);
    const [media, setMedia] = useState(undefined);
    const [addSetting, setAddSetting] = useState(false);
    const [addedModels, setAddedModels] = useState([]);
    const [messageMetas, setMessageMetas] = useState(firstMeta);

    const fetchVoice = useCallback(async (input) => {
        const formData = new FormData();
        formData.append('audio', input);

        const startTime = Date.now();

        let response = await axios.post(
            serverURL + "/whisper-medusa", // End path
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );

        const endTime = Date.now();
        const durTime = ((endTime - startTime) / 1000).toFixed(2);

        return [response.data, durTime + "s"];
    })

    const fetchData = useCallback(async (input, modelThisFetch) => {
        let endPath = "";
        let sendPacket = {};

        switch (chatType) {
            case "OpenAI":
            case "OpenAI (Voice)":
                endPath = serverURL + "/openai";
                sendPacket = {
                    model: modelThisFetch,
                    messages: chatMessages.concat({ "role": "user", "content": [{ "type": "text", "text": input }] }),
                    temperature: parseFloat(temperature),
                    top_p: parseFloat(topp)
                };
                break;

            case "Grok":
            case "Grok (Voice)":
                endPath = serverURL + "/grok";
                sendPacket = {
                    model: modelThisFetch,
                    messages: chatMessages.concat({ "role": "user", "content": [{ "type": "text", "text": input }] }),
                    temperature: parseFloat(temperature),
                    top_p: parseFloat(topp)
                };
                break;

            case "Anthropic":
            case "Anthropic (Voice)":
                endPath = serverURL + "/anthropic";
                sendPacket = {
                    model: modelThisFetch,
                    messages: chatMessages.concat({ "role": "user", "content": [{ "type": "text", "text": input }] }),
                    temperature: parseFloat(temperature),
                    top_p: parseFloat(topp),
                    system: systemMessage,
                };
                break;

            case "Google":
            case "Google (Voice)":
                endPath = serverURL + "/google";
                sendPacket = {
                    model: modelThisFetch,
                    messages: chatMessages.concat({ "role": "user", "content": [{ "type": "text", "text": input }] }),
                    temperature: parseFloat(temperature),
                    top_p: parseFloat(topp),
                    system: systemMessage,
                };
                break;

            case "Ollama: LangChain":
            case "Ollama: LangChain (Voice)":
                endPath = serverURL + "/langchain";
                sendPacket = {
                    model: modelThisFetch,
                    input: input,
                    temperature: parseFloat(temperature),
                    topP: parseFloat(topp),
                    langchainURL: langchainURL
                };
                break;

            default: //Ollama
                endPath = serverURL + "/ollama";
                sendPacket = {
                    model: modelThisFetch,
                    prompt: input,
                    system: systemMessage,
                    context: chatContext,
                    options: { "temperature": parseFloat(temperature), "top_p": parseFloat(topp) },
                    stream: false,
                    keep_alive: 0
                };
                break;
        }

        try {
            const startTime = Date.now();

            let response = await axios.post(
                endPath,
                sendPacket,
                { headers: { "Content-Type": "application/json" } },
            );

            const endTime = Date.now();
            const durTime = ((endTime - startTime) / 1000).toFixed(2);

            //Might switch to text.trim().replace(/\n{3,}/g, '\n\n')
            const normalizeText = (text) => text.trim().replace(/\n+/g, '\n');
            let theEnd;

            switch (chatType) {
                case "OpenAI":
                case "OpenAI (Voice)":
                case "Grok":
                case "Grok (Voice)":
                    theEnd = normalizeText(response.data.choices[0].message.content);
                    break;
                case "Anthropic":
                case "Anthropic (Voice)":
                    theEnd = normalizeText(response.data.content[0].text);
                    break;
                case "Ollama: LangChain":
                case "Ollama: LangChain (Voice)":
                    theEnd = normalizeText(response.data.text);
                    break;
                case "Google":
                case "Google (Voice)":
                    theEnd = [{ type: "text", text: normalizeText(response.data) }];
                    break;
                default: // Handles Ollama and any other case
                    theEnd = normalizeText(response.data.response);
                    setChatContext(normalizeText(response.data.context));
                    break;
            }

            return [theEnd, durTime];
        } catch (error) {
            setIsError(true);

            let errorMessage = "An unexpected error occurred.";

            if (error.response.status === 503) {
                errorMessage = "Model Overloaded. Try again later.";
            }

            return [[{ type: "text", text: errorMessage }], 0];
        }
    });

    const handleInput = useCallback(debounce(async (input, isVoice = false) => {
        if (input) {
            setIsClicked(true);

            if (!isVoice) {
                setChatInput("");
            }

            const finalInput = isVoice ? await fetchVoice(await handleSave(input)) : [input, ""];

            try {
                const chatOut = await fetchData(finalInput[0], model);

                const chatNewMsg = chatMessages.concat(
                    { "role": "user", "content": [{ "type": "text", "text": finalInput[0] }] },
                    { "role": "assistant", "content": chatOut[0] }
                );
                setChatMessages(chatNewMsg);

                const newMeta = [["Prompt", finalInput[1]], [model, chatOut[1] + "s"]];
                setMessageMetas(prevMetas => prevMetas.concat(newMeta));

                setChatMessagesPlusMore(prevMessages => prevMessages.concat(
                    { "role": "user", "content": [{ "type": "text", "text": finalInput[0] }] },
                    { "role": "assistant", "content": chatOut[0] }
                ));

                if (addedModels.length === 0) {
                    setSentOne(true);
                    setIsClicked(false);
                    if (isVoice) setMedia();
                }
            } catch (error) {
                setIsClicked(false);
                console.error(error);
                setIsError(true);
            }

            for (const item of addedModels) {
                try {
                    const chatOutEach = await fetchData(finalInput[0], item);

                    const newAddedMeta = [[item, chatOutEach[1] + "s"]];
                    setMessageMetas(prevAddedMetas => prevAddedMetas.concat(newAddedMeta));

                    setChatMessagesPlusMore(prevMessages => prevMessages.concat(
                        { "role": "assistant", "content": chatOutEach[0] }
                    ));
                } catch (error) {
                    setIsClicked(false);
                    console.error(error);
                    setIsError(true);
                } finally {
                    setSentOne(true);
                    setIsClicked(false);
                    if (isVoice) setMedia();
                }
            }
        }
    }, 1000, { leading: true, trailing: false }));

    const handleChat = useCallback(() => handleInput(chatInput, false));
    const handleVoice = useCallback(() => handleInput(media, true));

    const handleSave = useCallback(async (url) => {
        const audioBlob = await fetch(url).then((r) => r.blob());
        const audioFile = new File([audioBlob], 'voice.wav', { type: 'audio/wav' });

        return audioFile;
    });

    const handleAddModel = useCallback((model) => {
        const newModelArray = [...addedModels, model];
        setAddedModels(newModelArray);
    });

    const handleDeleteModel = useCallback((model) => {
        const index = addedModels.indexOf(model);

        if (index !== -1) { // Check if the model exists in the array
            const newModelArray = [
                ...addedModels.slice(0, index), // All models before the model to delete
                ...addedModels.slice(index + 1) // All models after the model to delete
            ];
            setAddedModels(newModelArray);
        }
    });

    const handleModelToggle = useCallback(() => {
        setAddSetting(!addSetting);
    });


    const handleEnterKey = useCallback((event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleChat();
        }
    });

    const chatHandler = () => event => {
        const value = event.target.value;
        setChatInput(value);
    }

    const handleCopy = useCallback((e) => {
        e.preventDefault();
        const selectedText = document.getSelection().toString();

        //Remove soft hyphens
        const textContent = selectedText.replace(/\xAD/g, '');

        navigator.clipboard.writeText(textContent);
    });

    const copyClick = useCallback((value) => {
        if (typeof value === 'string') {
            copy(value);
        }
    });

    const getContentText = useCallback((content) => {
        if (Array.isArray(content)) {
            // If content is an array, access the text property of the first element
            return content[0]?.text || '';
        } else {
            // If content is a string, return it directly
            return content || '';
        }
    });

    const CodeBlock = useCallback(({ inline, className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
            <pre className={`border p-4 rounded bg-nosferatu-200 text-black text-xs language-${match[1]} ${className} overflow-auto`}>
                <code {...props} className={`${className} whitespace-pre-wrap break-all`}>
                    {children}
                </code>
            </pre>
        ) : (
            <code className={`${className} bg-nosferatu-200 text-black rounded p-1 whitespace-pre-wrap break-all`} {...props}>
                {children}
            </code>
        );
    });

    return (
        <Spring
            from={{ opacity: 0 }}
            to={[
                { opacity: 1 }
            ]}
            delay={80}>
            {styles => (
                <animated.div style={styles} className="min-w-[99%] self-start mt-2 mb-2 mb-1 inline p-2 bg-nosferatu-200 rounded-3xl bg-gradient-to-tl from-nosferatu-500 shadow-sm">

                    {/* Chat ID number, Type of Model, X-Close button */}
                    <table className="min-w-[99%] border-separate border-spacing-y-2 border-spacing-x-2">
                        <tbody>
                            <tr>
                                <td colSpan="2" className="pb-4 tracking-wide text-4xl text-center font-bold text-black">
                                    <span className="mr-6">#{numba}</span>
                                    <i className="fa-regular fa-comments mr-6 text-black"></i>
                                    {chatType}
                                </td>
                                <td>
                                    <XClose onClose={onClose} />
                                </td>
                            </tr>

                            {/* Two model types store the System message differently */}
                            {(chatType.includes("Anthropic") || chatType.includes("Google")) &&
                                <tr>
                                    <td onCopy={handleCopy} colSpan="3" className="py-3 p-3 bg-morbius-300 font-sans rounded-xl text-black-800 text-md whitespace-pre-wrap">
                                        <div className="mb-3 grid grid-cols-3">
                                            <span className="font-bold text-xl text-aro-900">Starting Prompt</span>
                                            <span></span>
                                            <span className="text-right cursor-copy">
                                                <i onClick={() => copyClick(systemMessage)} className="text-aro-900 m-2 fa-solid fa-copy fa-2x cursor-copy shadow-xl hover:shadow-dracula-900"></i>
                                            </span>
                                        </div>
                                        <div>
                                            <Hyphenated>{systemMessage}</Hyphenated>
                                        </div>
                                    </td>
                                </tr>
                            }

                            {/* LangChain doesn't take System messages, so we show the Embed URL here instead */}
                            {chatType.includes("LangChain") &&
                                <tr>
                                    <td onCopy={handleCopy} colSpan="3" className="py-3 p-3 bg-morbius-300 font-sans rounded-xl text-black-800 text-md whitespace-pre-wrap">
                                        <div className="mb-3 grid grid-cols-3">
                                            <span className="font-bold text-xl text-aro-900">Embed URL</span>
                                            <span></span>
                                            <span className="text-right cursor-copy">
                                                <i onClick={() => copyClick(langchainURL)} className="text-aro-900 m-2 fa-solid fa-copy fa-2x cursor-copy shadow-xl hover:shadow-dracula-900"></i>
                                            </span>
                                        </div>
                                        <div>
                                            <Hyphenated><a className="underline" alt={langchainURL} target="_blank" rel="noopener noreferrer" href={langchainURL}>{langchainURL}</a></Hyphenated>
                                        </div>
                                    </td>
                                </tr>
                            }

                            {/* Prompts and All Models' Responses */}
                            {chatMessagesPlusMore.map((obj, index) => {
                                const contentText = getContentText(obj.content);
                                return (
                                    <tr key={index}>
                                        <td onCopy={handleCopy} colSpan="3" className={obj.role === "user" || obj.role === "system" ?
                                            "py-3 p-3 bg-morbius-300 font-sans rounded-xl text-black-800 text-md whitespace-pre-wrap" :
                                            "py-3 whitespace-pre-wrap p-3 bg-nosferatu-100 font-mono rounded-xl text-vanHelsing-200 text-sm"}>
                                            <div className="mb-3 grid grid-cols-3">
                                                <span className="font-bold text-xl text-aro-900">{messageMetas[index][0]}</span>
                                                <span className="text-center text-sm text-aro-900">{messageMetas[index][1]}</span>
                                                <span className="text-right">
                                                    <i onClick={() => copyClick(contentText)} className="text-aro-900 m-2 fa-solid fa-copy fa-2x cursor-pointer shadow-xl hover:shadow-dracula-900"></i>
                                                </span>
                                            </div>
                                            <div>
                                                <Hyphenated>
                                                    {obj.role === "user" || obj.role === "system" ?
                                                        contentText :
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{ code: CodeBlock }}
                                                            className="markdown text-aro-900"
                                                        >
                                                            {contentText}
                                                        </ReactMarkdown>
                                                    }
                                                </Hyphenated>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}

                            {/* Voice component */}
                            {(chatType.includes("(Voice")) &&
                                <tr>
                                    <td colSpan="3"><Voice setMedia={setMedia} handleVoice={handleVoice} media={media} isClicked={isClicked} /></td>
                                </tr>
                            }

                            {/* Regular text chat input box, and the Send button */}
                            {(!isError && ((!chatType.includes("LangChain") || !sentOne))) &&
                                <>
                                    {(!(chatType.includes("(Voice"))) &&
                                        <tr>
                                            <td colSpan="2">
                                                <TextareaAutosize
                                                    autoFocus
                                                    onKeyDown={handleEnterKey}
                                                    minRows="3"
                                                    maxRows="15"
                                                    className="placeholder:text-6xl placeholder:italic mt-3 hover:bg-nosferatu-400 p-4 min-w-full bg-nosferatu-100 text-sm font-mono text-black rounded-xl"
                                                    placeholder="Chat"
                                                    onChange={chatHandler()}
                                                    value={chatInput}
                                                />
                                            </td>
                                            <td className="items-baseline justify-evenly text-center align-middle text-4xl">
                                                <i
                                                    onClick={!isClicked ? () => handleChat() : null}
                                                    className={isClicked ? "text-dracula-900 mt-4 m-2 fa-solid fa-hat-wizard fa-2x cursor-pointer hover:text-dracula-100" : "text-blade-300 mt-4 m-2 fa-solid fa-message fa-2x cursor-pointer hover:text-vanHelsing-700"}
                                                />
                                            </td>
                                        </tr>
                                    }
                                </>
                            }

                            {/*  Settings */}
                            <tr><td colSpan={3}><i className="fa-solid fa-gear text-4xl text-aro-800 text-center mb-2 ml-8 mt-4"></i></td></tr>
                            <tr className="align-top">

                                {/*  Model info */}
                                <td className="w-3/5 bg-buffy-200 rounded-xl bg-gradient-to-tl from-buffy-500 p-2">
                                    <table className="min-w-full"><tbody>
                                        <tr>
                                            <td className="w-1/6"><i className="fa-solid fa-splotch text-2xl text-dracula-500 ml-1"></i></td>
                                            <td className="w-5/6 min-w-full">
                                                <p className="mb-2">{addedModels.length > 0 ? <b>Models:</b> : <b>Model:</b>}</p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td></td>
                                            <td>
                                                <ul>
                                                    <li><i className="fa-solid fa-caret-right text-sm text-dracula-500"></i> {model}</li>
                                                    {addedModels.map((model, index) => (
                                                        <li key={index}><i className="fa-solid fa-caret-right text-sm text-dracula-500" ></i> <span onClick={() => handleDeleteModel(model)} className="hover:underline" >{model}</span></li>
                                                    ))}
                                                </ul>
                                            </td>
                                        </tr>
                                    </tbody></table>
                                </td>

                                {/* temperature info */}
                                <td className="w-1/5 bg-vanHelsing-200 rounded-xl bg-gradient-to-tl from-vanHelsing-500">
                                    <table className="mt-2"><tbody><tr className="align-top">
                                        <td className="w-1/6"><i className="fa-solid fa-temperature-three-quarters text-2xl text-buffy-500"></i></td>
                                        <td className="w-5/6 p-1"><b>temperature:</b><br /><i className="fa-solid fa-caret-right text-sm text-buffy-900 mr-1"></i> {temperature}</td>
                                    </tr></tbody></table>
                                </td>

                                {/* top-p info */}
                                <td className="w-1/5 bg-cullen-200 rounded-xl bg-gradient-to-tl from-cullen-500">
                                    <table className="mt-2"><tbody><tr className="align-top">
                                        <td className="w-1/6"><i className="fa-brands fa-react text-2xl text-vanHelsing-900"></i></td>
                                        <td className="w-5/6 p-1"><b>top-p:</b><br /><i className="fa-solid fa-caret-right text-sm text-vanHelsing-900 mr-1"></i> {topp}</td>
                                    </tr></tbody></table>
                                </td>
                            </tr>

                            {/* Add Models interface */}
                            <tr className="align-top">
                                <td className="w-3/5">
                                    {(!isError && ((!chatType.includes("LangChain") || !sentOne))) &&
                                        <>
                                            {addSetting ?
                                                <div className="bg-blade-100 rounded-xl pb-2 pl-2">
                                                    <table className="min-w-full"><tbody>
                                                        <tr>
                                                            <td className="w-1/6"><i className="cursor-pointer mb-3 mt-2 fa-solid fa-plus text-blade-800 text-3xl hover:text-marcelin-900 fa-rotate-by" style={{ '--fa-rotate-angle': '45deg' }} onClick={handleModelToggle}></i></td>
                                                            <td className="w-5/6 min-w-full">
                                                                <span className="font-bold hover:underline cursor-pointer hover:text-marcelin-900" onClick={handleModelToggle}>Add Model:</span>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td></td>
                                                            <td>
                                                                <ul>
                                                                    {listModels.map((model, index) => (
                                                                        <li key={index}>
                                                                            <span className="text-sm cursor-pointer hover:text-aro-500 hover:underline hover:font-bold" onClick={() => handleAddModel(model.name)}><i className="fa-solid fa-caret-right text-sm text-blade-700 mr-1"></i>{model.name}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </td>
                                                        </tr>
                                                    </tbody></table>
                                                </div>


                                                :
                                                <div className="bg-blade-100 rounded-xl mb-1"><i className="cursor-pointer m-3 ml-6 fa-solid fa-plus text-2xl hover:text-blade-800" onClick={handleModelToggle}></i> <span className="cursor-pointer hover:underline hover:text-blade-800" onClick={handleModelToggle}>Add Model</span></div>
                                            }
                                        </>
                                    }
                                </td>

                                {/* LangChain info */}
                                <td colSpan={2} className="w-2/5">
                                    {chatType.includes("LangChain") &&
                                        <div className="bg-dracula-300 rounded-xl p-6">
                                            <b>LangChain Embed:</b><br />
                                            <i className="fa-solid fa-caret-right text-sm text-dracula-300 mr-1"></i><a className="underline hover:font-bold" href={langchainURL} alt={langchainURL} target="_blank" rel="noopener noreferrer">Link</a>
                                        </div>
                                    }
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </animated.div>
            )}
        </Spring>
    )
};

export default Chat;