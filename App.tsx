
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Message, Settings } from './types';
import { runChatStream, DEFAULT_SYSTEM_INSTRUCTION } from './services/geminiService';
import { extractTextFromPDF } from './utils/pdfParser';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import BotIcon from './components/icons/BotIcon';
import ExportIcon from './components/icons/ExportIcon';
import TrashIcon from './components/icons/TrashIcon';
import TokenIcon from './components/icons/TokenIcon';
import SettingsPanel from './components/SettingsPanel';
import SearchIcon from './components/icons/SearchIcon';
import EmbedIcon from './components/icons/EmbedIcon';
import EmbedCodeDialog from './components/EmbedCodeDialog';

const API_KEY_INSTRUCTIONS = `Errore di Configurazione: Chiave API Mancante

L'assistente AI non può funzionare senza una chiave API valida.

Se sei l'amministratore di questo sito, segui questi passaggi:
1. Vai al pannello di controllo del tuo servizio di hosting (es. Netlify).
2. Trova le impostazioni per le "Environment Variables" (Variabili d'ambiente).
3. Crea una nuova variabile chiamata \`API_KEY\`.
4. Incolla la tua chiave API di Google Gemini come valore.
5. Salva e riesegui il deploy del sito.

La chat è disabilitata finché la configurazione non è completata.`;

// --- Constants for Token Estimation ---
const TOTAL_TOKEN_LIMIT = 990000;
const CHARS_PER_TOKEN = 4; // A common approximation for token calculation

// --- Start of ConfirmationDialog Component ---
interface ConfirmationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmButtonText = 'Confirm',
    cancelButtonText = 'Cancel'
}) => {
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50"
            aria-modal="true"
            role="dialog"
            onClick={onClose}
        >
            <div
                className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl border border-gray-700 transform transition-all scale-95 opacity-0 animate-fade-in-scale"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
                <p className="text-gray-300 mb-6 whitespace-pre-wrap">{message}</p>
                <div className="flex justify-end space-x-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-400"
                    >
                        {cancelButtonText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500"
                    >
                        {confirmButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
};
// --- End of ConfirmationDialog Component ---


const INITIAL_MESSAGE: Message = {
    role: 'model',
    text: "Buongiorno! Sono il tuo assistente di conoscenza. Fai pure le tue domande e risponderò basandomi esclusivamente sulle informazioni a mia disposizione."
};

const App: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [totalTokensUsed, setTotalTokensUsed] = useState<number>(0);
    const [knowledgeFiles, setKnowledgeFiles] = useState<File[]>([]);
    const [knowledgeBase, setKnowledgeBase] = useState<string>(() => {
         try {
            return localStorage.getItem('chatchok-knowledge-base') || '';
        } catch (e) {
            console.error("Failed to read knowledge base from localStorage", e);
            return '';
        }
    });
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState<boolean>(false);
    const [isEmbedded, setIsEmbedded] = useState<boolean>(false);
    const stopStreamingRef = useRef(false);
    const [isApiKeyMissing, setIsApiKeyMissing] = useState<boolean>(false);

    useEffect(() => {
        // Check for API key on initial load.
        if (!process.env.API_KEY) {
            setIsApiKeyMissing(true);
            setError(API_KEY_INSTRUCTIONS);
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('embed') === 'true') {
            setIsEmbedded(true);
        }
    }, []);

    const [settings, setSettings] = useState<Settings>(() => {
        try {
            const savedSettings = localStorage.getItem('chatSettings');
            if (savedSettings) {
                return JSON.parse(savedSettings);
            }
        } catch (e) {
            console.error("Failed to parse settings from localStorage", e);
        }
        return {
            model: 'gemini-2.5-flash',
            temperature: 0.5,
            systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        };
    });

    const updateKnowledgeBase = useCallback(async (files: File[]) => {
        if (files.length === 0) {
            setKnowledgeBase('');
             try {
                localStorage.removeItem('chatchok-knowledge-base');
            } catch (e) {
                console.error("Failed to remove knowledge base from localStorage", e);
            }
            return;
        }
        setIsParsing(true);
        setError(null);
        try {
            const texts = await Promise.all(files.map(extractTextFromPDF));
            const newKnowledgeBase = texts.join('\n\n---\n\n');
            setKnowledgeBase(newKnowledgeBase);
            try {
                localStorage.setItem('chatchok-knowledge-base', newKnowledgeBase);
            } catch (e) {
                console.error("Failed to save knowledge base to localStorage", e);
                setError("Could not save the knowledge base for the embedded view. It will work only in this window.");
            }
        } catch (error) {
            console.error("Error parsing PDFs:", error);
            let message = "Failed to process one or more PDF files. They may be corrupted or protected.";
            // FIX: Property 'name' does not exist on type 'unknown'.
            // Safely check the error type by first verifying it is an object with a 'name' property.
            if (typeof error === 'object' && error !== null && 'name' in error) {
                if ((error as { name: unknown }).name === 'PasswordException') {
                    message = 'One of the PDF files is password protected and cannot be read.';
                }
            }
            setError(message);
        } finally {
            setIsParsing(false);
        }
    }, []);

    useEffect(() => {
        updateKnowledgeBase(knowledgeFiles);
    }, [knowledgeFiles, updateKnowledgeBase]);
    
    useEffect(() => {
        localStorage.setItem('chatSettings', JSON.stringify(settings));
    }, [settings]);

    const handleSettingsChange = useCallback((newSettings: Partial<Settings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const handleSendMessage = useCallback(async (newMessage: string) => {
        if (!newMessage.trim()) return;

        const userMessage: Message = { role: 'user', text: newMessage };

        if (!knowledgeBase.trim()) {
            setMessages(prev => [
                ...prev,
                userMessage,
                { role: 'model', text: "E' necessario fornire i pdf per la base di conoscenza" }
            ]);
            return;
        }

        setMessages(prevMessages => [...prevMessages, userMessage, { role: 'model', text: '' }]);
        setIsLoading(true);
        setError(null);
        stopStreamingRef.current = false;

        try {
            const streamResult = await runChatStream(newMessage, settings, knowledgeBase);
            
            let fullText = '';
            let lastChunk;
            for await (const chunk of streamResult) {
                if (stopStreamingRef.current) {
                    break;
                }
                lastChunk = chunk;
                const chunkText = chunk.text;
                fullText += chunkText;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].text = fullText;
                    return newMessages;
                });
            }
            
            if (!stopStreamingRef.current && lastChunk) {
                const tokenCount = lastChunk.usageMetadata?.totalTokenCount ?? 0;
                setTotalTokensUsed(prev => prev + tokenCount);
            }

        } catch (err) {
            const originalErrorMessage = err instanceof Error ? err.message : "An error occurred. Please try again.";
            let displayErrorMessage: string;

            if (originalErrorMessage.includes("API key is not configured")) {
                displayErrorMessage = API_KEY_INSTRUCTIONS;
            } else {
                 displayErrorMessage = `Si è verificato un errore inatteso. Riprova.`;
            }
            
            setError(displayErrorMessage);
            setMessages(prev => {
                const newMessages = [...prev];
                if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model') {
                    newMessages[newMessages.length - 1].text = displayErrorMessage;
                }
                return newMessages;
            });
            console.error(err);
        } finally {
            setIsLoading(false);
            stopStreamingRef.current = false;
        }
    }, [settings, knowledgeBase]);
    
    const handleStopGeneration = () => {
        stopStreamingRef.current = true;
    };

    const exportChatHistory = () => {
        const formattedHistory = messages.map(msg => {
            const prefix = msg.role === 'user' ? '[User]' : '[Assistant]';
            let content = `${prefix}: ${msg.text}`;
            return content;
        }).join('\n\n--------------------------------------------------\n\n');

        const blob = new Blob([formattedHistory], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        link.download = `chat-history-${timestamp}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    
    const handleClearChatRequest = () => {
        setIsConfirmDialogOpen(true);
    };

    const performClearChat = () => {
        setMessages([INITIAL_MESSAGE]);
        setTotalTokensUsed(0);
        setError(null);
        setIsConfirmDialogOpen(false);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const newFiles = Array.from(event.target.files);
            setKnowledgeFiles(prevFiles => {
                const existingFileNames = new Set(prevFiles.map(f => f.name));
                const uniqueNewFiles = newFiles.filter(f => !existingFileNames.has(f.name));
                return [...prevFiles, ...uniqueNewFiles];
            });
            event.target.value = '';
        }
    };

    const handleRemoveFile = (fileName: string) => {
        setKnowledgeFiles(prevFiles => prevFiles.filter(f => f.name !== fileName));
    };

    const userMessagesCount = messages.filter(msg => msg.role === 'user').length;

    if (isEmbedded) {
        return (
            <div className="flex flex-col h-screen bg-gray-900 text-white font-sans">
                <div className="flex flex-col flex-1 w-full h-full">
                    <main className="flex-1 overflow-y-auto">
                        <ChatWindow messages={messages} isLoading={isLoading} searchQuery={searchQuery} />
                    </main>
                    <footer className="p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700">
                        {error && <p className="text-red-500 text-center text-sm mb-2 whitespace-pre-wrap">{error}</p>}
                        <ChatInput 
                            onSendMessage={handleSendMessage} 
                            isLoading={isLoading} 
                            onStopGeneration={handleStopGeneration}
                            disabled={isApiKeyMissing}
                        />
                    </footer>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-800 text-white font-sans">
            <div className="flex w-full h-full">
                <SettingsPanel 
                    settings={settings} 
                    onSettingsChange={handleSettingsChange}
                    files={knowledgeFiles}
                    onFileChange={handleFileChange}
                    onRemoveFile={handleRemoveFile}
                    isParsing={isParsing}
                    knowledgeBaseTokens={Math.round(knowledgeBase.length / CHARS_PER_TOKEN)}
                    sessionTokensUsed={totalTokensUsed}
                    totalTokenLimit={TOTAL_TOKEN_LIMIT}
                    userMessagesCount={userMessagesCount}
                />
                <div className="flex flex-col flex-1 bg-gray-900">
                    <header className="flex items-center justify-between p-4 border-b border-gray-700 shadow-md gap-4">
                        <div className="flex items-center flex-shrink-0">
                            <div className="w-8 h-8 mr-3">
                                <BotIcon />
                            </div>
                            <h1 className="text-xl font-semibold">ChatChok - AI agent for customer experiences</h1>
                        </div>
                        <div className="flex items-center space-x-2 flex-grow justify-end">
                            <div className="relative flex-grow max-w-xs">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Cerca nella cronologia..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-gray-800/50 rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-transparent focus:border-blue-500"
                                />
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-gray-400 p-2 rounded-md bg-gray-800/50" title="Total tokens consumed in this session">
                                <TokenIcon />
                                <span>{totalTokensUsed.toLocaleString()}</span>
                            </div>
                            <button
                                onClick={handleClearChatRequest}
                                className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Clear chat history"
                                title="Clear chat history"
                            >
                                <TrashIcon />
                            </button>
                            <button
                                onClick={exportChatHistory}
                                className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Export chat history"
                                title="Export chat history"
                            >
                                <ExportIcon />
                            </button>
                             <button
                                onClick={() => setIsEmbedDialogOpen(true)}
                                className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Embed chat"
                                title="Embed chat"
                            >
                                <EmbedIcon />
                            </button>
                        </div>
                    </header>
                    <main className="flex-1 overflow-y-auto">
                        <ChatWindow messages={messages} isLoading={isLoading} searchQuery={searchQuery} />
                    </main>
                    <footer className="p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700">
                        {error && <p className="text-red-500 text-center text-sm mb-2 whitespace-pre-wrap">{error}</p>}
                        <ChatInput
                            onSendMessage={handleSendMessage}
                            isLoading={isLoading}
                            onStopGeneration={handleStopGeneration}
                            disabled={isApiKeyMissing}
                        />
                        <p className="text-center text-xs text-gray-500 mt-3">
                            <a href="https://www.theround.it" target="_blank" rel="noopener noreferrer" className="hover:underline">©2025 THE ROUND</a>
                        </p>
                    </footer>
                </div>
            </div>

             <ConfirmationDialog
                isOpen={isConfirmDialogOpen}
                onClose={() => setIsConfirmDialogOpen(false)}
                onConfirm={performClearChat}
                title="Conferma Cancellazione Chat"
                message={"Sei sicuro di voler cancellare l'intera cronologia della chat?\nQuesta azione è irreversibile."}
                cancelButtonText="Annulla"
                confirmButtonText="Cancella"
            />
            <EmbedCodeDialog
                isOpen={isEmbedDialogOpen}
                onClose={() => setIsEmbedDialogOpen(false)}
            />
        </div>
    );
};

export default App;