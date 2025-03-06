import { useRef, useState, useCallback, createContext, useMemo, useEffect } from "react";
import { animated, Spring } from "react-spring";
import TextareaAutosize from "react-textarea-autosize";
import { randomBytes } from 'crypto';
import axios from "axios";
import debounce from "lodash/debounce";
import { v4 as uuidv4 } from 'uuid';
import Chat from "./components/Chat";
import { ConsolePage } from './console/ConsolePage.jsx';
import Config from './Config';
export const dataContext = createContext();

function App() {
  const {
    openAI: openAImodels,
    anthropic: anthropicAImodels,
    google: googleAImodels,
    grok: grokAImodels,
    deepseek: deepseekAImodels,
  } = Config.models;

  //Which model type is chosen by default
  const [chatType, setChatType] = useState("OpenAI");
  const [model, setModel] = useState(openAImodels[0]);
  const [listModels, setListModels] = useState(openAImodels);

  //Other defaults
  const [serverPassphrase, setServerPassphrase] = useState("");
  const [serverURL, setServerURL] = useState("http://localhost");
  const [relayWS, setRelayWS] = useState("http://localhost");
  const [sysMsg, setSysMsg] = useState("Let's work this out in a step by step way to be sure we have the right answer.");
  const [temperature, setTemperature] = useState("0.8");
  const [topp, setTopp] = useState("1");
  const [topk, setTopk] = useState("1");
  const [langchainURL, setLangchainURL] = useState("https://");

  //Don't touch the rest of these.
  const [clientJWT, setClientJWT] = useState("");
  const [sessionHash, setSessionHash] = useState("");
  const [localModels, setLocalModels] = useState([]);
  const [componentList, setComponentList] = useState([]);
  const [advancedSetting, setAdvancedSetting] = useState(false);
  const [serverCheck, setServerCheck] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [urlValid, setUrlValid] = useState(false);
  const [chatCount, setChatCount] = useState(1);
  const [chosenAnthropic, setChosenAnthropic] = useState(anthropicAImodels[0]);
  const [chosenGoogle, setChosenGoogle] = useState(googleAImodels[0]);
  const [chosenGrokAI, setChosenGrokAI] = useState(grokAImodels[0]);
  const [chosenDeepseekAI, setChosenDeepseekAI] = useState(deepseekAImodels[0]);
  const [chosenOllama, setChosenOllama] = useState(localModels[0]);
  const [chosenOpenAI, setChosenOpenAI] = useState(openAImodels[0]);
  const intervalIdRef = useRef(null);

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
  if (deepseekAImodels.length > 0) {
    modelOptions["Deepseek"] = deepseekAImodels;
  }

  if (localModels.length > 0) {
    modelOptions["Ollama"] = localModels;
    modelOptions["LangChain"] = localModels;
  }

  if (openAImodels.length > 0) {
    modelOptions["OpenAI"] = openAImodels;
  }

  function useDebouncedCallback(callback, delay) {
    const debouncedFn = useMemo(() => debounce(callback, delay), [callback, delay]);
    useEffect(() => {
      return () => debouncedFn.cancel();
    }, [debouncedFn]);
    return debouncedFn;
  }

  const makeNewChat = useCallback((additionalData) => {
    const uuid = uuidv4();

    const newChat = {
      id: uuid,
      numba: chatCount,
      systemMessage: sysMsg,
      chatType: additionalData,
      model: model.name,
      temperature: temperature,
      topp: topp,
      topk: topk,
      localModels: localModels,
      langchainURL: langchainURL,
      listModels: listModels,
      serverURL: serverURL,
      modelOptions: modelOptions,
    };

    setComponentList([...componentList, newChat]);
    setChatCount(chatCount + 1);
  });

  const debouncedMakeNewChat = useDebouncedCallback(makeNewChat, 250);

  //Loop every 3 seconds to check if server is available
  const startInterval = useCallback(() => {
    // Ensure not to start multiple intervals
    if (intervalIdRef.current) {
      return;
    }

    setSessionHash(randomBytes(64).toString('hex'));
    checkBackServer();

    // Start the interval
    intervalIdRef.current = setInterval(() => {
      checkBackServer();
    }, 3000);
  });

  //Starts the interval on first load
  useEffect(() => {
    startInterval();
  }, []);

  const checkBackServer = useCallback(debounce(async () => {
    try {
      const response = await axios.post(serverURL + "/check");
      const backServerCheck = response?.data || undefined;

      // Only update state if the value has changed
      if (backServerCheck === "ok") {
        setServerCheck(true);
      } else {
        setServerCheck(false);
        setClientJWT("");
        setCheckedIn(false);
        setLocalModels([]);
      }
    } catch (error) {
      setServerCheck(false);
      setClientJWT("");
      setCheckedIn(false);
      setLocalModels([]);
    }
  }, 250,
    [serverCheck] // Add dependencies
  ));

  //Ping the backend server to check in, validate passphrase and acquire the JWT for later API calls
  const clientCheckIn = useCallback(debounce(async () => {
    if (clientJWT != "") { return };

    try {
      const theJWT = await axios.post(
        serverURL + "/checkin",
        { serverPassphrase: serverPassphrase, sessionHash: sessionHash },
        { headers: { "Content-Type": "application/json" } },
      );

      const clientCheck = theJWT?.data || undefined;

      if (clientCheck) {
        const newToken = theJWT.data;
        setClientJWT(newToken);
        setCheckedIn(true);
        checkModels(newToken);
      }
    } catch (error) { console.log(error); }
  }, 250), [clientJWT, serverPassphrase, sessionHash]);

  function getRandomModel(modelsArray) {
    if (!modelsArray || modelsArray.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * modelsArray.length);
    return modelsArray[randomIndex];
  }

  //Ping the backend server for a list of Ollama locally downloaded list of models
  const checkModels = useCallback(debounce(async (bearer) => {
    if (localModels.length > 0) { return };

    try {
      const theModels = await axios.post(
        serverURL + "/getmodels",
        {},
        {
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${bearer}`,
          }
        },
      );

      const allModels = theModels.data;

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
        "Deepseek": deepseekAImodels,
        "OpenAI": openAImodels,
      };

      const randomOllama = getRandomModel(allModels);
      setModel(modelMapping[chatType]?.[0] || randomOllama);

      setChosenOllama({ name: randomOllama.name });
    } catch (error) { console.log(error); }
  }, 250), [serverURL, localModels, chatType]);

  //Event Handlers

  const handleChatTypeChange = useCallback((e) => {
    const selectedChatType = e.target.value;
    setChatType(selectedChatType);

    const modelMapping = {
      "Anthropic": { modelState: chosenAnthropic, list: anthropicAImodels },
      "Google": { modelState: chosenGoogle, list: googleAImodels },
      "Grok": { modelState: chosenGrokAI, list: grokAImodels },
      "Deepseek": { modelState: chosenDeepseekAI, list: deepseekAImodels },
      "OpenAI": { modelState: chosenOpenAI, list: openAImodels },
      "default": { modelState: chosenOllama, list: localModels }, //Ollama
    };

    const selected = modelMapping[selectedChatType] || modelMapping["default"];

    // Attempt to restore previous model choice, fallback to the first model if undefined.
    const previousSelectedModel = selected.modelState || selected.list[0];

    setModel(previousSelectedModel);
    setListModels(selected.list);
  }, [chosenOpenAI, chosenAnthropic, chosenGoogle, chosenGrokAI, chosenDeepseekAI, chosenOllama, localModels]);


  const handleModelChange = useCallback((e) => {
    const modelObj = { name: e.target.value };
    setModel(modelObj);

    const setChosenMapping = {
      "Anthropic": setChosenAnthropic,
      "Google": setChosenGoogle,
      "Grok": setChosenGrokAI,
      "Deepseek": setChosenDeepseekAI,
      "Ollama": setChosenOllama,
      "OpenAI": setChosenOpenAI,
    };

    (setChosenMapping[chatType] || setChosenOllama)(modelObj);
  }, [chatType]);

  const handleChange = useCallback((setter) => (e) => {
    setter(e.target.value);
  }, []);

  const handleSysMsgChange = handleChange(setSysMsg);
  const handleToppChange = handleChange(setTopp);
  const handleTopkChange = handleChange(setTopk);
  const handleTempChange = handleChange(setTemperature);
  const handleURLChange = handleChange(setServerURL);
  const handlePassphraseChange = handleChange(setServerPassphrase);

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

  //If only 1, 2 or 3 chats, then allow them to fill the horizontal space
  const getGridClasses = (itemCount) => {
    let classes = 'grid gap-3 place-items-center mt-1 ';
    if (itemCount === 1) {
      classes += 'min-w-[50%] place-self-center items-center justify-center sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1 2xl:grid-cols-1';
    } else if (itemCount === 2) {
      classes += 'sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2';
    } else if (itemCount === 3) {
      classes += 'sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3';
    } else {
      classes += 'sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
    }
    return classes;
  };

  const itemCount = componentList.length;

  return (
    <dataContext.Provider value={{ componentList, setComponentList, chatCount, setChatCount, chosenAnthropic, chosenGoogle, chosenGrokAI, chosenDeepseekAI, chosenOllama, chosenOpenAI, clientJWT, checkedIn }}>
      <div>
        <Spring
          from={{ opacity: 0 }}
          to={[
            { opacity: 1 }
          ]}
          delay={400}>
          {styles => (
            <animated.div style={styles} className="min-w-[50%] text-aro-100 place-self-center cursor-default bg-vonCount-600 bg-gradient-to-tl from-vonCount-700 rounded-3xl font-bold p-2 flex items-center justify-center">

              { /* Settings box */}
              <div className="w-full">
                <table className="min-w-full text-black">
                  <tbody>
                    <tr>
                      <td className="w-[10%] text-5xl text-center">
                        <a alt="GitHub" target="_blank" rel="noopener noreferrer" href="https://github.com/rossudev/llm-chatter"><i className="fa-solid fa-gear text-5xl text-aro-300 text-center mb-2"></i></a>
                      </td>
                      <td className="2xl:w-[90%] xl:w-[86%] lg:w-[82%] md:w-[78%] sm:w-[74%] text-3xl tracking-normal text-center items-center font-bold text-black cursor-context-menu">
                        <input className="hidden" type="checkbox" name="advancedSetting" id="advancedSettings" checked={advancedSetting} onChange={handleCheckboxChange} />
                        <label className="cursor-context-menu leading-6" htmlFor="advancedSettings">
                          <span className="mr-2 mb-2 flex items-center text-black">
                            <i className={`text-aro-200 text-5xl fa-solid fa-bars ml-4 p-4 hover:text-marcelin-900 ${advancedSetting ? 'fa-bars text-blade-500 fa-rotate-270' : 'hover:text-dracula-100 ml-4'}`}></i>
                            Settings
                          </span>
                        </label>
                      </td>
                    </tr>

                    { /* NodeJS server check display */}
                    <tr>
                      <td className="pb-4 pr-4">Server:</td>
                      <td className="pb-4 font-sans">
                        {serverCheck ?
                          <p><span className="text-blade-700">Online</span><span className="ml-6">{serverURL}</span></p>
                          :
                          <><p><span className="text-marcelin-900">Offline</span> <i className="fa-solid fa-triangle-exclamation text-marcelin-900 text-2xl"></i></p></>
                        }
                      </td>
                    </tr>
                    {!intervalIdRef.current &&
                      <tr>
                        <td></td>
                        <td>
                          <div onClick={debounce(() => { startInterval() }, 250)} className="bg-nosferatu-200 hover:bg-nosferatu-300 rounded-3xl text-2xl font-bold m-2 text-center p-4 cursor-pointer"><p>Connect</p></div>
                        </td>
                      </tr>
                    }
                    {(serverCheck && !checkedIn && serverPassphrase) &&
                      <tr>
                        <td></td>
                        <td>
                          <div onClick={debounce(() => { clientCheckIn() }, 250)} className="bg-nosferatu-200 hover:bg-nosferatu-300 rounded-3xl text-2xl font-bold m-2 text-center p-4 cursor-pointer mb-4"><p>Sign In</p></div>
                        </td>
                      </tr>
                    }
                        { /* { (serverCheck && (localModels.length === 0) && checkedIn) && */}
                        { /* <div onClick={debounce(() => { checkModels(clientJWT) }, 250)} className="bg-nosferatu-200 hover:bg-nosferatu-300 rounded-3xl text-2xl font-bold m-2 text-center p-4 cursor-pointer"><p>Connect Ollama</p></div> */}
                        { /* } */}

                    { /* Configure NodeJS server URL */}
                    {!serverCheck &&
                      <tr>
                        <td className="pb-4 pr-4">Server URL:</td>
                        <td className="pb-4">
                          <TextareaAutosize minRows="1" maxRows="2" className="w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-sans text-black rounded-xl" placeholder="http://localhost:8080" onChange={(e) => handleURLChange(e)} value={serverURL} />
                        </td>
                      </tr>
                    }

                    { /* NodeJS server passphrase */}
                    {!clientJWT &&
                      <tr>
                        <td className="pb-4 pr-4">Server Passphrase:</td>
                        <td className="pb-4 font-sans">
                          <input type="password" className="min-w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-sans text-black rounded-xl" placeholder="Server Passphrase" onChange={(e) => handlePassphraseChange(e)} value={serverPassphrase} />
                        </td>
                      </tr>
                    }



                    { /* System Message */}
                    { ( !chatType.includes("LangChain") && checkedIn ) &&
                      <tr>
                        <td className="pb-4 pr-4">
                          Starting Prompt:
                        </td>
                        <td>
                          <TextareaAutosize minRows="3" maxRows="5" className="min-w-full font-bold hover:bg-vonCount-300 bg-vonCount-200 p-4 text-sm font-sans text-black rounded-xl" placeholder="'System' Message" onChange={(e) => handleSysMsgChange(e)} value={sysMsg} />
                        </td>
                      </tr>
                    }

                    { /* LangChain Embed URL */}
                    { ( chatType.includes("LangChain") && checkedIn ) ?
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

                    { /* Input Type */}
                    { checkedIn &&
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
                    }

                    { /* Model Selection */}
                    { ( advancedSetting && checkedIn ) &&
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

                        { /* Temperature */}
                        <tr>
                          <td className="pb-4 pr-4">temperature:</td>
                          <td className="tracking-wide font-bold text-black">
                            <select name="temperature" id="temperature" className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer mb-2 p-4 min-w-24 font-sans rounded-xl text-black" onChange={(e) => handleTempChange(e)} value={temperature}>
                              <option value="0">0</option>
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
                              <option value="1">1</option>
                            </select>
                          </td>
                        </tr>

                        { /* top-p */}
                        <tr>
                          <td className="pb-4">top-p:</td>
                          <td className="tracking-wide font-bold text-black">
                            <select name="topp" id="topp" className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer mb-1 p-4 min-w-24 font-sans rounded-xl text-black" onChange={(e) => handleToppChange(e)} value={topp}>
                              <option value="0">0</option>
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
                              <option value="1">1</option>
                            </select>
                          </td>
                        </tr>

                        { /* top-k */}
                        {((chatType.includes("OpenAI")) || (chatType.includes("Grok")) || (chatType.includes("Deepseek"))) ?
                          <></> :
                          <tr>
                            <td className="pb-4">top-k:</td>
                            <td className="tracking-wide font-bold text-black">
                              <select name="topk" id="topk" className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer mb-1 p-4 min-w-24 font-sans rounded-xl text-black" onChange={(e) => handleTopkChange(e)} value={topk}>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                                <option value="5">5</option>
                                <option value="6">6</option>
                                <option value="7">7</option>
                                <option value="8">8</option>
                                <option value="9">9</option>
                                <option value="10">10</option>
                                <option value="11">11</option>
                                <option value="12">12</option>
                                <option value="13">13</option>
                                <option value="14">14</option>
                                <option value="15">15</option>
                                <option value="16">16</option>
                                <option value="17">17</option>
                                <option value="18">18</option>
                                <option value="19">19</option>
                                <option value="20">20</option>
                              </select>
                            </td>
                          </tr>
                        }
                      </>
                    }
                  </tbody>
                </table>

                { //New Chat button displays only when conditions allow.
                  !serverCheck || (chatType.includes("LangChain") && !urlValid) || !checkedIn ?
                    <></> :
                    <div className="grid gap-2 grid-cols-3 mt-6 mb-2">
                      <Spring
                        from={{ opacity: 0 }}
                        to={[
                          { opacity: 1 }
                        ]}
                        delay={200}>
                        {styles => (
                          <animated.div onClick={() => { debouncedMakeNewChat(chatType); }} style={styles} className="border-solid border-2 border-aro-800 self-start text-black place-self-center hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-2xl font-bold p-4 flex items-center justify-center mb-2 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-2xl hover:shadow-dracula-700 cursor-pointer">
                            <i className="fa-solid fa-keyboard mr-4"></i>
                            <h1>Text</h1>
                          </animated.div>
                        )}
                      </Spring>

                      { /* Info of selected model */}
                      <div className="col-span-2 rounded-lg border-solid border-2 border-aro-800 bg-aro-300 text-black self-start place-self-center text-center items-center justify-center p-2 cursor-text">
                        <p className="underline text-2xl">Text Model:</p>
                        <p className="text-xl">{model.name}</p>
                        {chatType.includes("LangChain") ?
                          <p><a className="underline hover:no-underline" alt={langchainURL} target="_blank" rel="noopener noreferrer" href={langchainURL}>{langchainURL}</a></p> :
                          <></>
                        }
                      </div>

                      { /* New Voice button */}
                      {(chatType.includes("OpenAI") && (!componentList.some(container => container.chatType.includes("(Voice)")))) ?
                        <>
                          <Spring
                            from={{ opacity: 0 }}
                            to={[
                              { opacity: 1 }
                            ]}
                            delay={300}>
                            {styles => (
                              <animated.div onClick={() => { debouncedMakeNewChat("(Voice)"); }} style={styles} className="border-solid border-2 border-aro-800 self-start text-black place-self-center hover:bg-nosferatu-300 cursor-default bg-nosferatu-200 rounded-3xl text-2xl font-bold p-4 flex items-center justify-center mb-1 bg-gradient-to-tl from-nosferatu-500 hover:from-nosferatu-600 shadow-2xl hover:shadow-buffy-700 shadow-xl cursor-pointer">
                                <i className="fa-solid fa-microphone-lines mr-4"></i>
                                <h1>Voice</h1>
                              </animated.div>
                            )}
                          </Spring>
                          <div className="col-span-2 rounded-lg border-solid border-2 border-aro-800 bg-aro-300 text-black self-start place-self-center text-center items-center justify-center p-2 cursor-text">
                            <p className="underline text-2xl">Voice Model:</p>
                            <p className="text-xl">gpt-4o-realtime-preview</p>
                          </div>
                        </> :
                        <></>
                      }
                    </div>
                }
              </div>
            </animated.div>
          )}
        </Spring>
      </div>

      { /* All the Chats */}
      <div className={getGridClasses(itemCount)}>
        {componentList.slice().reverse().map((container) => (
          container.chatType.includes("(Voice)") ? (
            <ConsolePage
              key={container.id}
              instructions={container.systemMessage}
              closeID={container.id}
              numba={container.numba}
              relayWS={relayWS}
            />
          ) : (
            <Chat
              key={container.id}
              closeID={container.id}
              systemMessage={container.systemMessage}
              chatType={container.chatType}
              model={container.model}
              temperature={container.temperature}
              topp={container.topp}
              topk={container.topk}
              numba={container.numba}
              langchainURL={container.langchainURL}
              listModels={container.listModels}
              serverURL={container.serverURL}
              modelOptions={container.modelOptions}
              localModels={container.localModels}
              visionModels={Config.visionModels}
            />
          )
        ))}
      </div>
    </dataContext.Provider>
  );
}

export default App;