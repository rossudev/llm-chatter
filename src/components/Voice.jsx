import { useReactMediaRecorder } from "react-media-recorder";
import { useEffect, useState } from "react";

const Voice = ({setMedia, handleVoice, media, isClicked}) => {
    const [second, setSecond] = useState("00");
    const [minute, setMinute] = useState("00");
    const [isActive, setIsActive] = useState(false);
    const [counter, setCounter] = useState(0);

    useEffect(() => {
      let intervalId;
  
      if (isActive) {
        intervalId = setInterval(() => {
          const secondCounter = counter % 60;
          const minuteCounter = Math.floor(counter / 60);
  
          let computedSecond =
            String(secondCounter).length === 1
              ? `0${secondCounter}`
              : secondCounter;
          let computedMinute =
            String(minuteCounter).length === 1
              ? `0${minuteCounter}`
              : minuteCounter;
  
          setSecond(computedSecond);
          setMinute(computedMinute);
  
          setCounter((counter) => counter + 1);
        }, 1000);
      }
  
      return () => clearInterval(intervalId);
    }, [isActive, counter]);

    function stopTimer() {
      setIsActive(false);
      setMedia();
      setCounter(0);
      setSecond("00");
      setMinute("00");
    }
    const {
      status,
      startRecording,
      stopRecording,
      pauseRecording,
    } = useReactMediaRecorder({
      video: false,
      audio: true,
      echoCancellation: true,
      onStop: async (blobUrl) => {        
        setMedia(blobUrl);
      }
    });

    return (
      <div
        className="min-w-full mb-1 pt-3 pl-3 bg-morbius-300 rounded-3xl bg-gradient-to-tl from-morbius-500"
      >
        <div
          className="col-md-6 col-md-offset-3 text-white pl-6 pt-6 pb-10"
        >

          <span
            className="text-cullen-500"
            style={{
              fontFamily: "sans-serif",
              fontSize: "18px",
              transition: "all 300ms ease-in-out"
            }}
          >
            {isClicked ? 
                <span className="font-extrabold bg-cullen-100 p-6 text-nosferatu-800 rounded-2xl">
                  <i className="fa-solid fa-hat-wizard mr-4 text-3xl"></i>
                  Processing
                </span>
                : 
                <span
                    className={isActive ?
                      "font-extrabold bg-cullen-100 text-marcelin-800 p-4 rounded-2xl" :
                      "font-extrabold bg-cullen-100 text-black p-4 rounded-2xl"}
                >
                  <i className="fa-solid fa-signal mr-4"></i>
                  {status}
                  {isActive ? <span>...</span> : <></>}
                </span>}
          </span>

          { !isClicked &&
            <div className="text-4xl mt-10 mb-8 text-black">
                <span className="minute">{minute}</span>
                <span>:</span>
                <span className="second">{second}</span>
            </div>
          }
  
          <div className="flex items-center">
            <label
              style={{
                fontSize: "15px",
                fontWeight: "Normal"
                // marginTop: "20px"
              }}
              htmlFor="icon-button-file"
            >
              <div>
                { !isClicked &&
                    <button
                    className="bg-blade-300 text-black hover:bg-blade-700 mt-2"
                    style={{
                        padding: "0.8rem 2rem",
                        border: "none",
                        fontSize: "1rem",
                        cursor: "pointer",
                        borderRadius: "5px",
                        fontWeight: "bold",
                        transition: "all 300ms ease-in-out",
                        transform: "translateY(0)"
                    }}
                    onClick={() => {
                        if (!isActive) {
                        startRecording();
                        } else {
                        stopRecording();                        
                        pauseRecording();
                        }
    
                        setIsActive(!isActive);
                    }}
                    >
                      <i className="fa-solid fa-hand-sparkles mr-2"></i>
                      {isActive ? "End Recording" : <>{media ? "Resume Recording" : "Start Recording"}</>}
                    </button>
                }

                { (!isClicked && media && !isActive ) &&
                    <button
                        className="bg-dracula-100 text-nosferatu-800 hover:bg-dracula-300 ml-6 mt-2"
                        style={{
                        borderRadius: "8px",
                        fontWeight: "bold",
                        padding: "1em"
                        }}
                        onClick={stopTimer}
                    >
                        <i className="fa-solid fa-rotate-right mr-2"></i>
                        Reset
                    </button>
                }

                { ( media && !isClicked && !isActive ) &&
                    <button
                    className="bg-aro-300 text-black hover:bg-aro-600 ml-6 mt-2 mr-4"
                    style={{
                        padding: "0.8rem 2rem",
                        border: "none",
                        fontSize: "1rem",
                        cursor: "pointer",
                        borderRadius: "5px",
                        fontWeight: "bold",
                        transition: "all 300ms ease-in-out",
                        transform: "translateY(0)"
                    }}
                    onClick={() => {
                        handleVoice();
                        stopTimer();
                    }}
                    >
                      <i className="fa-solid fa-arrow-right mr-2"></i>
                      Send Audio Prompt
                    </button>
                }
              </div>
            </label>
          </div>
        </div>
      </div>
    );
  };

export default Voice;