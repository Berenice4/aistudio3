



import React, { useState, useEffect, useRef } from 'react';
import SendIcon from './icons/SendIcon';
import StopIcon from './icons/StopIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';

// FIX: Add minimal type definitions for the non-standard Web Speech API to resolve TypeScript errors.
interface SpeechRecognitionAlternative {
    readonly transcript: string;
}

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
}

interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: () => void;
    onend: () => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    start: () => void;
    stop: () => void;
}

declare global {
    interface Window {
        SpeechRecognition?: { new(): SpeechRecognition };
        webkitSpeechRecognition?: { new(): SpeechRecognition };
    }
}

interface ChatInputProps {
    onSendMessage: (message: string) => void;
    isLoading: boolean;
    onStopGeneration: () => void;
    disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, onStopGeneration, disabled = false }) => {
    const [inputValue, setInputValue] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const textBeforeListenRef = useRef('');
    const [speechApiSupported, setSpeechApiSupported] = useState(true);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported in this browser.");
            setSpeechApiSupported(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'it-IT';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (e) => {
            console.error('Speech Recognition Error', e);
            setIsListening(false);
        };
        
        recognition.onresult = (event) => {
            let final_transcript = '';
            let interim_transcript = '';
            
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                } else {
                    interim_transcript += event.results[i][0].transcript;
                }
            }
            
            setInputValue(textBeforeListenRef.current + final_transcript + interim_transcript);
        };
        
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const handleToggleListening = () => {
        if (!recognitionRef.current) return;
        
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            textBeforeListenRef.current = inputValue ? inputValue + ' ' : '';
            recognitionRef.current.start();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isListening) {
            recognitionRef.current?.stop();
        }
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
                placeholder="Scrivi la tua domanda o usa il microfono..."
                className="flex-1 p-3 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading || disabled}
            />
             {speechApiSupported && (
                <button
                    type="button"
                    onClick={handleToggleListening}
                    className={`p-3 rounded-lg transition-colors focus:outline-none focus:ring-2 ${isListening ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 animate-pulse' : 'bg-gray-600 hover:bg-gray-500 focus:ring-blue-500'} disabled:cursor-not-allowed disabled:opacity-50`}
                    title={isListening ? "Ferma la dettatura" : "Avvia la dettatura"}
                    aria-label={isListening ? "Ferma la dettatura" : "Avvia la dettatura"}
                    disabled={isLoading || disabled}
                >
                    <MicrophoneIcon isListening={isListening} />
                </button>
            )}
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
                    disabled={isLoading || !inputValue.trim() || disabled}
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