
import React, { useState } from 'react';
import SendIcon from './icons/SendIcon';
import StopIcon from './icons/StopIcon';

interface ChatInputProps {
    onSendMessage: (message: string) => void;
    isLoading: boolean;
    onStopGeneration: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, onStopGeneration }) => {
    const [inputValue, setInputValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            onSendMessage(inputValue);
            setInputValue('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Scrivi la tua domanda..."
                className="flex-1 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
                disabled={isLoading}
            />
            {isLoading ? (
                 <button
                    type="button"
                    onClick={onStopGeneration}
                    className="p-3 bg-red-600 rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    title="Stop Generation"
                    aria-label="Stop generation"
                >
                    <StopIcon />
                </button>
            ) : (
                <button
                    type="submit"
                    disabled={isLoading || !inputValue.trim()}
                    className="p-3 bg-blue-600 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Send message"
                >
                    <SendIcon />
                </button>
            )}
        </form>
    );
};

export default ChatInput;
