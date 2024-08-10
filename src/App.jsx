import axios from "axios";
import { animated, Spring } from "react-spring";
import Chat from "./components/Chat";
import debounce from "lodash/debounce";
import { useEffect, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";

function App() {
  const [sysMsg, setSysMsg] = useState("Let's work this out in a step by step way to be sure we have the right answer.");
  const [componentList, setComponentList] = useState([]);
  const [contactCount, setContactCount] = useState(1);
  const [advancedSetting, setAdvancedSetting] = useState(false);
  const [serverCheck, setServerCheck] = useState(false);
  const [samplingType, setSamplingType] = useState("temperature");
  const [responseType, setResponseType] = useState("OpenAI - Chat");
  const [temperature, setTemperature] = useState("1.0");
  const [model, setModel] = useState("gpt-4o-mini");
  const [topp, setTopp] = useState("1.0");
  const [localModels, setLocalModels] = useState({});
  const [apiKey, setApiKey] = useState("");
  const [langchainURL, setLangchainURL] = useState("https://");
  const [mediaURL, setMediaURL] = useState("http://localhost");
  const [urlValid, setUrlValid] = useState(false);
  const [chosenOpenAI, setChosenOpenAI] = useState("gpt-4o-mini");
  const [chosenOllama, setChosenOllama] = useState("");

  const makeNewComponent = (typeOfComponent) => {
    let response = "OpenAI - Chat";
    let inputDescriptor = `(${typeOfComponent})`;

    if (responseType === "OpenAI - Chat") {
      response = `OpenAI: Chat ${inputDescriptor}`;
    } else if (responseType === "Ollama - Chat") {
      response = `Ollama: Chat ${inputDescriptor}`;
    } else if (responseType === "Ollama - LangChain") {
      response = `Ollama: LangChain ${inputDescriptor}`;
    }

    const newChat = { 
      id: Date.now(), 
      numba: contactCount,
      systemMessage: sysMsg,
      responseType: response,
      model: model,
      samplingType: samplingType,
      temperature: temperature,
      topp: topp,
      localModels: localModels,
      apiKey: apiKey,
      langchainURL: langchainURL
    };
    
    setComponentList([...componentList, newChat]);
    setContactCount(contactCount + 1);
  };

  const handleClose = (id) => {
    setComponentList(componentList.filter((container) => container.id !== id));
  };

  function handleSysMsgChange(e) {
    setSysMsg(e.target.value);
  }

  function handleApiKeyChange(e) {
    setApiKey(e.target.value);
  }

  function handleLangchainURLChange(e) {
    setLangchainURL(e.target.value);
    const checkValid = isValidURL(e.target.value);
    if (checkValid) {
      setUrlValid(true);
    } else {
      setUrlValid(false);
    }
  }

  function handleTypeChange(e) {
    setSamplingType(e.target.value);
  }

  function isValidURL(input) {
    if (/\s/.test(input)) {
      return false; // Input contains whitespace, return false.
    }

    const res = input.match(/(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi);
    return (res !== null);
  }

  function handleRespChange(e) {
    setResponseType(e.target.value);
    switch (e.target.value) {
      case "OpenAI - Chat" : 
        setModel(chosenOpenAI);
      break;
      case "OpenAI - Chat" : 
      setModel(chosenOpenAI);
    break;
      default : 
        setModel(chosenOllama);
    }
  }

  function handleToppChange(e) {
    setTopp(e.target.value);
    setTemperature("1.0");
  }

  function handleTempChange(e) {
    setTemperature(e.target.value);
    setTopp("1.0");
  }

  function handleModelChange(e) {
    setModel(e.target.value);

    switch (responseType) {
      case "OpenAI - Chat" : 
        setChosenOpenAI(e.target.value);
      break;
      default : 
        setChosenOllama(e.target.value);
    }
  }

  const handleCheckboxChange = (event) => { 
    const checkedYes = event.target.checked;

    if (!checkedYes) {
      setTemperature("1.0");
      setTopp("1.0");
      setResponseType("OpenAI - Chat");
      setSamplingType("temperature");
      setModel(chosenOpenAI);
    }

    setAdvancedSetting(checkedYes);
  };

  const openAImodels = [
    { name: "gpt-3.5-turbo" },
    { name: "gpt-4" },
    { name: "gpt-4-turbo" },
    { name: "gpt-4o" },
    { name: "gpt-4o-mini" }
  ];

  const modelOptions = {
    "OpenAI - Chat": openAImodels,
    "Ollama - Chat": localModels,
    "Ollama - LangChain": localModels
  };

  const checkModels = async () => {
    try {
      const response = await axios.get("http://localhost:11434/api/tags");
      setLocalModels(response.data.models);

      switch (responseType) {
        case "OpenAI - Chat" : 
          setModel("gpt-4o-mini");
        break;
        default : 
          setModel(response.data.models[0].name);
      }
      
      setChosenOllama(response.data.models[0].name);
    } catch (error) { console.log(error); }
  };

  useEffect(() => {
    checkModels();
  }, []);

  useEffect(() => {
    //Check for server every second
    const checkLangchain = setInterval(async () => {
      //if (responseType == "Ollama - Chat" || responseType == "OpenAI - Chat") { return; }
      let chainServerCheck = false;
      try {
        chainServerCheck = await axios.post("http://localhost:8080/check");
      } catch (error) {
        console.log(error);
      }

      if (chainServerCheck) {
        setServerCheck(true);
      } else {
        setServerCheck(false);
      }
    }, 1000); // 1000 milliseconds = 1 second

    return () => {
      // This cleanup function will clear the interval when the component unmounts
      clearInterval(checkLangchain);
    };
  }, [responseType]);

  return (
    <div className={`grid gap-2 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 place-items-center mt-8`}>
        { serverCheck &&
          <Spring
            from={{ opacity: 0 }}
            to={[
              { opacity: 1 }
            ]}
            delay={200}>
            {styles => (
              <animated.div onClick={debounce(() => {makeNewComponent("Voice");}, 250)} style={styles} className="self-start text-nosferatu-900 place-self-center hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-5xl font-bold m-2 p-12 flex items-center justify-center mb-5 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-2xl hover:shadow-buffy-700 cursor-pointer">
                <i className="fa-solid fa-microphone-lines mr-4 text-nosferatu-800"></i>
                <h1>Voice Chat</h1>
              </animated.div>
            )}
          </Spring>
        }
        <Spring
          from={{ opacity: 0 }}
          to={[
            { opacity: 1 }
          ]}
          delay={200}>
          {styles => (
            <animated.div onClick={debounce(() => {makeNewComponent("Text");}, 250)} style={styles} className={ serverCheck ?
            "self-start text-nosferatu-900 place-self-center hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-5xl font-bold m-2 p-12 flex items-center justify-center mb-5 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-2xl hover:shadow-dracula-700 cursor-pointer" :
            "2xl:col-span-2 self-start text-nosferatu-900 place-self-center hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-5xl font-bold m-2 p-12 flex items-center justify-center mb-5 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-2xl hover:shadow-dracula-700 cursor-pointer"
            }>
              <i className="fa-solid fa-keyboard mr-4 text-nosferatu-800"></i>
              <h1>Text Chat</h1>
            </animated.div>
          )}
        </Spring>
        <Spring
          from={{ opacity: 0 }}
          to={[
            { opacity: 1 }
          ]}
          delay={400}>
          {styles => (
            <animated.div style={styles} className="w-[98%] text-nosferatu-900 place-self-start hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl font-bold p-6 flex items-center justify-center m-2 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-2xl hover:shadow-blade-800">
              <div className="w-full">
                <table className="min-w-full">
                  <tbody>
                      <tr>
                        <td className="2xl:w-[10%] xl:w-[14%] lg:w-[18%] md:w-[22%] sm:w-[26%] text-5xl text-center">
                          <i className="fa-solid text-5xl fa-gear text-nosferatu-800 text-center mb-4"></i>
                        </td>
                        <td className="2xl:w-[90%] xl:w-[86%] lg:w-[82%] md:w-[78%] sm:w-[74%] text-3xl tracking-normal text-center font-bold text-nosferatu-900 cursor-pointer">
                          <input className="w-8 h-8 cursor-pointer mb-4" type="checkbox" name="advancedSetting" checked={advancedSetting} onChange={handleCheckboxChange} /> <label className="cursor-pointer leading-6"> Advanced Settings</label> 
                        </td>
                      </tr>
                      { !responseType.includes("LangChain") &&
                        <tr>
                          <td className="pb-4">
                            System Message
                          </td>
                          <td>
                            <TextareaAutosize minRows="3" maxRows="5" className="w-full font-bold hover:bg-nosferatu-400 p-4 bg-nosferatu-100 text-sm font-mono text-black ring-1 hover:ring-2 ring-vonCount-900 rounded-xl" placeholder="'System' Message" onChange={(e) => handleSysMsgChange(e)} value={sysMsg} />
                          </td>
                        </tr>
                      }
                    { advancedSetting && 
                      <>
                        <tr>
                          <td className="pb-4">Input Type</td>
                          <td className="pb-4 tracking-wide text-center font-bold text-nosferatu-900">
                            <select name="responseType" id="responseType" className="hover:bg-nosferatu-400 cursor-pointer mb-2 p-4 min-w-full bg-nosferatu-100 font-mono rounded-xl text-black ring-1 hover:ring-2 ring-vonCount-900" onChange = {(e) => handleRespChange(e)} value={responseType}>
                                <option value="OpenAI - Chat">OpenAI - Chat</option>
                                <option value="Ollama - Chat">Ollama - Chat</option>
                                <option value="Ollama - LangChain">Ollama - LangChain</option>
                            </select>
                          </td>
                        </tr>
                        { responseType.includes("OpenAI") ? 
                          <tr>
                            <td>OpenAI API Key</td>
                            <td className="pb-4 tracking-wide text-center font-bold text-nosferatu-900"><input className="w-full font-bold hover:bg-nosferatu-400 p-6 bg-nosferatu-100 text-sm font-mono text-black ring-1 hover:ring-2 ring-vonCount-900 rounded-xl" onChange = {(e) => handleApiKeyChange(e)} type="password" value={apiKey}></input></td>
                          </tr>
                          : <></>
                        }
                        { responseType.includes("LangChain") || responseType.includes("(Voice)") ? 
                          <>
                            <tr>
                              <td className="pb-4">Server Check</td>
                              <td className="pb-4">
                                { serverCheck ?
                                <p>Local NodeJS Voice/LangChain Server <span className="text-blade-700">Online</span> <i className="fa-solid fa-handshake text-blade-700 text-2xl"></i></p>
                                : 
                                <p>Local NodeJS Voice/LangChain Server <span className="text-marcelin-900">Offline</span> <i className="fa-solid fa-triangle-exclamation text-marcelin-900 text-2xl"></i></p>
                                }
                              </td>
                            </tr>
                          </>
                          : <></>
                        }
                        { responseType.includes("LangChain") ? 
                          <>
                            <tr>
                              { urlValid ?
                                <td className="pb-4">Embed Source <i className="fa-solid fa-link text-blade-700"></i></td>
                                : 
                                <td className="pb-4">Embed Source <i className="fa-solid fa-link-slash text-marcelin-900"></i></td>
                              }
                              <td className="pb-4 tracking-wide text-center font-bold text-nosferatu-900"><input className="w-full font-bold hover:bg-nosferatu-400 p-6 bg-nosferatu-100 text-sm font-mono text-black ring-1 hover:ring-2 ring-vonCount-900 rounded-xl" onChange = {(e) => handleLangchainURLChange(e)} type="text" value={langchainURL}></input></td>
                            </tr>
                          </>
                          : <></>
                        }
                        <tr>
                          <td className="pb-4">Model</td>
                          <td className="pb-4 tracking-wide text-center font-bold text-nosferatu-900">
                            <select name="model" id="model" className="hover:bg-nosferatu-400 cursor-pointer mb-2 p-4 min-w-full bg-nosferatu-100 font-mono rounded-xl text-black ring-1 hover:ring-2 ring-vonCount-900" onChange = {(e) => handleModelChange(e)} value={model}>
                              {modelOptions[responseType].map((option) => (
                                <option key={option.name} value={option.name}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                        <tr>
                          <td className="pb-4">Sampling Type</td>
                          <td className="pb-4 tracking-wide text-center font-bold text-nosferatu-900">
                            <select name="samplingType" id="samplingType" className="hover:bg-nosferatu-400 cursor-pointer mb-2 p-4 min-w-full bg-nosferatu-100 font-mono rounded-xl text-black ring-1 hover:ring-2 ring-vonCount-900" onChange = {(e) => handleTypeChange(e)} value={samplingType}>
                                <option value="temperature">temperature</option>
                                <option value="topp">top-p</option>
                            </select>
                          </td>
                        </tr>
                        { samplingType === "temperature" ? 
                          <tr>
                            <td className="pb-4">temperature</td>
                            <td className="tracking-wide text-center font-bold text-nosferatu-900">
                              <select name="temperature" id="temperature" className="hover:bg-nosferatu-400 cursor-pointer mb-2 p-4 min-w-full bg-nosferatu-100 font-mono rounded-xl text-black ring-1 hover:ring-2 ring-vonCount-900" onChange = {(e) => handleTempChange(e)} value={temperature}>
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
                        :
                          <tr>
                            <td className="pb-4">top-p</td>
                            <td className="tracking-wide text-center font-bold text-nosferatu-900">
                              <select name="topp" id="topp" className="hover:bg-nosferatu-400 cursor-pointer mb-2 p-4 min-w-full bg-nosferatu-100 font-mono rounded-xl text-black ring-1 hover:ring-2 ring-vonCount-900" onChange = {(e) => handleToppChange(e)} value={topp}>
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
                        }
                      </>
                    }
                  </tbody>
                </table>
              </div>
            </animated.div>
          )}
        </Spring> 
      
        {componentList.slice().reverse().map((container) => (
          <Chat 
            key={container.id} 
            systemMessage={container.systemMessage}
            responseType={container.responseType}
            model={container.model}
            samplingType={container.samplingType}
            temperature={container.temperature}
            topp={container.topp}
            userID={container.theID}
            onClose={() => handleClose(container.id)} numba={container.numba}
            apiKey={container.apiKey}
            langchainURL={container.langchainURL}
          />
        ))}
    </div>
  );
}

export default App;
