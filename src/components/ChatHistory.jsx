/* Shorthand (file storage) for the following:
i = item_x
u = chatId
m = model
t = temp
p = topp
k = topk
r = role
d = time
z = message */

import { useState } from "react";
import { HistoryItem } from "./HistoryItem";

const ChatHistory = ({chatHistory, chatCount, localModels, serverURL, modelOptions, setComponentList, setChatCount, componentList, syncClient}) => {
    const [expanded, setExpanded] = useState(false);
    const [showAtAll, setShowAtAll] = useState(false);


    const handleToggleHistory = () => {
        setExpanded(!expanded);
    };

    const handleShowAtAll = () => {
        setShowAtAll(!showAtAll);
    };

    // Function 1: Get all unique chat IDs
    function getUniqueChatIds(database) {
        const uniqueChatIds = new Set();
        
        // Use Object.values to get all items directly
        Object.entries(database).forEach(([key, item]) => {
            if (key.startsWith("i_")) {
            uniqueChatIds.add(item.u);
            }
        });
        
        return Array.from(uniqueChatIds).sort((a, b) => {
            const firstChatA = Object.values(database).find(item => item.u === a);
            const firstChatB = Object.values(database).find(item => item.u === b);
            
            const dateA = parseDate(firstChatA.d);
            const dateB = parseDate(firstChatB.d);
            
            return dateB - dateA; // Change to descending order
        });
    };

    // Get all chats for a specific chatId, or in the thread, sorted by time
    function getChatsByChatId(database, chatId, thread) {
        // Use Set for efficient duplicate handling and lookups
        let allRelevantIds = new Set([chatId, ...(thread || [])]); // Start with initial IDs
        let addedNew = true;
        let lastSeenUId = null; // To associate t_ arrays with the preceding i_ item's u ID
        // Loop until no new relevant conversation IDs are found in a full pass
        while (addedNew) {
            addedNew = false;
            lastSeenUId = null; // Reset for each pass
            // Iterate through database entries, maintaining key order assumption
            for (const [key, item] of Object.entries(database)) {
                if (key.startsWith("i_") && item && typeof item === 'object' && item.u) {
                    // Found a message item, record its conversation U-ID
                    lastSeenUId = item.u;
                } else if (key.startsWith("t_") && Array.isArray(item) && lastSeenUId) {
                    const currentMessageGroupUId = lastSeenUId;
                    // Scenario 1: This thread array links TO a known relevant ID.
                    if (item.some(idInThread => allRelevantIds.has(idInThread))) {
                        if (!allRelevantIds.has(currentMessageGroupUId)) {
                            allRelevantIds.add(currentMessageGroupUId);
                            addedNew = true; // Found a new relevant ID, need another pass
                        }
                    }
                    // Scenario 2: This message group (currentMessageGroupUId) IS known to be relevant.
                    if (allRelevantIds.has(currentMessageGroupUId)) {
                        item.forEach(idInThread => {
                            if (!allRelevantIds.has(idInThread)) {
                                allRelevantIds.add(idInThread);
                                addedNew = true; // Found a new relevant ID, need another pass
                            }
                        });
                    }
                }
            }
        } // End while loop
        // Now allRelevantIds contains all U-IDs for the entire conversation thread
        // Filter items by all relevant U-IDs
        const filteredChats = Object.entries(database)
            .filter(([key, item]) =>
                key.startsWith("i_") &&          // Is a message item
                item && typeof item === 'object' && // Is a valid object
                item.u &&                        // Has a U-ID property
                allRelevantIds.has(item.u)       // The U-ID is in our relevant set
            )
            .map(([key, item]) => item);       // Extract the message object
        // Sort by time
        return filteredChats.sort((a, b) => {
            const dateA = parseDate(a.d);
            const dateB = parseDate(b.d);

            if (isNaN(dateA) && isNaN(dateB)) return 0;
            if (isNaN(dateA)) return 1; // Put invalid dates last
            if (isNaN(dateB)) return -1; // Put invalid dates last
            return dateA - dateB;
        });
    };

    function getContextByChatId(database, chatId) {
        const contextItems = Object.entries(database)
            .filter(([key, item]) => key.startsWith("c_") && item.u === chatId)
            .map(([key, item]) => item);

        return contextItems.length > 0 ? contextItems[0] : [];
    }

    function getThreadByChatId(database, chatId) {
        const contextItems = Object.entries(database)
            .filter(([key, item]) => key.startsWith("t_") && item.u === chatId)
            .map(([key, item]) => item);

        return contextItems.length > 0 ? contextItems[0] : [];
    }

    // Helper function to parse date strings
    function parseDate(dateString) {
        // Split the date string into components
        const [datePart, timePart] = dateString.split(' ');
        const [day, month, year] = datePart.split('/');
        const [hours, minutes, seconds] = timePart.split(':');
        
        // Create a Date object (note: month is 0-indexed in JavaScript Date)
        return new Date(year, month - 1, day, hours, minutes, seconds);
    };

    const uniqueChatIds = getUniqueChatIds(chatHistory);
    const countEm = uniqueChatIds.length;

    return (
        <>
        { (countEm > 0) ? 
            <div className="self-start place-self-center text-center items-center justify-center mb-4 pl-2 pr-2 rounded-lg border-solid border-2 border-aro-800 bg-aro-300 bg-gradient-to-tl from-nosferatu-600 min-w-[100%]">
                <table className="min-w-[100%] border-separate border-spacing-y-2 border-spacing-x-2">
                    <tbody>
                        <tr>
                            <td className="p-2 tracking-wide text-2xl text-center font-bold text-black">
                                <div className="hover:cursor-context-menu" onClick={() => handleShowAtAll()}>
                                    <i className="fa-solid fa-book-bookmark mr-6 text-nosferatu-800 hover:text-dracula-900" />
                                    <span className={showAtAll ? "underline hover:no-underline" : "hover:underline"}>Chat History</span>
                                </div>
                            </td>
                            { showAtAll &&
                                <td>
                                    <div className="mb-6 flex font-bold text-3xl items-end justify-end">
                                        <i className="fa-solid fa-rotate text-ero-800 cursor-pointer hover:text-dracula-300 pt-2" onClick={() => syncClient()}></i>
                                    </div>
                                </td>
                            }
                        </tr>
                    </tbody>
                </table>
                { showAtAll &&
                    <table className="min-w-[100%] border-separate border-spacing-y-2 border-spacing-x-2">
                        <tbody>
                            <tr>
                                <td colSpan="2" className="text-black">
                                    {(expanded ? uniqueChatIds : uniqueChatIds.slice(0, 5)).map(chatId => {                                            const thread = getThreadByChatId(chatHistory, chatId);
                                        const chats = getChatsByChatId(chatHistory, chatId, thread);
                                        const context = getContextByChatId(chatHistory, chatId);


                                        return (
                                            <HistoryItem key={chatId} chats={chats} uID={uniqueChatIds.length - uniqueChatIds.indexOf(chatId)} componentList={componentList} chatCount={chatCount} localModels={localModels} serverURL={serverURL} modelOptions={modelOptions} setComponentList={setComponentList} setChatCount={setChatCount} context={context} thread={thread} />
                                        );
                                    })}
                                </td>
                            </tr>
                            { uniqueChatIds.length > 5 && 
                                <tr>
                                    <td colSpan="2">
                                        <div className="tracking-wide text-center cursor-pointer mt-1" onClick={handleToggleHistory}>
                                            <i 
                                                className={ expanded ? "fa-regular fa-square-caret-up text-5xl text-blade-800 hover:text-dracula-500" : "fa-regular fa-square-caret-down text-5xl text-nosferatu-800 hover:text-buffy-500"}
                                                title={expanded ? "Show less" : "Show more"}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            }
                        </tbody>
                    </table>
                }
            </div> :
            <></>
        }
        </>
    )
};

export default ChatHistory;