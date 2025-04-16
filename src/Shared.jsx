import { useState, useCallback } from "react";
import { useParams } from 'react-router-dom';
import axios from "axios";
import debounce from "lodash/debounce";
import Config from "./Config.jsx";
import ContentText from "./components/ContentText";
import copy from "copy-to-clipboard";

function Shared() {
  const { uniqueId, userName } = useParams();
  const { serverURL } = Config;
  const [shareChat, setShareChat] = useState({});

  const sharedCheckIn = useCallback(debounce(async () => {
    if (!serverURL || !userName || !uniqueId) {
      console.error("Missing required parameters");
      return;
    }

    try {
      const checkinResp = await axios.post(
        serverURL + "/applyshare",
        { shareUser: userName, shareChat: uniqueId },
        {
          headers: { "Content-Type": "application/json" }
        },
      );

      const clientCheck = checkinResp?.data || undefined;

      if (clientCheck) {
        const data = checkinResp.data;

        setShareChat(data.shareChatHistory);
      }
    } catch (error) {
      console.log(error);
      setShareChat({error: error });
    }
  }, 250), [serverURL, userName, uniqueId]);

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

  return (
    <>
      {shareChat.map((obj, index) => {
        const contentText = obj.content;
        return (
            <tr key={index}>
                <td onCopy={handleCopy} colSpan="4" className={obj.role === "user" || obj.role === "system" ?
                    "py-3 p-3 bg-morbius-300 font-sans rounded-xl text-black-800 text-md whitespace-pre-wrap" :
                    "py-3 whitespace-pre-wrap p-3 bg-nosferatu-100 font-mono rounded-xl text-black text-sm"}>

                    <div className="mb-3 grid grid-cols-3">
                        <span className="font-bold text-xl text-aro-900">{obj.role}</span>
                        <span className="text-center text-sm text-aro-900">{obj.time}</span>
                        <span className="text-right">
                            <i onClick={() => copyClick(contentText)} className="text-aro-900 m-2 fa-solid fa-copy fa-2x cursor-pointer shadow-xl hover:shadow-dracula-900"></i>
                        </span>
                    </div>

                    <ContentText role={obj.role} txt={contentText} />
                </td>
            </tr>
        )
      })}
    </>
  );
}

export default Shared;