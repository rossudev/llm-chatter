import { useState, useCallback } from "react";

function CopyButton({ contentText, copyClick }) {
  const [isCopied, setIsCopied] = useState(false);

  const delayColor = useCallback(() => {
    //For a period of 200 ms, setIsCopied to true
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 150);
  });

  return (
    <i
      onClick={() => {
        copyClick(contentText);
        delayColor();
      }}
      className={`text-aro-900 m-2 fa-solid fa-copy fa-2x cursor-pointer ${
        isCopied ? "text-blade-300" : ""
      }`}
    ></i>
  );
}

export default CopyButton;
