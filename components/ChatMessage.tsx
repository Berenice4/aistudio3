
import React, { useMemo } from 'react';
import type { Message } from '../types';
import BotIcon from './icons/BotIcon';
import UserIcon from './icons/UserIcon';
import SourceIcon from './icons/SourceIcon';

interface ChatMessageProps {
    message: Message;
    searchQuery: string;
    isStreaming?: boolean;
}

const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, searchQuery, isStreaming }) => {
    const isModel = message.role === 'model';

    const containerClasses = isModel
        ? 'flex justify-start items-start space-x-3'
        : 'flex justify-end items-start space-x-3';
    
    const bubbleClasses = isModel
        ? 'bg-gray-700 rounded-r-lg rounded-bl-lg'
        : 'bg-blue-600 text-white rounded-l-lg rounded-br-lg';

    const highlightedText = useMemo(() => {
        const query = searchQuery.trim();
        if (!query) {
             return message.text.split('\n').map((line, index, arr) => (
                <React.Fragment key={index}>
                    {line}
                    {index < arr.length - 1 && <br />}
                </React.Fragment>
            ));
        }

        const escapedQuery = escapeRegExp(query);
        const parts = message.text.split(new RegExp(`(${escapedQuery})`, 'gi'));

        return parts.map((part, index) => {
            const partWithBreaks = part.split('\n').map((line, i, arr) => (
                <React.Fragment key={i}>
                    {line}
                    {i < arr.length - 1 && <br />}
                </React.Fragment>
            ));

            if (part.toLowerCase() === query.toLowerCase()) {
                return <mark key={index} className="bg-yellow-400 text-black rounded px-1 py-0.5">{partWithBreaks}</mark>;
            }
            return partWithBreaks;
        });
    }, [message.text, searchQuery]);

    return (
        <div className={containerClasses}>
            {isModel && (
                <div className="w-8 h-8 flex-shrink-0 bg-gray-800 rounded-full flex items-center justify-center self-start">
                   <BotIcon />
                </div>
            )}
            <div className="flex flex-col">
                <div className={`p-3 max-w-lg ${bubbleClasses}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {highlightedText}
                        {isStreaming && <span className="inline-block w-2 h-4 bg-white animate-pulse ml-1 align-bottom" />}
                    </p>
                </div>
                {isModel && message.sources && message.sources.length > 0 && (
                    <div className="mt-3 text-xs text-gray-400 max-w-lg">
                        <h4 className="font-semibold mb-2 text-gray-300">Sources:</h4>
                        <ul className="space-y-2">
                            {message.sources.map((source, index) => (
                                <li key={index} className="flex items-start p-2 bg-gray-800/50 rounded-md">
                                    <SourceIcon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-gray-500" />
                                    <a
                                        href={source.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline hover:text-blue-400 transition-colors break-all"
                                        title={source.uri}
                                    >
                                        {source.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
             {!isModel && (
                <div className="w-8 h-8 flex-shrink-0 bg-gray-600 rounded-full flex items-center justify-center self-start">
                   <UserIcon />
                </div>
            )}
        </div>
    );
};

export default ChatMessage;
