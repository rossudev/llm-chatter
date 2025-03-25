import { useState, useCallback, useContext } from "react";
import axios from "axios";
import { animated, Spring } from "react-spring";

const ChatHistory = ({chatHistory}) => {
    return (
        <div className="self-start place-self-center text-center items-center justify-center mt-6 mb-2 pl-2 pr-2 rounded-3xl bg-gradient-to-tl bg-dracula-300 from-dracula-100 shadow-sm">
            <table className="min-w-[100%] border-separate border-spacing-y-2 border-spacing-x-2">
                <tbody>
                    <tr>
                        <td colSpan="4" className="p-2 tracking-wide text-2xl text-center font-bold text-black">
                            <i className="fa-solid fa-book-bookmark mr-6 text-nosferatu-800" />
                            Chat History
                        </td>
                    </tr>
                    <tr><td colSpan="5">{JSON.stringify(chatHistory)}</td></tr>
                </tbody>
            </table>
        </div>
    )
};

export default ChatHistory;