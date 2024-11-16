import { useEffect, useState, useCallback } from "react";
import { animated, Spring } from "react-spring";
import TextareaAutosize from "react-textarea-autosize";
import axios from "axios";
import debounce from "lodash/debounce";
import Chat from "./components/Chat";

function App() {
  const openAImodels = [
    { name: "gpt-4o-mini" },
    { name: "gpt-4o" },
    { name: "gpt-4" },
    { name: "gpt-4-turbo" },
    { name: "gpt-3.5-turbo" },

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
    { name: "gemini-1.5-flash-8b" },
    { name: "gemini-1.5-flash" },
    { name: "gemini-1.5-pro" },
  ];

  const grokAImodels = [
    { name: "grok-beta" },
  ];

  const [sysMsg, setSysMsg] = useState("Let's work this out in a step by step way to be sure we have the right answer.");
  const [componentList, setComponentList] = useState([]);
  const [contactCount, setContactCount] = useState(1);
  const [advancedSetting, setAdvancedSetting] = useState(false);
  const [serverCheck, setServerCheck] = useState(false);
  const [responseType, setResponseType] = useState("OpenAI");
  const [temperature, setTemperature] = useState("1.0");
  const [model, setModel] = useState(openAImodels[0]);
  const [topp, setTopp] = useState("1.0");
  const [localModels, setLocalModels] = useState([{ name: "nil" }]);
  const [checkIncrement, setCheckIncrement] = useState(0);
  const [serverURL, setServerURL] = useState("http://localhost:8080");
  const [langchainURL, setLangchainURL] = useState("https://");
  const [urlValid, setUrlValid] = useState(false);
  const [chosenOpenAI, setChosenOpenAI] = useState(openAImodels[0]);
  const [chosenGrokAI, setChosenGrokAI] = useState(grokAImodels[0]);
  const [chosenAnthropic, setChosenAnthropic] = useState(anthropicAImodels[0]);
  const [chosenOllama, setChosenOllama] = useState(localModels[0]);
  const [chosenGoogle, setChosenGoogle] = useState(googleAImodels[0]);
  const [listModels, setListModels] = useState(openAImodels);

  const modelOptions = {
    "OpenAI": openAImodels,
    "Anthropic": anthropicAImodels,
    "Google": googleAImodels,
    "Grok": grokAImodels,
    "Ollama": localModels,
    "Ollama - LangChain": localModels
  };

  const makeNewComponent = (typeOfComponent) => {
    let response = "OpenAI";
    let inputDescriptor = `${typeOfComponent}`;

    const responseMap = {
      "OpenAI": `OpenAI${inputDescriptor}`,
      "Anthropic": `Anthropic${inputDescriptor}`,
      "Ollama": `Ollama${inputDescriptor}`,
      "Google": `Google${inputDescriptor}`,
      "Grok": `Grok${inputDescriptor}`,
      "Ollama - LangChain": `Ollama: LangChain${inputDescriptor}`
    };
    
    // Default to an empty string if responseType doesn't match
    response = responseMap[responseType] || ""; 

    const newChat = {
      id: Date.now(),
      numba: contactCount,
      systemMessage: sysMsg,
      responseType: response,
      model: model.name,
      temperature: temperature,
      topp: topp,
      localModels: localModels,
      langchainURL: langchainURL,
      listModels: listModels,
      serverURL: serverURL,
    };

    setComponentList([...componentList, newChat]);
    setContactCount(contactCount + 1);
  };

  const checkModels = useCallback(async () => {
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
        "OpenAI": openAImodels,
        "Anthropic": anthropicAImodels,
        "Google": googleAImodels,
        "Grok": grokAImodels,
      };
      setModel(modelMapping[responseType]?.[0] || allModels[0]);

      setChosenOllama({ name: allModels[0].name });
    } catch (error) { console.log(error); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverURL]);

  useEffect(() => {
    checkModels();
  }, [checkModels]);

  useEffect(() => {
    const checkLangchain = setInterval(async () => {
      let chainServerCheck = undefined;
      try {
        const response = await axios.post(serverURL + "/check");

        // Check if the response data indicates success
        chainServerCheck = response?.data || undefined;
      } catch (error) {
        chainServerCheck = undefined;
      }

      if (chainServerCheck) {
        setServerCheck(true);
      } else {
        setServerCheck(false);
        setCheckIncrement(prevValue => prevValue + 1);
      }

      if (checkIncrement > 10) {
        console.clear();
        setCheckIncrement(0);
      }
    }, 1000); // 1000 milliseconds = 1 second

    return () => {
      // Clear the interval when the component unmounts
      clearInterval(checkLangchain);
    };
  }, [serverURL, checkIncrement]);

  function handleRespChange(e) {
    const selectedResponseType = e.target.value;
    setResponseType(selectedResponseType);
  
    const modelMapping = {
      "OpenAI": { modelState: chosenOpenAI, list: openAImodels },
      "Anthropic": { modelState: chosenAnthropic, list: anthropicAImodels },
      "Google": { modelState: chosenGoogle, list: googleAImodels },
      "Grok": { modelState: chosenGrokAI, list: grokAImodels },
      "default": { modelState: chosenOllama, list: localModels },
    };
  
    const selected = modelMapping[selectedResponseType] || modelMapping["default"];
    
    // Attempt to restore previous model choice, fallback to the first model if undefined.
    const previousSelectedModel = selected.modelState || selected.list[0];
    
    setModel(previousSelectedModel);
    setListModels(selected.list);
  }
  

  function handleModelChange(e) {
    const modelObj = { name: e.target.value };
    setModel(modelObj);
  
    const setChosenMapping = {
      "OpenAI": setChosenOpenAI,
      "Anthropic": setChosenAnthropic,
      "Google": setChosenGoogle,
      "Grok": setChosenGrokAI,
      "Ollama": setChosenOllama
    };
  
    (setChosenMapping[responseType] || setChosenOllama)(modelObj);
  }

  const handleClose = (id) => {
    setComponentList(componentList.filter((container) => container.id !== id));
  };

  function handleSysMsgChange(e) {
    setSysMsg(e.target.value);
  }

  function handleToppChange(e) {
    setTopp(e.target.value);
  }

  function handleTempChange(e) {
    setTemperature(e.target.value);
  }

  function handleURLChange(e) {
    setServerURL(e.target.value);
  }

  const handleCheckboxChange = (event) => {
    const checkedYes = event.target.checked;
    setAdvancedSetting(checkedYes);
  };

  function handleLangchainURLChange(e) {
    setLangchainURL(e.target.value);
    const checkValid = isValidURL(e.target.value);
    if (checkValid) {
      setUrlValid(true);
    } else {
      setUrlValid(false);
    }
  }

  // If input contains whitespace, return false.
  function isValidURL(input) {
    if (/\s/.test(input)) {
      return false; 
    }

    const res = input.match(/(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi);
    return (res !== null);
  }

  const truncateString = (str, length) => {
    if (str.length > length) {
      return str.substring(0, length) + '...';
    }
    return str;
  };

  return (
    <>
      <div>
        <Spring
          from={{ opacity: 0 }}
          to={[
            { opacity: 1 }
          ]}
          delay={400}>
          {styles => (
            <animated.div style={styles} className="min-w-full text-aro-100 place-self-center cursor-default bg-vonCount-600 bg-gradient-to-tl from-vonCount-700 rounded-3xl font-bold p-2 flex items-center justify-center mt-2">
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
                    {!serverCheck &&
                      <tr>
                        <td className="pb-4 pr-4">Server URL:</td>
                        <td className="pb-4">
                          <TextareaAutosize minRows="1" maxRows="2" className="w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-mono text-black rounded-xl" placeholder="http://localhost:8080" onChange={(e) => handleURLChange(e)} value={serverURL} />
                        </td>
                      </tr>
                    }
                    <tr>
                      <td className="pb-4 pr-4">Server Check:</td>
                      <td className="pb-4">
                        {serverCheck ?
                          <p>Node.js Server: <span className="text-blade-700">Online</span><span className="ml-6">{serverURL}</span></p>
                          :
                          <><p>Node.js Server: <span className="text-marcelin-900">Offline</span> <i className="fa-solid fa-triangle-exclamation text-marcelin-900 text-2xl"></i></p></>
                        }
                      </td>
                    </tr>
                    {!responseType.includes("LangChain") &&
                      <tr>
                        <td className="pb-4 pr-4">
                          Starting Prompt:
                        </td>
                        <td>
                          <TextareaAutosize minRows="3" maxRows="5" className="min-w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-mono text-black rounded-xl" placeholder="'System' Message" onChange={(e) => handleSysMsgChange(e)} value={sysMsg} />
                        </td>
                      </tr>
                    }
                    {responseType.includes("LangChain") ?
                      <>
                        <tr>
                          {urlValid ?
                            <td className="pb-4 pr-4 ">Embed Source:</td>
                            :
                            <td className="pb-4 pr-4 text-marcelin-900">Embed Source:</td>
                          }
                          <td className="tracking-wide font-bold text-black"><TextareaAutosize minRows="3" maxRows="5" className="min-w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-mono text-black rounded-xl" onChange={(e) => handleLangchainURLChange(e)} type="text" value={langchainURL}></TextareaAutosize></td>
                        </tr>
                      </>
                      : <></>
                    }
                    <tr>
                      <td className="pb-2 pr-4">Input Type:</td>
                      <td className="pb-2 tracking-wide font-bold text-black">
                        <select name="responseType" id="responseType" className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer p-4 min-w-full font-mono rounded-xl text-black" onChange={(e) => handleRespChange(e)} value={responseType}>
                          <option value="Anthropic">Anthropic</option>
                          <option value="Google">Google</option>
                          <option value="Grok">Grok</option>
                          <option value="OpenAI">OpenAI</option>
                          <option value="Ollama">Ollama</option>
                          <option value="Ollama - LangChain">Ollama - LangChain</option>
                        </select>
                      </td>
                    </tr>
                    {advancedSetting &&
                      <>
                        <tr>
                          <td className="pb-2 pr-4">Model:</td>
                          <td className="pb-2 tracking-wide font-bold text-black">
                            <select name="model" id="model" className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer p-4 min-w-full font-mono rounded-xl text-black" onChange={(e) => handleModelChange(e)} value={model.name}>
                              {modelOptions[responseType].map((option) => (
                                <option key={option.name} value={option.name}>
                                  {truncateString(option.name, 40)} {/* Modify the length */}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                        <tr>
                          <td className="pb-4 pr-4">temperature:</td>
                          <td className="tracking-wide font-bold text-black">
                            <select name="temperature" id="temperature" className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer mb-2 p-4 min-w-24 font-mono rounded-xl text-black" onChange={(e) => handleTempChange(e)} value={temperature}>
                              <option value="0.0">0.0</option>
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
                              <option value="1.1">1.1</option>
                              <option value="1.2">1.2</option>
                              <option value="1.3">1.3</option>
                              <option value="1.4">1.4</option>
                              <option value="1.5">1.5</option>
                              <option value="1.6">1.6</option>
                              <option value="1.7">1.7</option>
                              <option value="1.8">1.8</option>
                              <option value="1.9">1.9</option>
                              <option value="2.0">2.0</option>
                            </select>
                          </td>
                        </tr>
                        <tr>
                          <td className="pb-4">top-p:</td>
                          <td className="tracking-wide font-bold text-black">
                            <select name="topp" id="topp" className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer mb-1 p-4 min-w-24 font-mono rounded-xl text-black" onChange={(e) => handleToppChange(e)} value={topp}>
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
                { //New Chat buttons display when conditions allow.
                  !serverCheck ||
                    (responseType.includes("LangChain") && !urlValid) ?
                    <></> :
                    <div className="grid gap-2 grid-cols-3 mt-6 mb-2">
                      <Spring
                        from={{ opacity: 0 }}
                        to={[
                          { opacity: 1 }
                        ]}
                        delay={200}>
                        {styles => (
                          <animated.div onClick={debounce(() => { makeNewComponent(""); }, 250)} style={styles} className={serverCheck ?
                            "self-start text-black place-self-center hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-3xl font-bold m-2 p-6 flex items-center justify-center mb-5 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-2xl hover:shadow-dracula-700 cursor-pointer" :
                            "2xl:col-span-2 self-start text-black place-self-center hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-3xl font-bold m-2 p-6 flex items-center justify-center mb-5 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-2xl hover:shadow-dracula-700 cursor-pointer"
                          }>
                            <i className="fa-solid fa-keyboard mr-4"></i>
                            <h1>New Text</h1>
                          </animated.div>
                        )}
                      </Spring>
                      <div className="rounded-lg border-solid border-2 border-aro-800 bg-aro-300 text-black text-center pt-1 cursor-text">
                        <p className="underline text-3xl">Model Selected:</p>
                        <p className="text-2xl">{responseType}: <span className="italic">{model.name}</span></p>
                        { responseType.includes("LangChain") ?
                          <p>{langchainURL}</p> :
                          <></>
                        }
                      </div>
                      <Spring
                        from={{ opacity: 0 }}
                        to={[
                          { opacity: 1 }
                        ]}
                        delay={200}>
                        {styles => (
                          <animated.div onClick={debounce(() => { makeNewComponent(" (Voice)"); }, 250)} style={styles} className="self-start text-black place-self-center hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-3xl font-bold m-2 p-6 flex items-center justify-center mb-5 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-2xl hover:shadow-buffy-700 shadow-xl cursor-pointer">
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
      <div className={`grid gap-3 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 place-items-center mt-1`}>
        {componentList.slice().reverse().map((container) => (
          <Chat
            key={container.id}
            systemMessage={container.systemMessage}
            responseType={container.responseType}
            model={container.model}
            temperature={container.temperature}
            topp={container.topp}
            onClose={() => handleClose(container.id)} numba={container.numba}
            langchainURL={container.langchainURL}
            listModels={container.listModels}
            serverURL={container.serverURL}
          />
        ))}
      </div>
    </>
  );
}

export default App;