
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
import FocusViewIcon from './components/icons/FocusViewIcon';
import SettingsIcon from './components/icons/SettingsIcon';


// --- Constants for Token Estimation ---
const TOTAL_TOKEN_LIMIT = 990000;
const CHARS_PER_TOKEN = 4; // A common approximation for token calculation

// The original URL for the PDF.
const REMOTE_PDF_URL = 'https://www.theround.it/ai/chatchok/doc.pdf';

// A CORS proxy is used to bypass browser restrictions (CORS policy) that prevent
// direct fetching of the PDF from a different domain. This proxy fetches the file
// on the server-side and forwards it to the client with the correct headers.
const PROXIED_REMOTE_PDF_URL = `https://cors.sh/${REMOTE_PDF_URL}`;


// --- Start of Text Utilities ---
/**
 * Splits a long text into smaller chunks based on paragraphs, respecting a maximum chunk size.
 * @param text The full text to chunk.
 * @param maxChunkSizeInChars The approximate maximum size of each chunk in characters.
 * @returns An array of text chunks.
 */
const chunkText = (text: string, maxChunkSizeInChars: number = 2000): string[] => {
    if (!text) return [];

    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const paragraph of paragraphs) {
        if (paragraph.trim().length === 0) continue;

        if (currentChunk.length + paragraph.length > maxChunkSizeInChars) {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            currentChunk = paragraph;
        } else {
            currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    // Secondary check for any single paragraphs that are too large
    return chunks.flatMap(chunk => {
        if (chunk.length > maxChunkSizeInChars) {
            const sentences = chunk.split(/(?<=[.?!])\s+/);
            const subChunks: string[] = [];
            let currentSubChunk = "";
            for (const sentence of sentences) {
                if (currentSubChunk.length + sentence.length > maxChunkSizeInChars) {
                    if (currentSubChunk) subChunks.push(currentSubChunk);
                    currentSubChunk = sentence;
                } else {
                    currentSubChunk += (currentSubChunk ? " " : "") + sentence;
                }
            }
            if (currentSubChunk) subChunks.push(currentSubChunk);
            return subChunks;
        }
        return chunk;
    });
};

/**
 * Finds the most relevant text chunks based on a user's query using simple keyword matching.
 * @param query The user's question.
 * @param chunks The array of available knowledge base chunks.
 * @param topK The number of top chunks to return.
 * @returns A single string containing the concatenated relevant chunks.
 */
const getRelevantChunks = (query: string, chunks: string[], topK: number = 5): string => {
    if (!chunks || chunks.length === 0) {
        return '';
    }

    const queryWords = new Set(query.toLowerCase().match(/\w+/g) || []);
    if (queryWords.size === 0) {
        return ''; // No relevant words in query
    }

    const scoredChunks = chunks.map((chunk, index) => {
        const chunkWords = new Set(chunk.toLowerCase().match(/\w+/g) || []);
        let score = 0;
        for (const word of queryWords) {
            if (chunkWords.has(word)) {
                score++;
            }
        }
        return { chunk, score, index };
    });

    const topChunks = scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .filter(c => c.score > 0) // Only include chunks that have at least one match
        .sort((a, b) => a.index - b.index); // Restore original order for context

    return topChunks.map(c => c.chunk).join('\n\n---\n\n');
};
// --- End of Text Utilities ---


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

const App: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>(() => {
        const kbExists = !!localStorage.getItem('chatchok-knowledge-base');
        const initialText = kbExists
            ? "Buongiorno! Sono il tuo assistente di conoscenza. La base di conoscenza è carica, fai pure le tue domande."
            : "Buongiorno! Sono il tuo assistente. Per iniziare, carica una base di conoscenza dal pannello delle impostazioni a sinistra.";
        return [{ role: 'model', text: initialText }];
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [totalTokensUsed, setTotalTokensUsed] = useState<number>(0);
    const [knowledgeBase, setKnowledgeBase] = useState<string>(() => {
         try {
            return localStorage.getItem('chatchok-knowledge-base') || '';
        } catch (e) {
            console.error("Failed to read knowledge base from localStorage", e);
            return '';
        }
    });
    const [knowledgeBaseChunks, setKnowledgeBaseChunks] = useState<string[]>([]);
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isSimpleView, setIsSimpleView] = useState<boolean>(false);
    
    const stopStreamingRef = useRef(false);

    // Sync knowledge base state with localStorage changes (e.g., from another tab)
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'chatchok-knowledge-base') {
                const newKnowledgeBase = event.newValue || '';
                setKnowledgeBase(newKnowledgeBase);
                setKnowledgeBaseChunks(chunkText(newKnowledgeBase));
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
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

    const processAndStoreKnowledgeBase = useCallback((text: string) => {
        setKnowledgeBase(text);
        setKnowledgeBaseChunks(chunkText(text));
        try {
            localStorage.setItem('chatchok-knowledge-base', text);
        } catch (e) {
            console.error("Failed to save knowledge base to localStorage", e);
            setError("Impossibile salvare la base di conoscenza. Funzionerà solo in questa finestra.");
        }
    }, []);
    
    const handleLoadRemotePDF = useCallback(async () => {
        setIsParsing(true);
        setError(null);
        try {
            const response = await fetch(PROXIED_REMOTE_PDF_URL);
            if (!response.ok) {
                throw new Error(`Impossibile scaricare il file (status: ${response.status})`);
            }
            const blob = await response.blob();
            if (!blob.type.includes('pdf')) {
                console.warn(`Il file remoto potrebbe non essere un PDF. MIME type: ${blob.type}`);
            }

            const remoteFile = new File([blob], 'doc.pdf', { type: 'application/pdf' });
            const text = await extractTextFromPDF(remoteFile);
            processAndStoreKnowledgeBase(text);

        } catch (err) {
            console.error("Error fetching remote PDF:", err);
            const message = err instanceof Error ? err.message : String(err);
            setError(`Errore nel caricamento del PDF remoto: ${message}`);
        } finally {
            setIsParsing(false);
        }
    }, [processAndStoreKnowledgeBase]);
    
    // Chunk the knowledge base if it's loaded from localStorage on startup.
    useEffect(() => {
        if (knowledgeBase) {
            setKnowledgeBaseChunks(chunkText(knowledgeBase));
        }
    }, []); // This effect should run only once on initial mount
    
    useEffect(() => {
        localStorage.setItem('chatSettings', JSON.stringify(settings));
    }, [settings]);

    const handleSettingsChange = useCallback((newSettings: Partial<Settings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const handleSendMessage = useCallback(async (newMessage: string) => {
        if (!newMessage.trim()) return;

        const userMessage: Message = { role: 'user', text: newMessage };

        if (knowledgeBaseChunks.length === 0) {
            setMessages(prev => [
                ...prev,
                userMessage,
                { role: 'model', text: "La base di conoscenza è vuota. Per favore, caricala usando il pannello delle impostazioni." }
            ]);
            return;
        }

        setMessages(prevMessages => [...prevMessages, userMessage, { role: 'model', text: '' }]);
        setIsLoading(true);
        setError(null);
        stopStreamingRef.current = false;

        try {
            // RAG Step: Get relevant context instead of the whole knowledge base
            const relevantContext = getRelevantChunks(newMessage, knowledgeBaseChunks);

            const streamResult = await runChatStream(newMessage, settings, relevantContext);
            
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
                // Note: Token usage is now much lower as we don't send the full KB.
                const tokenCount = lastChunk.usageMetadata?.totalTokenCount ?? 0;
                setTotalTokensUsed(prev => prev + tokenCount);
            }

        } catch (err) {
            console.error("Gemini API Error:", err);
            const errorDetails = err instanceof Error ? err.message : String(err);
            
            const isMissingApiKeyError = errorDetails === "API_KEY_MISSING";
            const isInvalidApiKeyError = /API.*?key.*?not.*?valid|invalid.*?API.*?key|API.*?key.*?invalid|permission.*?denied|API_KEY_INVALID|API.*?key.*?missing|API.*?key.*?must.*?be.*?set/i.test(errorDetails);
            const isBillingError = /billing/i.test(errorDetails);
            const isTokenLimitError = /token.*?limit|request.*?too.*?long|prompt.*?too.*?long/i.test(errorDetails);


            let displayErrorMessage: string;

            if (isMissingApiKeyError) {
                displayErrorMessage = `La variabile d'ambiente API_KEY (o VITE_API_KEY) non è impostata. Assicurati che sia configurata correttamente nel tuo servizio di hosting (es. Netlify) e che il sito sia stato ripubblicato dopo l'aggiunta.`;
            } else if (isInvalidApiKeyError) {
                 displayErrorMessage = `La chiave API fornita non è valida o non ha i permessi necessari. Controlla la tua chiave nelle impostazioni di Google AI Studio e assicurati che l'API sia abilitata per il tuo progetto.\n\nNota: Se sei sicuro che la chiave sia corretta, verifica che sia stata copiata senza spazi extra e che il sito sia stato ripubblicato dopo ogni modifica.`;
            } else if (isBillingError) {
                displayErrorMessage = `Si è verificato un problema di fatturazione con il tuo account Google Cloud. Assicurati che la fatturazione sia abilitata per il progetto associato alla tua chiave API.`;
            } else if (isTokenLimitError) {
                displayErrorMessage = `La richiesta ha superato il limite di token. Questo non dovrebbe accadere con la nuova gestione della conoscenza. Se il problema persiste, contatta il supporto.`;
            } else {
                displayErrorMessage = `Si è verificato un errore inatteso. Riprova.\n\nDettagli: ${errorDetails}`;
            }
            
            setError(displayErrorMessage);
            setMessages(prev => {
                const newMessages = [...prev];
                if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model') {
                    newMessages[newMessages.length - 1].text = displayErrorMessage;
                }
                return newMessages;
            });
        } finally {
            setIsLoading(false);
            stopStreamingRef.current = false;
        }
    }, [settings, knowledgeBaseChunks]);
    
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
        const kbExists = !!localStorage.getItem('chatchok-knowledge-base');
        const initialText = kbExists
            ? "Buongiorno! Sono il tuo assistente di conoscenza. La base di conoscenza è carica, fai pure le tue domande."
            : "Buongiorno! Sono il tuo assistente. Per iniziare, carica una base di conoscenza dal pannello delle impostazioni a sinistra.";
        
        setMessages([{ role: 'model', text: initialText }]);
        setTotalTokensUsed(0);
        setError(null);
        setIsConfirmDialogOpen(false);
    };
    
    const handleClearKnowledgeBase = () => {
        setKnowledgeBase('');
        setKnowledgeBaseChunks([]);
        localStorage.removeItem('chatchok-knowledge-base');
    };

    const userMessagesCount = messages.filter(msg => msg.role === 'user').length;


    return (
        <div className="flex h-screen bg-gray-800 text-white font-sans">
            <div className="flex w-full h-full">
                {!isSimpleView && (
                    <SettingsPanel 
                        settings={settings} 
                        onSettingsChange={handleSettingsChange}
                        onLoadRemotePDF={handleLoadRemotePDF}
                        onClearKnowledgeBase={handleClearKnowledgeBase}
                        isParsing={isParsing}
                        knowledgeBaseTokens={Math.round(knowledgeBase.length / CHARS_PER_TOKEN)}
                        sessionTokensUsed={totalTokensUsed}
                        totalTokenLimit={TOTAL_TOKEN_LIMIT}
                        userMessagesCount={userMessagesCount}
                    />
                )}
                <div className="flex flex-col flex-1 bg-gray-900">
                    <header className="flex items-center justify-between p-4 border-b border-gray-700 shadow-md gap-4">
                        <div className="flex items-center flex-shrink-0">
                            <div className="w-8 h-8 mr-3">
                                <BotIcon />
                            </div>
                            <h1 className="text-xl font-semibold">ChatChok - Agente AI per esperienze cliente</h1>
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
                            {!isSimpleView && (
                                <div className="flex items-center space-x-2 text-sm text-gray-400 p-2 rounded-md bg-gray-800/50" title="Token totali consumati in questa sessione">
                                    <TokenIcon />
                                    <span>{totalTokensUsed.toLocaleString()}</span>
                                </div>
                            )}
                            <button
                                onClick={() => setIsSimpleView(!isSimpleView)}
                                className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label={isSimpleView ? "Passa a Vista Avanzata" : "Passa a Vista Semplice"}
                                title={isSimpleView ? "Passa a Vista Avanzata" : "Passa a Vista Semplice"}
                            >
                                {isSimpleView ? <SettingsIcon /> : <FocusViewIcon />}
                            </button>
                            <button
                                onClick={handleClearChatRequest}
                                className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Pulisci cronologia chat"
                                title="Pulisci cronologia chat"
                            >
                                <TrashIcon />
                            </button>
                            <button
                                onClick={exportChatHistory}
                                className="p-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Esporta cronologia chat"
                                title="Esporta cronologia chat"
                            >
                                <ExportIcon />
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
                            disabled={isLoading || isParsing}
                        />
                        {!isSimpleView && (
                            <p className="text-center text-xs text-gray-500 mt-3">
                                <a href="https://www.theround.it" target="_blank" rel="noopener noreferrer" className="hover:underline">©2025 THE ROUND</a>
                            </p>
                        )}
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
        </div>
    );
};

export default App;