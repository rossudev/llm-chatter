/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { useEffect, useRef, useCallback, useState, useContext, React } from 'react';
import Hyphenated from "react-hyphen";
import { RealtimeClient } from '@openai/realtime-api-beta';
import { WavRecorder, WavStreamPlayer } from '../wavtools/index.js';
import { WavRenderer } from '../utils/wav_renderer';
import { X, Zap, ArrowUp, ArrowDown } from 'react-feather';
import copy from "copy-to-clipboard";
import ContentText from "../components/ContentText";
import { Button } from './Button';
import { Toggle } from './Toggle';
import './ConsolePage.scss';
import { dataContext } from "../App";
import XClose from "../components/XClose";

/**
 * ConsolePage Component
 */
export const ConsolePage = ({ instructions, closeID, numba, relayWS }) => {
    const { clientJWT, checkedIn, componentList, setComponentList } = useContext(dataContext);

    const onClose = useCallback((id) => {
        setComponentList(componentList.filter((container) => container.id !== id));
    })

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef(new WavRecorder({ sampleRate: 24000 }));
  const wavStreamPlayerRef = useRef(new WavStreamPlayer({ sampleRate: 24000 }));
  const clientRef = useRef(new RealtimeClient({ url: relayWS }));
  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef(null);
  const serverCanvasRef = useRef(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef(null);
  const startTimeRef = useRef(new Date().toISOString());
  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState([]);
  const [realtimeEvents, setRealtimeEvents] = useState([]);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState({});
  const [coords, setCoords] = useState({
    lat: 37.775593,
    lng: -122.418137,
  });
  const [marker, setMarker] = useState(null);
  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60000) % 60;
    const pad = (n) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);
  /**
   * Connect to conversation:
   * WavRecorder takes speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    if (!checkedIn) {return};

    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());
    // Connect to microphone
    await wavRecorder.begin();
    // Connect to audio output
    await wavStreamPlayer.connect();
    // Connect to realtime API
    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
        // text: `For testing purposes, I want you to list ten car brands. Number each item, e.g. "one (or whatever number you are one): the item name".`
      },
    ]);
    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);
  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    setCoords({
      lat: 37.775593,
      lng: -122.418137,
    });
    setMarker(null);
    const client = clientRef.current;
    client.disconnect();
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();
    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);
  const deleteConversationItem = useCallback(async (id) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);
  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */
  const startRecording = async () => {
    if (!checkedIn) {disconnectConversation; return};
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };
  /**
   * In push-to-talk mode, stop recording
   */
  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };
  /**
   * Switch between Manual <> VAD mode for communication
   */
  const changeTurnEndType = async (value) => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    if (value === 'none' && wavRecorder.getStatus() === 'recording') {
      await wavRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    });
    if (value === 'server_vad' && client.isConnected()) {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === 'none');
  };
  /**
   * Auto-scroll the event logs
   */
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);
  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = Array.from(
      document.querySelectorAll('[data-conversation-content]')
    );
    conversationEls.forEach((el) => {
      el.scrollTop = el.scrollHeight;
    });
  }, [items]);
  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;
    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx = null;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx = null;
    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();
    return () => {
      isLoaded = false;
    };
  }, []);
  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;
    // Set instructions
    client.updateSession({ instructions: instructions });
    // Set transcription, otherwise we don't get user transcriptions back
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });
    // Add tools
    client.addTool(
      {
        name: 'set_memory',
        description: 'Saves important data about the user into memory.',
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'The key of the memory value. Always use lowercase and underscores, no other characters.',
            },
            value: {
              type: 'string',
              description: 'Value can be anything represented as a string',
            },
          },
          required: ['key', 'value'],
        },
      },
      async ({ key, value }) => {
        setMemoryKv((memoryKv) => {
          const newKv = { ...memoryKv };
          newKv[key] = value;
          return newKv;
        });
        return { ok: true };
      }
    );
    client.addTool(
      {
        name: 'get_weather',
        description:
          'Retrieves the weather for a given lat, lng coordinate pair. Specify a label for the location.',
        parameters: {
          type: 'object',
          properties: {
            lat: {
              type: 'number',
              description: 'Latitude',
            },
            lng: {
              type: 'number',
              description: 'Longitude',
            },
            location: {
              type: 'string',
              description: 'Name of the location',
            },
          },
          required: ['lat', 'lng', 'location'],
        },
      },
      async ({ lat, lng, location }) => {
        setMarker({ lat, lng, location });
        setCoords({ lat, lng, location });
        const result = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m`
        );
        const json = await result.json();
        const temperature = {
          value: json.current.temperature_2m,
          units: json.current_units.temperature_2m,
        };
        const wind_speed = {
          value: json.current.wind_speed_10m,
          units: json.current_units.wind_speed_10m,
        };
        setMarker({ lat, lng, location, temperature, wind_speed });
        return json;
      }
    );
    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          // if we receive multiple events in a row, aggregate them for display purposes
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });
    client.on('error', (event) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      setItems(items);
    });
    setItems(client.conversation.getItems());
    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, [instructions]);

  const copyClick = useCallback((value) => {
    if (typeof value === 'string') {
        copy(value);
    }
  });

  const handleCopy = useCallback((e) => {
    e.preventDefault();
    const selectedText = document.getSelection().toString();

    //Remove soft hyphens
    const textContent = selectedText.replace(/\xAD/g, '');

    navigator.clipboard.writeText(textContent);
  });

  return (
        <div className="min-w-[99%] self-start mt-2 mb-2 mb-1 inline p-2 bg-nosferatu-200 rounded-3xl bg-gradient-to-tl from-nosferatu-500 shadow-sm">
          {/* Chat ID number, Type of Model, X-Close button */}
          <table className="min-w-[99%] border-separate border-spacing-y-2 border-spacing-x-2">
            <tbody>
              <tr>
                <td colSpan="2" className="pb-4 tracking-wide text-4xl text-center font-bold text-black">
                    <span className="mr-6">#{numba}</span>
                    <i className="fa-regular fa-comments mr-6 text-black"></i>
                    OpenAI Realtime
                </td>
                <td>
                    <XClose onClose={onClose} closeID={closeID} />
                </td>
              </tr>
              <tr>
                <td onCopy={handleCopy} colSpan="3" className="py-3 p-3 bg-morbius-300 font-sans rounded-xl text-black-800 text-md whitespace-pre-wrap">
                    <div className="mb-3 grid grid-cols-3">
                        <span className="font-bold text-xl text-aro-900">Starting Prompt</span>
                        <span></span>
                        <span className="text-right cursor-copy">
                            <i onClick={() => copyClick(instructions)} className="text-aro-900 m-2 fa-solid fa-copy fa-2x cursor-copy shadow-xl hover:shadow-dracula-900"></i>
                        </span>
                    </div>
                    <div>
                        <Hyphenated>{instructions}</Hyphenated>
                    </div>
                </td>
              </tr>
              <tr>
                <td colSpan="3">
                  <div data-component="ConsolePage">
                    <div className="content-main">
                      <div className="content-logs">
                        <div className="content-block events">
                          <div className="visualization">
                            <div className="visualization-entry client">
                              <canvas ref={clientCanvasRef} />
                            </div>
                            <div className="visualization-entry server">
                              <canvas ref={serverCanvasRef} />
                            </div>
                          </div>
                        </div>
                        <div className="content-block conversation">
                          <div className="content-block-body" data-conversation-content>
                            {!items.length && 
                                <div className="py-3 whitespace-pre-wrap p-3 bg-nosferatu-100 font-mono rounded-xl text-vanHelsing-200 text-sm">
                                    <div><span className="font-bold text-xl text-aro-900">OpenAI Realtime</span></div>
                                    <div className="mt-6 text-black"><span>Awaiting Connection...</span></div>
                                </div>
                            }
                            {items.map((conversationItem) => {
                              return (
                                <div className={conversationItem.role === "user" ?
                                    "p-3 mt-3 bg-morbius-300 font-sans rounded-xl text-black text-md whitespace-pre-wrap" :
                                    "p-3 mt-3 whitespace-pre-wrap bg-nosferatu-100 font-mono rounded-xl text-black text-md"} key={conversationItem.id}>
                                  <div className="flex">
                                    <div className="flex-1"></div>
                                    <div
                                      className="close ml-auto mb-4 text-lg"
                                      onClick={() =>
                                        deleteConversationItem(conversationItem.id)
                                      }
                                    >
                                      <X />
                                    </div>
                                  </div>
                                  <div>
                                    {/* tool response */}
                                    {conversationItem.type === 'function_call_output' && (
                                      <div>{conversationItem.formatted.output}</div>
                                    )}
                                    {/* tool call */}
                                    {conversationItem.formatted.tool && (
                                      <div>
                                        {conversationItem.formatted.tool.name}(
                                        {conversationItem.formatted.tool.arguments})
                                      </div>
                                    )}
                                    {!conversationItem.formatted.tool &&
                                      conversationItem.role === 'user' && (
                                        <>
                                            <div className="flex">
                                                <div className="flex-1"><span className="font-bold text-xl text-aro-900">User</span></div>
{/*                                                 <div className="ml-auto">
                                                    <i onClick={() => copyClick(conversationItem.formatted.text)} className="text-aro-900 m-2 fa-solid fa-copy fa-2x cursor-pointer shadow-xl hover:shadow-dracula-900"></i>
                                                </div> */}
                                            </div>
                                            <div>
                                            {conversationItem.formatted.transcript ||
                                                (conversationItem.formatted.audio?.length
                                                ? '(awaiting transcript)'
                                                : conversationItem.formatted.text ||
                                                    '(item sent)')}
                                            </div>
                                        </>
                                      )}
                                    {!conversationItem.formatted.tool &&
                                      conversationItem.role === 'assistant' && (
                                        <>
                                            <div className="flex">
                                                <div className="flex-1"><span className="font-bold text-xl text-aro-900">OpenAI Realtime</span></div>
                                            </div>
                                            <div>
                                            {conversationItem.formatted.transcript ||
                                                conversationItem.formatted.text ||
                                                '(truncated)'}
                                            </div>
                                        </>
                                      )}
                                    {conversationItem.formatted.file && (
                                      <audio
                                        className="mt-6"
                                        src={conversationItem.formatted.file.url}
                                        controls
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        { checkedIn ? 
                            <div className="content-actions mt-6">
                            <Toggle
                                defaultValue={false}
                                labels={['push-to-talk', 'voice-activate']}
                                values={['none', 'server_vad']}
                                onChange={(_, value) => changeTurnEndType(value)}
                            />
                            <div className="spacer" />
                            {isConnected && canPushToTalk && (
                                <Button
                                label={isRecording ? 'release to send' : 'push to talk'}
                                buttonStyle={isRecording ? 'alert' : 'regular'}
                                disabled={!isConnected || !canPushToTalk}
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                                />
                            )}
                            <div className="spacer" />
                            <Button
                                label={isConnected ? 'Disconnect' : 'Connect'}
                                iconPosition={isConnected ? 'end' : 'start'}
                                icon={isConnected ? X : Zap}
                                buttonStyle={isConnected ? 'regular' : 'action'}
                                onClick={
                                isConnected ? disconnectConversation : connectConversation
                                }
                            />
                            </div> :
                            <></>
                        }
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
  );
}
