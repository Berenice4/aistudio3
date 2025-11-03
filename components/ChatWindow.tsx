
import React, { useEffect, useRef } from 'react';
import type { Message } from '../types';
import ChatMessage from './ChatMessage';

interface ChatWindowProps {
    messages: Message[];
    isLoading: boolean;
    searchQuery: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading, searchQuery }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };



    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const lastMessageIsModel = messages.length > 0 && messages[messages.length - 1].role === 'model';

    return (
        <div className="p-4 space-y-4">
            {messages.map((msg, index) => (
                <ChatMessage 
                    key={index} 
                    message={msg} 
                    searchQuery={searchQuery}
                    isStreaming={isLoading && lastMessageIsModel && index === messages.length - 1}
                />
            ))}
            <div ref={messagesEndRef} />
        </div>
    );
};

export default ChatWindow;
