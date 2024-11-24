import { useEffect, useState, useCallback, createContext, React } from "react";
import { animated, Spring } from "react-spring";
import TextareaAutosize from "react-textarea-autosize";
import axios from "axios";
import debounce from "lodash/debounce";
import Chat from "./components/Chat";
export const dataContext = createContext();

function App() {
  const openAImodels = [
    { name: "gpt-4o" },
    { name: "gpt-4o-mini" },
    { name: "gpt-4-turbo" },
    { name: "gpt-4" },
    { name: "gpt-3.5-turbo" },

    //Not yet supported.
    //{ name: "gpt-4o-realtime-preview" },
    //{ name: "o1-preview" },
    //{ name: "o1-mini" },
  ];

  const anthropicAImodels = [
    { name: "claude-3-5-sonnet-20241022" },
    { name: "claude-3-5-haiku-20241022" },
    { name: "claude-3-opus-20240229" },
    { name: "claude-3-sonnet-20240229" },
    { name: "claude-3-haiku-20240307" },
  ];

  const googleAImodels = [
    { name: "gemini-1.5-pro" },
    { name: "gemini-1.5-flash" },
    { name: "gemini-1.5-flash-8b" },
  ];

  const grokAImodels = [
    { name: "grok-beta" },
  ];

  //Which model type is chosen by default
  const [chatType, setChatType] = useState("OpenAI");
  const [model, setModel] = useState(openAImodels[0]);
  const [listModels, setListModels] = useState(openAImodels);

  //Other defaults
  //const [serverURL, setServerURL] = useState("https://x.rossu.dev");
  const [serverURL, setServerURL] = useState("http://localhost:8080");
  const [sysMsg, setSysMsg] = useState("Let's work this out in a step by step way to be sure we have the right answer.");
  const [temperature, setTemperature] = useState("0.8");
  const [topp, setTopp] = useState("1.0");
  const [langchainURL, setLangchainURL] = useState("https://");

  //Don't touch the rest of these.
  const [localModels, setLocalModels] = useState([]);
  const [componentList, setComponentList] = useState([]);
  const [advancedSetting, setAdvancedSetting] = useState(false);
  const [serverCheck, setServerCheck] = useState(false);
  const [urlValid, setUrlValid] = useState(false);
  const [chatCount, setChatCount] = useState(1);
  const [chosenAnthropic, setChosenAnthropic] = useState(anthropicAImodels[0]);
  const [chosenGoogle, setChosenGoogle] = useState(googleAImodels[0]);
  const [chosenGrokAI, setChosenGrokAI] = useState(grokAImodels[0]);
  const [chosenOllama, setChosenOllama] = useState(localModels[0]);
  const [chosenOpenAI, setChosenOpenAI] = useState(openAImodels[0]);

// Check if the arrays contains elements before adding related keys
  const modelOptions = {};
  if (anthropicAImodels.length > 0) {
    modelOptions["Anthropic"] = anthropicAImodels;
  }
  if (googleAImodels.length > 0) {
    modelOptions["Google"] = googleAImodels;
  }
  if (grokAImodels.length > 0) {
    modelOptions["Grok"] = grokAImodels;
  }

  if (localModels.length > 0) {
    modelOptions["Ollama"] = localModels;
    modelOptions["Ollama - LangChain"] = localModels;
  }
  if (openAImodels.length > 0) {
    modelOptions["OpenAI"] = openAImodels;
  }

  const makeNewChat = useCallback((typeOfComponent) => {
    let response = "OpenAI";
    let inputDescriptor = `${typeOfComponent}`;

    const responseMap = {
      "Anthropic": `Anthropic${inputDescriptor}`,
      "Google": `Google${inputDescriptor}`,
      "Grok": `Grok${inputDescriptor}`,
      "Ollama": `Ollama${inputDescriptor}`,
      "Ollama - LangChain": `Ollama: LangChain${inputDescriptor}`,
      "OpenAI": `OpenAI${inputDescriptor}`,
    };

    // Default to an empty string if chatType doesn't match
    response = responseMap[chatType] || "";

    const newChat = {
      id: Date.now(),
      closeID: Date.now(),
      numba: chatCount,
      systemMessage: sysMsg,
      chatType: response,
      model: model.name,
      temperature: temperature,
      topp: topp,
      localModels: localModels,
      langchainURL: langchainURL,
      listModels: listModels,
      serverURL: serverURL,
      modelOptions: modelOptions,
    };

    setComponentList([...componentList, newChat]);
    setChatCount(chatCount + 1);
  });

  //Ping the backend server for a list of Ollama locally downloaded list of models
  const checkModels = useCallback(debounce(async () => {
    try {
      const theModels = await axios.post(
        serverURL + "/getmodels",
        {},
        { headers: { "Content-Type": "application/json" } },
      );
      let allModels = theModels.data;

      allModels.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();

        return nameA.localeCompare(nameB);
      });

      setLocalModels(allModels);

      const modelMapping = {
        "Anthropic": anthropicAImodels,
        "Google": googleAImodels,
        "Grok": grokAImodels,
        "OpenAI": openAImodels,
      };
      setModel(modelMapping[chatType]?.[0] || allModels[0]);

      setChosenOllama({ name: allModels[0].name });
    } catch (error) { console.log(error); }
  }, 250), [serverURL]);

  //Populate model list for Ollama
  useEffect(() => {
    checkModels();
  }, [checkModels]);

  //Ensure back-end node.js server is online with a ping every second
  useEffect(() => {
    const checkBackServer = debounce(async () => {
      try {
        const response = await axios.post(serverURL + "/check");
        const backServerCheck = response?.data || undefined;
  
        // Only update state if the value has changed
        if (backServerCheck !== serverCheck) {
          setServerCheck(backServerCheck);
        }
  
        // Update localModels only if backend is available and list is empty
        if (backServerCheck && localModels.length === 0) {
          checkModels();
        }
      } catch (error) {
        if (serverCheck !== false) {
          setServerCheck(false);
        }
      }
    }, 250);
  
    // Call immediately and then set interval
    checkBackServer();
    const intervalId = setInterval(checkBackServer, 1000);
  
    return () => clearInterval(intervalId);
  }, [serverURL, serverCheck, localModels, checkModels]);

  //Event Handlers

  const handleChatTypeChange = useCallback((e) => {
    const selectedChatType = e.target.value;
    setChatType(selectedChatType);

    const modelMapping = {
      "Anthropic": { modelState: chosenAnthropic, list: anthropicAImodels },
      "Google": { modelState: chosenGoogle, list: googleAImodels },
      "Grok": { modelState: chosenGrokAI, list: grokAImodels },
      "OpenAI": { modelState: chosenOpenAI, list: openAImodels },
      "default": { modelState: chosenOllama, list: localModels }, //Ollama
    };

    const selected = modelMapping[selectedChatType] || modelMapping["default"];

    // Attempt to restore previous model choice, fallback to the first model if undefined.
    const previousSelectedModel = selected.modelState || selected.list[0];

    setModel(previousSelectedModel);
    setListModels(selected.list);
  }, [chosenOpenAI, chosenAnthropic, chosenGoogle, chosenGrokAI, chosenOllama, localModels]);


  const handleModelChange = useCallback((e) => {
    const modelObj = { name: e.target.value };
    setModel(modelObj);

    const setChosenMapping = {
      "Anthropic": setChosenAnthropic,
      "Google": setChosenGoogle,
      "Grok": setChosenGrokAI,
      "Ollama": setChosenOllama,
      "OpenAI": setChosenOpenAI,
    };

    (setChosenMapping[chatType] || setChosenOllama)(modelObj);
  }, [chatType]);

  const handleSysMsgChange = useCallback((e) => {
    setSysMsg(e.target.value);
  }, []);

  const handleToppChange = useCallback((e) => {
    setTopp(e.target.value);
  }, []);

  const handleTempChange = useCallback((e) => {
    setTemperature(e.target.value);
  }, []);

  const handleURLChange = useCallback((e) => {
    setServerURL(e.target.value);
  }, []);

  const handleCheckboxChange = useCallback((e) => {
    setAdvancedSetting(e.target.checked);
  }, []);

  const handleLangchainURLChange = useCallback((e) => {
    setLangchainURL(e.target.value);
    setUrlValid(isValidURL(e.target.value));
  }, []);

  // If input contains whitespace, return false.
  const isValidURL = useCallback((input) => {
    if (/\s/.test(input)) {
      return false;
    }

    const res = input.match(/(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi);
    return (res !== null);
  });

  //Shorten excessively long model names for the Settings drop-down list
  const truncateString = useCallback((str, length) => {
    if (str.length > length) {
      return str.substring(0, length) + '...';
    }
    return str;
  });

  return (
    <dataContext.Provider value={{ componentList, setComponentList, chatCount, setChatCount, chosenAnthropic, chosenGoogle, chosenGrokAI, chosenOllama, chosenOpenAI }}>
      <div>
        <Spring
          from={{ opacity: 0 }}
          to={[
            { opacity: 1 }
          ]}
          delay={400}>
          {styles => (
            <animated.div style={styles} className="min-w-full text-aro-100 place-self-center cursor-default bg-vonCount-600 bg-gradient-to-tl from-vonCount-700 rounded-3xl font-bold p-2 flex items-center justify-center">

            { /* Settings box */ }
              <div className="w-full">
                <table className="min-w-full text-black">
                  <tbody>
                    <tr>
                      <td className="2xl:w-[10%] xl:w-[14%] lg:w-[18%] md:w-[22%] sm:w-[26%] text-5xl text-center">
                        <i className="fa-solid fa-gear text-5xl text-aro-300 text-center mb-4"></i>
                      </td>
                      <td className="2xl:w-[90%] xl:w-[86%] lg:w-[82%] md:w-[78%] sm:w-[74%] text-3xl tracking-normal text-center items-center font-bold text-black cursor-context-menu">
                        <input className="hidden" type="checkbox" name="advancedSetting" id="advancedSettings" checked={advancedSetting} onChange={handleCheckboxChange} />
                        <label className="cursor-context-menu leading-6" htmlFor="advancedSettings">
                          <span className="mr-2 mb-4 flex items-center text-black">
                            <i className={`text-aro-200 text-5xl fa-solid fa-bars ml-20 p-4 hover:text-marcelin-900 ${advancedSetting ? 'fa-bars text-blade-500 fa-rotate-270' : 'hover:text-dracula-100 ml-20'}`}></i>
                            Settings
                          </span>
                        </label>
                      </td>
                    </tr>

                    { /* Configure NodeJS server URL */ }
                    {!serverCheck &&
                      <tr>
                        <td className="pb-4 pr-4">Server URL:</td>
                        <td className="pb-4">
                          <TextareaAutosize minRows="1" maxRows="2" className="w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-sans text-black rounded-xl" placeholder="http://localhost:8080" onChange={(e) => handleURLChange(e)} value={serverURL} />
                        </td>
                      </tr>
                    }

                    { /* NodeJS server check display */ }
                    <tr>
                      <td className="pb-4 pr-4">Server Check:</td>
                      <td className="pb-4 font-sans">
                        {serverCheck ?
                          <p>Node.js Server: <span className="text-blade-700">Online</span><span className="ml-6">{serverURL}</span></p>
                          :
                          <><p>Node.js Server: <span className="text-marcelin-900">Offline</span> <i className="fa-solid fa-triangle-exclamation text-marcelin-900 text-2xl"></i></p></>
                        }
                      </td>
                    </tr>

                    { /* System Message */ }
                    {!chatType.includes("LangChain") &&
                      <tr>
                        <td className="pb-4 pr-4">
                          Starting Prompt:
                        </td>
                        <td>
                          <TextareaAutosize minRows="3" maxRows="5" className="min-w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-sans text-black rounded-xl" placeholder="'System' Message" onChange={(e) => handleSysMsgChange(e)} value={sysMsg} />
                        </td>
                      </tr>
                    }

                    { /* LangChain Embed URL */ }
                    {chatType.includes("LangChain") ?
                      <>
                        <tr>
                          {urlValid ?
                            <td className="pb-4 pr-4 ">Embed Source:</td>
                            :
                            <td className="pb-4 pr-4 text-marcelin-900">Embed Source:</td>
                          }
                          <td className="tracking-wide font-bold text-black"><TextareaAutosize minRows="3" maxRows="5" className="min-w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-sans text-black rounded-xl" onChange={(e) => handleLangchainURLChange(e)} type="text" value={langchainURL}></TextareaAutosize></td>
                        </tr>
                      </>
                      : <></>
                    }

                    { /* Input Type */ }
                    <tr>
                      <td className="pb-2 pr-4">Input Type:</td>
                      <td className="pb-2 tracking-wide font-bold text-black">
                        <select
                          name="chatType"
                          id="chatType"
                          className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer p-4 min-w-full font-sans rounded-xl text-black"
                          onChange={(e) => handleChatTypeChange(e)}
                          value={chatType}
                        >
                          {Object.keys(modelOptions).map((optionKey) => (
                            <option key={optionKey} value={optionKey}>
                              {optionKey}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>

                    { /* Model Selection */ }
                    {advancedSetting &&
                      <>
                        <tr>
                          <td className="pb-2 pr-4">Model:</td>
                          <td className="pb-2 tracking-wide font-bold text-black">
                            <select 
                              name="model" 
                              id="model" 
                              className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer p-4 min-w-full font-sans rounded-xl text-black" 
                              onChange={(e) => handleModelChange(e)} 
                              value={model.name}
                              disabled={!modelOptions[chatType] || modelOptions[chatType].length === 0}
                            >
                              {modelOptions[chatType] && modelOptions[chatType].length > 0 ? (
                                modelOptions[chatType].map((option) => (
                                  <option key={option.name} value={option.name}>
                                    {truncateString(option.name, 40)}
                                  </option>
                                ))
                              ) : (
                                <option value="" disabled>
                                  No models available
                                </option>
                              )}
                            </select>
                          </td>
                        </tr>

                        { /* Temperature */ }
                        <tr>
                          <td className="pb-4 pr-4">temperature:</td>
                          <td className="tracking-wide font-bold text-black">
                            <select name="temperature" id="temperature" className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer mb-2 p-4 min-w-24 font-sans rounded-xl text-black" onChange={(e) => handleTempChange(e)} value={temperature}>
                              <option value="0.0">0.0</option>
                              <option value="0.01">0.01</option>
                              <option value="0.02">0.02</option>
                              <option value="0.03">0.03</option>
                              <option value="0.04">0.04</option>
                              <option value="0.05">0.05</option>
                              <option value="0.06">0.06</option>
                              <option value="0.07">0.07</option>
                              <option value="0.08">0.08</option>
                              <option value="0.09">0.09</option>
                              <option value="0.1">0.1</option>
                              <option value="0.2">0.2</option>
                              <option value="0.3">0.3</option>
                              <option value="0.4">0.4</option>
                              <option value="0.5">0.5</option>
                              <option value="0.6">0.6</option>
                              <option value="0.7">0.7</option>
                              <option value="0.8">0.8</option>
                              <option value="0.9">0.9</option>
                              <option value="1.0">1.0</option>
                            </select>
                          </td>
                        </tr>

                        { /* top-p */ }
                        <tr>
                          <td className="pb-4">top-p:</td>
                          <td className="tracking-wide font-bold text-black">
                            <select name="topp" id="topp" className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer mb-1 p-4 min-w-24 font-sans rounded-xl text-black" onChange={(e) => handleToppChange(e)} value={topp}>
                              <option value="0.01">0.01</option>
                              <option value="0.02">0.02</option>
                              <option value="0.03">0.03</option>
                              <option value="0.04">0.04</option>
                              <option value="0.05">0.05</option>
                              <option value="0.06">0.06</option>
                              <option value="0.07">0.07</option>
                              <option value="0.08">0.08</option>
                              <option value="0.09">0.09</option>
                              <option value="0.1">0.1</option>
                              <option value="0.2">0.2</option>
                              <option value="0.3">0.3</option>
                              <option value="0.4">0.4</option>
                              <option value="0.5">0.5</option>
                              <option value="0.6">0.6</option>
                              <option value="0.7">0.7</option>
                              <option value="0.8">0.8</option>
                              <option value="0.9">0.9</option>
                              <option value="1.0">1.0</option>
                            </select>
                          </td>
                        </tr>
                      </>
                    }
                  </tbody>
                </table>

                { //New Chat button displays only when conditions allow.
                  !serverCheck ||
                    (chatType.includes("LangChain") && !urlValid) ?
                    <></> :
                    <div className="grid gap-2 grid-cols-3 mt-6 mb-2">
                      <Spring
                        from={{ opacity: 0 }}
                        to={[
                          { opacity: 1 }
                        ]}
                        delay={200}>
                        {styles => (
                          <animated.div onClick={debounce(() => { makeNewChat(""); }, 250)} style={styles} className="self-start text-black place-self-center hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-2xl font-bold m-2 p-4 flex items-center justify-center mb-5 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-2xl hover:shadow-dracula-700 cursor-pointer">
                            <i className="fa-solid fa-keyboard mr-4"></i>
                            <h1>New Text</h1>
                          </animated.div>
                        )}
                      </Spring>

                      { /* Middle display of selections */ }
                      <div className="rounded-lg border-solid border-2 border-aro-800 bg-aro-300 text-black text-center pt-1 cursor-text">
                        <p className="underline text-2xl">Model Selected:</p>
                        <p className="text-xl">{chatType}: <span className="italic">{model.name}</span></p>
                        {chatType.includes("LangChain") ?
                          <p><a className="underline hover:no-underline" alt={langchainURL} target="_blank" rel="noopener noreferrer" href={langchainURL}>{langchainURL}</a></p> :
                          <></>
                        }
                      </div>

                      { /* New Voice button */ }
                      <Spring
                        from={{ opacity: 0 }}
                        to={[
                          { opacity: 1 }
                        ]}
                        delay={200}>
                        {styles => (
                          <animated.div onClick={debounce(() => { makeNewChat(" (Voice)"); }, 250)} style={styles} className="self-start text-black place-self-center hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-2xl font-bold m-2 p-4 flex items-center justify-center mb-5 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-2xl hover:shadow-buffy-700 shadow-xl cursor-pointer">
                            <i className="fa-solid fa-microphone-lines mr-4"></i>
                            <h1>New Voice</h1>
                          </animated.div>
                        )}
                      </Spring>
                    </div>
                }
              </div>
            </animated.div>
          )}
        </Spring>
      </div>

      { /* All the Chats */ }
      <div className={`grid gap-3 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 place-items-center mt-1`}>
        {componentList.slice().reverse().map((container) => (
          <Chat
            key={container.id}
            closeID={container.id}
            systemMessage={container.systemMessage}
            chatType={container.chatType}
            model={container.model}
            temperature={container.temperature}
            topp={container.topp}
            numba={container.numba}
            langchainURL={container.langchainURL}
            listModels={container.listModels}
            serverURL={container.serverURL}
            modelOptions={container.modelOptions}
            localModels={container.localModels}
          />
        ))}
      </div>
    </dataContext.Provider>
  );
}

export default App;