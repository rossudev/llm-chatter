import { useState, useCallback, useContext } from "react";
import Hyphenated from "react-hyphen";
import { animated, Spring } from "react-spring";
import TextareaAutosize from "react-textarea-autosize";
import axios from "axios";
import copy from "copy-to-clipboard";
import { debounce } from "lodash";
import XClose from "./XClose";
import CopyButton from "./CopyButton";
import ContentText from "./ContentText";
import FileUploader from "./FileUploader";
import { dataContext } from "../Chatter";
import Config from "../Config";
import Cookies from "js-cookie";

const Chat = ({
  closeID,
  numba,
  systemMessage,
  chatType,
  model,
  temperature,
  topp,
  topk,
  listModels,
  serverURL,
  modelOptions,
  localModels,
  sessionHash,
  serverUsername,
  messages,
  context,
  thread,
  restoreID,
}) => {
  const {
    componentList,
    setComponentList,
    chatCount,
    setChatCount,
    chosenAnthropic,
    chosenGoogle,
    chosenGrokAI,
    chosenMetaAI,
    chosenDeepseekAI,
    chosenOllama,
    chosenOpenAI,
    clientJWT,
    checkedIn,
    setClientJWT,
    setCheckedIn,
  } = useContext(dataContext);

  let sysMsgs = [];
  let firstMeta = [];

  const uniqueChatID = sessionHash + numba;

  const nonOpenAIChatTypes = ["Anthropic", "Google"];

  const setMessagesAndMeta = useCallback((isDefault = true) => {
    const hasMessages = Object.keys(messages).length > 0;
    const noSystemMeta =
      Config.reasoningModels.includes(model) ||
      Config.imgOutputModels.includes(model);

    sysMsgs = [];
    firstMeta = [];

    if (isDefault && !hasMessages && !noSystemMeta) {
      sysMsgs = [{ role: "system", content: systemMessage }];
      firstMeta = [["Starting Prompt", ""]];
    }
  });

  // Only run this logic on first render
  useState(() => {
    const noSystemMeta =
      Config.reasoningModels.includes(model) ||
      Config.imgOutputModels.includes(model);

    if (nonOpenAIChatTypes.includes(chatType)) {
      setMessagesAndMeta(false);
    } else {
      // OpenAI
      if (noSystemMeta) {
        setMessagesAndMeta(false);
      } else {
        setMessagesAndMeta(true);
      }
    }
  });

  const convertFormat = useCallback((inputData) => {
    const result = [];

    // Sort by item number to ensure correct order
    const sortedKeys = Object.keys(inputData).sort((a, b) => {
      const numA = parseInt(a.split("_")[1]);
      const numB = parseInt(b.split("_")[1]);
      return numA - numB;
    });

    for (const key of sortedKeys) {
      const item = inputData[key];

      // Determine the content format based on role
      let content;
      if (item.r === "assistant") {
        // Assistant content is just a string
        content = item.z;
      } else {
        // System and user content are arrays with type and text
        content = [{ type: "text", text: item.z }];
      }

      result.push({
        role: item.r,
        content: content,
      });
    }

    return result;
  });

  const makeMetas = useCallback((inputData) => {
    const result = [];

    const noSystemMeta =
      Config.reasoningModels.includes(model) ||
      Config.imgOutputModels.includes(model);

    if (noSystemMeta) {
      return result;
    }

    // Sort by item number to ensure correct order
    const sortedKeys = Object.keys(inputData).sort((a, b) => {
      const numA = parseInt(a.split("_")[1]);
      const numB = parseInt(b.split("_")[1]);
      return numA - numB;
    });

    for (const key of sortedKeys) {
      const item = inputData[key];
      const whichPrompt = item.r === "system" ? "Starting Prompt" : "Prompt";
      result.push([item.r === "assistant" ? item.m : whichPrompt, item.d]);
    }

    return result;
  });

  const hasMessages = Object.keys(messages).length > 0;
  const theMsgs = hasMessages ? convertFormat(messages) : sysMsgs;

  const [streamInput, setStreamInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [base64Image, setBase64Image] = useState("");
  const [textAttachment, setTextAttachment] = useState("");
  const [fileFormat, setFileFormat] = useState("");
  const [imageOutput, setImageOutput] = useState("");
  const [imgQuality, setImgQuality] = useState("medium");
  const [imgSize, setImgSize] = useState("1024x1024");
  const [messageMetas, setMessageMetas] = useState(
    hasMessages ? makeMetas(messages) : firstMeta
  );
  const [chatMessages, setChatMessages] = useState(theMsgs);
  const [chatMessagesPlusMore, setChatMessagesPlusMore] = useState(theMsgs);
  const [addedModels, setAddedModels] = useState([]);
  const [chatContext, setChatContext] = useState(context);
  const [addSetting, setAddSetting] = useState(true);
  const [isClicked, setIsClicked] = useState(false);
  const [isError, setIsError] = useState(false);
  const [sentOne, setSentOne] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const [tempOutput, setTempOutput] = useState("");
  const [pending, setPending] = useState(false);
  const [going, setGoing] = useState(true);

  const fetchData = useCallback(async (input, modelThisFetch) => {
    let endPath = "";
    let sendPacket = {};
    const isImgOutput = Config.imgOutputModels.includes(modelThisFetch);

    const inputWithAttachment = textAttachment
      ? input + "\n\n" + textAttachment
      : input;
    let msgs = chatMessages.concat({
      role: "user",
      content: [{ type: "text", text: inputWithAttachment }],
    });

    const visionMsg =
      chatType === "Anthropic"
        ? {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: fileFormat,
                  data: base64Image.split(",")[1],
                },
              },
              {
                type: "text",
                text: "Image.",
              },
            ],
          }
        : chatType === "OpenAI"
        ? {
            role: "user",
            content: [
              {
                type: "text",
                text: "Image.",
              },
              {
                type: "image_url",
                image_url: { url: base64Image },
              },
            ],
          }
        : null; //Closes Anthropic/OpenAI image handling.

    let imagesToSend = [];
    if (base64Image && fileFormat) {
      // Create an object with mimeType and data directly, as the server loop expects
      imagesToSend.push({
        mimeType: fileFormat, // e.g., "image/jpeg", "image/png"
        data: base64Image.split(",")[1], // Ensure you only send the Base64 part
      });
    }

    if (
      !sentOne &&
      base64Image &&
      Config.visionModels.includes(modelThisFetch) &&
      chatType !== "Google"
    ) {
      msgs = msgs.concat(visionMsg);
    }

    switch (chatType) {
      case "OpenAI":
        endPath = serverURL + "/openai";
        sendPacket = {
          messages: msgs,
          temperature: parseFloat(temperature),
          top_p: parseFloat(topp),
          stream: !isImgOutput,
        };
        break;

      case "Grok":
        endPath = serverURL + "/grok";
        sendPacket = {
          messages: msgs,
          temperature: parseFloat(temperature),
          top_p: parseFloat(topp),
          top_k: parseFloat(topk),
          stream: !isImgOutput,
        };
        break;

      case "Meta":
        endPath = serverURL + "/meta";
        sendPacket = {
          messages: msgs,
          temperature: parseFloat(temperature),
          top_p: parseFloat(topp),
          top_k: parseFloat(topk),
          stream: !isImgOutput,
        };
        break;

      case "Deepseek":
        endPath = serverURL + "/deepseek";
        sendPacket = {
          messages: msgs,
          temperature: parseFloat(temperature),
          top_p: parseFloat(topp),
          top_k: parseFloat(topk),
          stream: !isImgOutput,
        };
        break;

      case "Anthropic":
        endPath = serverURL + "/anthropic";
        sendPacket = {
          messages: msgs,
          temperature: parseFloat(temperature),
          top_p: parseFloat(topp),
          top_k: parseFloat(topk),
          system: systemMessage,
        };
        break;

      case "Google":
        endPath = serverURL + "/google";
        sendPacket = {
          messages: msgs,
          temperature: parseFloat(temperature),
          top_p: parseFloat(topp),
          top_k: parseFloat(topk),
          system: systemMessage,
          prompt: input,
        };
        break;

      default: //Ollama
        endPath = serverURL + "/ollama";
        sendPacket = {
          prompt: input,
          system: systemMessage,
          context: chatContext,
          options: {
            temperature: parseFloat(temperature),
            top_p: parseFloat(topp),
            top_k: parseFloat(topk),
          },
          keep_alive: 0,
          images: base64Image ? [base64Image.split(",")[1]] : [],
        };
        break;
    }

    if (imagesToSend !== null) {
      sendPacket.images = imagesToSend;
    }

    sendPacket.uniqueChatID = uniqueChatID;
    sendPacket.model = modelThisFetch;
    sendPacket.sentOne = sentOne;
    sendPacket.serverUsername = serverUsername;
    sendPacket.thread = thread;
    sendPacket.imgOutput = isImgOutput;
    sendPacket.imgQuality = imgQuality;
    sendPacket.imgSize = imgSize;
    sendPacket.imgInput = base64Image ? true : false;

    const isStreaming =
      (chatType === "OpenAI" ||
        chatType === "Grok" ||
        chatType === "Deepseek" ||
        chatType === "Meta") &&
      !isImgOutput;
    try {
      const startTime = Date.now();
      let response;
      let output = "";
      if (isStreaming) {
        setGoing(true);
        response = await fetch(endPath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clientJWT}`,
          },
          body: JSON.stringify(sendPacket),
        });
        // Stream reading
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        setPending(true);
        while (going) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop();
          for (const event of events) {
            const match = event.match(/^data:\s*(.*)$/m);
            if (match) {
              let text = match[1];
              if (text === "[DONE]") {
                setPending(false);
                setGoing(false);
                break;
              }
              try {
                text = JSON.parse(text);
              } catch (error) {
                console.log(error);
                continue;
              }
              // Safely extract the content string from the chunk
              const content = text.choices?.[0]?.delta?.content;
              if (typeof content === "string") {
                output += content;
                setTempOutput(output);
              }
            }
          }
        }
        setPending(false);
      } else {
        response = await axios.post(endPath, sendPacket, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clientJWT}`,
          },
        });
        output = response.data.response || "";
      }
      const endTime = Date.now();
      const durTime = ((endTime - startTime) / 1000).toFixed(2);
      const normalizeText = (text) => text.trim().replace(/\n+/g, "\n");
      let theEnd;
      switch (chatType) {
        case "OpenAI":
        case "Grok":
        case "Deepseek":
        case "Meta":
          theEnd = isImgOutput
            ? [{ type: "text", text: "Image Output." }]
            : [{ type: "text", text: output }];
          if (isImgOutput) setImageOutput(response.data.base64);
          break;
        case "Anthropic":
          theEnd = normalizeText(response.data.content[0].text);
          break;
        case "Google":
          theEnd = [{ type: "text", text: normalizeText(response.data) }];
          break;
        default:
          // Handles Ollama
          theEnd = response.data.response;
          setChatContext(response.data.context);
          break;
      }
      return [theEnd, durTime];
    } catch (error) {
      setIsError(true);
      console.error(error);
      let errorMessage = "An error occurred.";

      if (error.response.status === 503) {
        errorMessage = "Model Overloaded. Try again later.";
      }

      if (error.response.status === 401) {
        errorMessage = "Session Expired. Please log in again.";

        setCheckedIn(false);
        Cookies.set("checkedIn", JSON.stringify(false), { expires: 1 });

        setClientJWT("");
        Cookies.set("clientJWT", JSON.stringify(""), { expires: 1 });
      }

      return [[{ type: "text", text: errorMessage }], 0];
    }
  });

  const handleInput = useCallback(
    debounce(
      async (input, isVoice = false) => {
        if (input) {
          setIsClicked(true);
          setStreamInput(input);

          if (!isVoice) {
            setChatInput("");
          }

          const finalInput = [input, ""];

          try {
            const chatOut = await fetchData(finalInput[0], model);

            const chatNewMsg = chatMessages.concat(
              {
                role: "user",
                content: [{ type: "text", text: finalInput[0] }],
              },
              { role: "assistant", content: chatOut[0] }
            );
            setChatMessages(chatNewMsg);

            const newMeta = [
              ["Prompt", finalInput[1]],
              [model, chatOut[1] + "s"],
            ];
            setMessageMetas((prevMetas) => prevMetas.concat(newMeta));

            setChatMessagesPlusMore((prevMessages) =>
              prevMessages.concat(
                {
                  role: "user",
                  content: [{ type: "text", text: finalInput[0] }],
                },
                { role: "assistant", content: chatOut[0] }
              )
            );

            if (addedModels.length === 0) {
              setSentOne(true);
              setIsClicked(false);
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
              setMessageMetas((prevAddedMetas) =>
                prevAddedMetas.concat(newAddedMeta)
              );

              setChatMessagesPlusMore((prevMessages) =>
                prevMessages.concat({
                  role: "assistant",
                  content: chatOutEach[0],
                })
              );
            } catch (error) {
              setIsClicked(false);
              console.error(error);
              setIsError(true);
            } finally {
              setSentOne(true);
              setIsClicked(false);
            }
          }
        }
      },
      1000,
      { leading: true, trailing: false }
    )
  );

  const handleSizeChange = useCallback((size) => {
    setImgSize(size.target.value);
  });

  const handleQualityChange = useCallback((quality) => {
    setImgQuality(quality.target.value);
  });

  const handleChat = useCallback(() => handleInput(chatInput, false));

  const handleAddModel = useCallback((model) => {
    const newModelArray = [...addedModels, model];
    setAddedModels(newModelArray);
  });

  const handleDeleteModel = useCallback((model) => {
    const index = addedModels.indexOf(model);

    if (index !== -1) {
      // Check if the model exists in the array
      const newModelArray = [
        ...addedModels.slice(0, index), // All models before the model to delete
        ...addedModels.slice(index + 1), // All models after the model to delete
      ];
      setAddedModels(newModelArray);
    }
  });

  const handleModelToggle = useCallback(() => {
    setAddSetting(!addSetting);
  });

  const handleEnterKey = useCallback((event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleChat();
    }
  });

  const chatHandler = useCallback(() => (event) => {
    const value = event.target.value;
    setChatInput(value);
  });

  const handlePaste = useCallback((event) => {
    if (!sentOne) {
      const items = event.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          const reader = new FileReader();

          reader.onload = (e) => {
            setBase64Image(e.target.result);
            setFileFormat(blob.type);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  });

  const handleCopy = useCallback((e) => {
    e.preventDefault();

    const selectedText = document.getSelection().toString();

    //Remove soft hyphens
    const textContent = selectedText.replace(/\xAD/g, "");

    navigator.clipboard.writeText(textContent);
  });

  const copyClick = useCallback((value) => {
    if (typeof value === "string") {
      copy(value);
    }
  });

  const getContentText = useCallback((content) => {
    if (Array.isArray(content)) {
      // If content is an array, access the text property of the first element
      return content[0]?.text || "";
    } else {
      // If content is a string, return it directly
      return content || "";
    }
  });

  const onClose = useCallback((id) => {
    setComponentList(componentList.filter((container) => container.id !== id));
  });

  const ToggleImageSize = useCallback(() => {
    setIsExpanded((prev) => !prev);
  });

  const makeNewChat = useCallback((chosenType) => {
    const modelArray = modelOptions[chosenType];
    let pickModel = modelArray[0];

    //chosenAnthropic, chosenGoogle, chosenGrokAI, chosenOllama, chosenOpenAI
    switch (chosenType) {
      case "Anthropic":
        pickModel = chosenAnthropic;
        break;
      case "Google":
        pickModel = chosenGoogle;
        break;
      case "Grok":
        pickModel = chosenGrokAI;
        break;
      case "Deepseek":
        pickModel = chosenDeepseekAI;
        break;
      case "Meta":
        pickModel = chosenMetaAI;
        break;
      case "Ollama":
        pickModel = chosenOllama;
        break;
      case "OpenAI":
        pickModel = chosenOpenAI;
        break;
    }

    const newChat = {
      id: Date.now(),
      numba: chatCount,
      systemMessage: systemMessage,
      chatType: chosenType,
      model: pickModel.name,
      temperature: temperature,
      topp: topp,
      topk: topk,
      localModels: localModels,
      listModels: modelArray,
      serverURL: serverURL,
      modelOptions: modelOptions,
      messages: {},
      context: [],
      thread: [],
      restoreID: "",
    };

    setComponentList([...componentList, newChat]);
    setChatCount(chatCount + 1);
  });

  //let checkDuplicates = "";

  return (
    <Spring from={{ opacity: 0 }} to={[{ opacity: 1 }]} delay={80}>
      {(styles) => (
        <animated.div
          style={styles}
          className="min-w-[100%] self-start mt-2 mb-2 inline p-0 bg-nosferatu-200 rounded-3xl bg-gradient-to-tl from-nosferatu-500 shadow-sm"
        >
          {/* Chat ID number, Type of Model, X-Close button */}
          <table className="min-w-[100%] border-separate border-spacing-y-2 border-spacing-x-2">
            <tbody>
              <tr>
                <td
                  colSpan="3"
                  className="pb-4 tracking-wide text-4xl text-center font-bold text-black"
                >
                  <span className="mr-6">#{numba}</span>
                  <i className="fa-regular fa-comments mr-6 text-nosferatu-800" />
                  {chatType}
                </td>
                <td>
                  <XClose onClose={onClose} closeID={closeID} />
                </td>
              </tr>

              {/* Two model types store the System message differently */}
              {(chatType.includes("Anthropic") ||
                chatType.includes("Google")) &&
                !hasMessages && (
                  <tr>
                    <td
                      onCopy={handleCopy}
                      colSpan="4"
                      className="py-3 p-3 bg-morbius-300 font-sans rounded-xl text-black-800 text-md whitespace-pre-wrap"
                    >
                      <div className="mb-3 grid grid-cols-3">
                        <span className="font-bold text-xl text-aro-900">
                          Starting Prompt
                        </span>
                        <span></span>
                        <span className="text-right cursor-copy">
                          <i
                            onClick={() => copyClick(systemMessage)}
                            className="text-aro-900 m-2 fa-solid fa-copy fa-2x cursor-copy shadow-xl hover:shadow-dracula-900"
                          ></i>
                        </span>
                      </div>
                      <div>
                        <Hyphenated className="text-black">
                          {systemMessage}
                        </Hyphenated>
                      </div>
                    </td>
                  </tr>
                )}

              {/* Prompts and All Models' Responses */}
              {chatMessagesPlusMore.map((obj, index) => {
                const contentText = getContentText(obj.content);

                return (
                  <tr key={index}>
                    <td
                      onCopy={handleCopy}
                      colSpan="4"
                      className={
                        obj.role === "user" || obj.role === "system"
                          ? "py-3 p-3 bg-morbius-300 font-sans rounded-xl text-black-800 text-md whitespace-pre-wrap"
                          : "py-3 whitespace-pre-wrap p-3 bg-nosferatu-100 font-mono rounded-xl text-black text-sm"
                      }
                    >
                      {messageMetas[index] && messageMetas[index].length > 0 ? (
                        <div className="mb-3 grid grid-cols-3">
                          <span className="font-bold text-xl text-aro-900">
                            {messageMetas[index][0]}
                          </span>
                          <span className="text-center text-sm text-aro-900">
                            {messageMetas[index][1]}
                          </span>
                          <span className="text-right">
                            <CopyButton
                              contentText={contentText}
                              copyClick={copyClick}
                            />
                          </span>
                        </div>
                      ) : (
                        <div className="mb-3 text-center text-sm text-aro-900">
                          Error
                        </div>
                      )}
                      {imageOutput && obj.role === "assistant" ? (
                        <img
                          onClick={ToggleImageSize}
                          src={"data:image/jpeg;base64," + imageOutput}
                          alt="Image Output"
                          style={{
                            width: isExpanded ? "100%" : "300px",
                            cursor: "pointer",
                            marginTop: "10px",
                          }}
                        />
                      ) : (
                        <ContentText role={obj.role} txt={contentText} />
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Streaming reply */}
              {pending ? (
                <>
                  <tr>
                    <td
                      onCopy={handleCopy}
                      colSpan="4"
                      className="py-3 p-3 bg-morbius-300 font-sans rounded-xl text-black-800 text-md whitespace-pre-wrap"
                    >
                      <div className="mb-3 grid grid-cols-3">
                        <span className="font-bold text-xl text-aro-900">
                          Prompt
                        </span>
                        <span></span>
                        <span className="text-right">
                          <CopyButton
                            contentText={streamInput}
                            copyClick={copyClick}
                          />
                        </span>
                      </div>
                      <div>
                        <ContentText role="user" txt={streamInput} />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td
                      onCopy={handleCopy}
                      colSpan="4"
                      className="py-3 whitespace-pre-wrap p-3 bg-nosferatu-100 font-mono rounded-xl text-black text-sm"
                    >
                      <div className="mb-3">
                        <span className="font-bold text-xl text-aro-900">
                          {model}
                        </span>
                      </div>
                      <ContentText role="assistant" txt={tempOutput} />
                    </td>
                  </tr>
                </>
              ) : (
                <></>
              )}

              {/* Regular text chat input box, and the Send button */}
              {(!isError || !sentOne) && !imageOutput && (
                <tr>
                  <td colSpan="3">
                    <TextareaAutosize
                      autoFocus
                      onKeyDown={checkedIn ? handleEnterKey : null}
                      onChange={chatHandler()}
                      onPaste={handlePaste}
                      minRows="3"
                      maxRows="15"
                      className="placeholder:text-6xl placeholder:italic mt-3 p-4 min-w-[100%] bg-nosferatu-100 text-sm font-mono text-black rounded-xl"
                      placeholder={
                        Config.imgOutputModels.includes(model)
                          ? "Image"
                          : "Chat"
                      }
                      value={chatInput}
                    />
                  </td>
                  <td className="items-baseline justify-evenly text-center align-middle text-4xl">
                    {checkedIn ? (
                      <i
                        onClick={!isClicked ? () => handleChat() : null}
                        className={
                          isClicked
                            ? "text-dracula-900 mt-4 m-2 fa-solid fa-hat-wizard fa-2x cursor-pointer hover:text-dracula-100"
                            : "text-blade-300 mt-4 m-2 fa-solid fa-message fa-2x cursor-pointer hover:text-vanHelsing-700"
                        }
                      />
                    ) : (
                      <i className="fa-solid fa-triangle-exclamation text-marcelin-900 text-4xl" />
                    )}
                  </td>
                </tr>
              )}

              {/*  Settings */}

              <tr>
                <td colSpan={4}>
                  <FileUploader
                    base64Image={base64Image}
                    setBase64Image={setBase64Image}
                    textAttachment={textAttachment}
                    setTextAttachment={setTextAttachment}
                    sentOne={sentOne}
                    setFileFormat={setFileFormat}
                  />
                </td>
              </tr>
              {!Config.imgOutputModels.includes(model) ? (
                <>
                  <tr className="align-top">
                    {/*  Model info */}
                    <td className="w-1/2 bg-blade-200 rounded-xl bg-gradient-to-tl from-blade-400 p-2">
                      <table className="min-w-[100%]">
                        <tbody>
                          <tr>
                            <td className="min-w-[100%]">
                              <p className="mb-2">
                                <i className="fa-solid fa-splotch text-2xl text-dracula-500 ml-1"></i>{" "}
                                {addedModels.length > 0 ? (
                                  <b>Models:</b>
                                ) : (
                                  <b>Model:</b>
                                )}
                              </p>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <ul>
                                <li>
                                  <i className="fa-solid ml-4 fa-caret-right text-sm text-dracula-500"></i>{" "}
                                  {model}
                                </li>
                                {addedModels.map((model, index) => (
                                  <li key={index}>
                                    <i className="fa-solid ml-4 fa-caret-right text-sm text-dracula-500"></i>{" "}
                                    <span
                                      onClick={() => handleDeleteModel(model)}
                                      className="hover:underline"
                                    >
                                      {model}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>

                    {/* temperature info */}
                    <td className="w-1/6 bg-vanHelsing-200 rounded-xl bg-gradient-to-tl from-vanHelsing-500">
                      <table>
                        <tbody>
                          <tr className="align-top">
                            <td className="w-1/6">
                              <i className="ml-2 fa-solid fa-temperature-three-quarters text-2xl text-buffy-500"></i>
                            </td>
                            <td className="w-5/6 p-1">
                              <b>temp:</b>
                              <br />
                              <i className="fa-solid fa-caret-right text-sm text-buffy-900"></i>{" "}
                              {temperature}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>

                    {/* top-p info */}
                    <td
                      colSpan={
                        chatType.includes("OpenAI") ||
                        chatType.includes("Grok") ||
                        chatType.includes("Deepseek") ||
                        chatType.includes("Meta")
                          ? 2
                          : 1
                      }
                      className="w-1/6 bg-cullen-200 rounded-xl bg-gradient-to-tl from-cullen-500"
                    >
                      <table>
                        <tbody>
                          <tr className="align-top">
                            <td className="w-1/6">
                              <i className="ml-2 fa-brands fa-react text-2xl text-vanHelsing-900"></i>
                            </td>
                            <td className="w-5/6 p-1">
                              <b>top-p:</b>
                              <br />
                              <i className="fa-solid fa-caret-right text-sm text-vanHelsing-900"></i>{" "}
                              {topp}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>

                    {/* top-k info */}
                    {chatType.includes("OpenAI") ||
                    chatType.includes("Grok") ||
                    chatType.includes("Deepseek") ||
                    chatType.includes("Meta") ? (
                      <></>
                    ) : (
                      <td className="w-1/6 bg-cullen-200 rounded-xl bg-gradient-to-tl from-cullen-500">
                        <table>
                          <tbody>
                            <tr className="align-top">
                              <td className="w-1/6">
                                <i className="ml-2 fa-solid fa-square-poll-horizontal text-2xl text-vanHelsing-900"></i>
                              </td>
                              <td className="w-5/6 p-1">
                                <b>top-k:</b>
                                <br />
                                <i className="fa-solid fa-caret-right text-sm text-vanHelsing-900"></i>{" "}
                                {topk}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    )}
                  </tr>

                  {/* Add Models interface */}
                  <tr className="align-top over">
                    <td colSpan="2" className="w-1/2">
                      {(!isError || !sentOne) && (
                        <>
                          {addSetting ? (
                            <div className="bg-blade-100 rounded-xl pb-2 pl-2">
                              <table className="min-w-[100%]">
                                <tbody>
                                  <tr>
                                    <td className="min-w-[100%] pl-4">
                                      <i
                                        className="cursor-pointer mb-3 mt-2 fa-solid fa-plus text-blade-800 text-3xl hover:text-marcelin-900 fa-rotate-by"
                                        style={{ "--fa-rotate-angle": "45deg" }}
                                        onClick={handleModelToggle}
                                      ></i>
                                      <span
                                        className="ml-4 font-bold hover:underline cursor-pointer hover:text-marcelin-900"
                                        onClick={handleModelToggle}
                                      >
                                        Add Model:
                                      </span>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td>
                                      <ul>
                                        {listModels.map((model, index) => (
                                          <li key={index}>
                                            <span
                                              className="ml-4 text-sm hover:text-aro-500 hover:underline hover:font-bold hover:cursor-pointer"
                                              onClick={() =>
                                                handleAddModel(model.name)
                                              }
                                            >
                                              <i className="fa-solid fa-caret-right text-sm text-blade-700 mr-1"></i>
                                              {model.name +
                                                (Config.visionModels.includes(
                                                  model.name
                                                )
                                                  ? " *"
                                                  : "")}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="bg-blade-100 rounded-xl mb-1">
                              <i
                                className="cursor-pointer m-3 ml-6 fa-solid fa-plus text-2xl hover:text-blade-800"
                                onClick={handleModelToggle}
                              ></i>{" "}
                              <span
                                className="cursor-pointer hover:underline hover:text-blade-800"
                                onClick={handleModelToggle}
                              >
                                Add Model
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    {/* Copy System & first user prompt to a new Chat */}
                    <td colSpan={2} className="w-1/2">
                      <div className="bg-dracula-300 rounded-xl p-4 text-sm">
                        <p className="font-bold mb-1 text-base">New Chat:</p>
                        {Object.keys(modelOptions).map((optionKey) => (
                          <p key={optionKey}>
                            <i className="fa-solid fa-caret-right text-sm text-vanHelsing-900 mr-1 mb-1"></i>{" "}
                            <span
                              className="hover:underline hover:font-bold cursor-pointer"
                              onClick={() => makeNewChat(optionKey)}
                            >
                              {optionKey}
                            </span>
                          </p>
                        ))}
                      </div>
                    </td>
                  </tr>
                </>
              ) : (
                /* Image Output Models */
                <>
                  <tr className="align-top">
                    <td
                      colSpan={2}
                      className="w-1/2 bg-blade-200 rounded-xl bg-gradient-to-tl from-blade-400 p-2"
                    >
                      <table className="min-w-[100%]">
                        <tbody>
                          <tr>
                            <td className="min-w-[100%]">
                              <p className="mb-2">
                                <i className="fa-solid fa-splotch text-2xl text-dracula-500 ml-1"></i>{" "}
                                <b>Model:</b>
                              </p>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <i className="fa-solid ml-4 fa-caret-right text-sm text-dracula-500"></i>{" "}
                              {model}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                    <td
                      colSpan={2}
                      className="w-1/2 bg-cullen-200 rounded-xl bg-gradient-to-tl from-cullen-500"
                    >
                      <table className="min-w-[100%]">
                        <tbody>
                          <tr className="align-top">
                            <td className="w-1/6 items-baseline justify-evenly text-center align-middle">
                              <i className="ml-2 fa-solid fa-square-poll-horizontal text-2xl text-vanHelsing-900 text-3xl"></i>
                            </td>
                            <td className="w-5/6 p-1">
                              <b>Size:</b>
                              <br />
                              <select
                                name="imgSize"
                                id="imgSize"
                                value={imgSize}
                                onChange={(e) => handleSizeChange(e)}
                                className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer p-4 min-w-full font-sans rounded-xl text-black"
                              >
                                <option value="1536x1024">Landscape</option>
                                <option value="1024x1536">Portrait</option>
                                <option value="1024x1024">Square</option>
                              </select>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                  <tr className="align-top">
                    <td
                      colSpan="2"
                      className="w-1/2 bg-aro-200 rounded-xl bg-gradient-to-tl from-aro-500"
                    >
                      <table className="min-w-[100%]">
                        <tbody>
                          <tr className="align-top">
                            <td className="w-1/6 items-baseline justify-evenly text-center align-middle">
                              <i className="ml-2 fa-solid fa-square-poll-horizontal text-2xl text-vanHelsing-900 text-3xl"></i>
                            </td>
                            <td className="w-5/6 p-1">
                              <b>Quality:</b>
                              <br />
                              <select
                                name="imgQuality"
                                id="imgQuality"
                                value={imgQuality}
                                onChange={(e) => handleQualityChange(e)}
                                className="hover:bg-vonCount-300 bg-vonCount-200 cursor-pointer p-4 min-w-full font-sans rounded-xl text-black"
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </animated.div>
      )}
    </Spring>
  );
};

export default Chat;
