/* eslint-disable react/prop-types */
import { React, useState } from "react";
import Hyphenated from "react-hyphen";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";

const ContentText = ({ txt, role }) => {
    const [isExpanded, setIsExpanded] = useState(role !== "user");

    const handleToggle = () => {
        setIsExpanded(!isExpanded);
    };

    const CodeBlock = ({ inline, className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
            <pre className={`border p-4 rounded bg-nosferatu-200 text-black text-xs language-${match[1]} ${className} overflow-auto`}>
                <code {...props} className={`${className} whitespace-pre-wrap break-all`}>
                    {children}
                </code>
            </pre>
        ) : (
            <code className={`${className} bg-nosferatu-200 text-black rounded p-1 whitespace-pre-wrap break-all`} {...props}>
                {children}
            </code>
        );
    };

    const lines = txt ? txt.split('\n') : [];
    const displayedLines = isExpanded ? lines : lines.slice(0, 5);
    const contentToDisplay = displayedLines.join('\n');

    return (
        <div>
            <Hyphenated>
                {role === "user" ? (
                    contentToDisplay
                ) : (
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{ code: CodeBlock }}
                        className="markdown text-aro-900"
                    >
                        {contentToDisplay}
                    </ReactMarkdown>
                )}
            </Hyphenated>
            {lines.length > 5 && (
                <div className="text-center cursor-pointer mt-2" onClick={handleToggle}>
                    <i 
                        className={ isExpanded ? "fa-solid fa-ellipsis text-3xl text-dracula-900 hover:text-dracula-500" : "fa-solid fa-ellipsis text-3xl text-blade-100 hover:text-blade-500"}
                        title={isExpanded ? "Show less" : "Show more"}
                    />
                </div>
            )}
        </div>
    );
};

export default ContentText;
