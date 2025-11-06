
import React from 'react';
import type { Settings } from '../types';
import UploadIcon from './icons/UploadIcon';
import FileIcon from './icons/FileIcon';
import LoadingSpinner from './LoadingSpinner';
import SourceIcon from './icons/SourceIcon';

interface SettingsPanelProps {
    settings: Settings;
    onSettingsChange: (newSettings: Partial<Settings>) => void;
    files: File[];
    onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveFile: (fileName: string) => void;
    onLoadRemotePDF: (url: string, filename: string) => Promise<void>;
    isParsing: boolean;
    knowledgeBaseTokens: number;
    sessionTokensUsed: number;
    totalTokenLimit: number;
    userMessagesCount: number;
}

const TokenEstimator: React.FC<{
    knowledgeBaseTokens: number;
    sessionTokensUsed: number;
    totalTokenLimit: number;
    userMessagesCount: number;
}> = ({ knowledgeBaseTokens, sessionTokensUsed, totalTokenLimit, userMessagesCount }) => {
    
    // Stime iniziali ragionevoli per il costo di una domanda/risposta, escludendo la KB.
    // Queste vengono usate solo prima che ci sia una cronologia da cui imparare.
    const INITIAL_AVG_Q_AND_A_TOKENS_WITH_KB = 7500;
    const INITIAL_AVG_Q_AND_A_TOKENS_WEB_SEARCH = 3000;
    
    // --- CALCOLO COSTO STIMATO PER TURNO ---
    let estimatedCostPerTurn: number;
    let estimatedQandATokens: number;

    if (userMessagesCount > 0 && sessionTokensUsed > 0) {
        // Stima Dinamica: Usa la media dei turni precedenti. È la più accurata.
        estimatedCostPerTurn = Math.round(sessionTokensUsed / userMessagesCount);
        // Per la visualizzazione, calcoliamo a ritroso la parte di Q&A.
        estimatedQandATokens = Math.max(0, estimatedCostPerTurn - knowledgeBaseTokens);
    } else {
        // Stima Statica Iniziale: Usata solo per il primissimo turno.
        if (knowledgeBaseTokens > 0) {
            estimatedQandATokens = INITIAL_AVG_Q_AND_A_TOKENS_WITH_KB;
        } else {
            estimatedQandATokens = INITIAL_AVG_Q_AND_A_TOKENS_WEB_SEARCH;
        }
        estimatedCostPerTurn = knowledgeBaseTokens + estimatedQandATokens;
    }
    
    // --- CALCOLO VALORI DERIVATI ---
    const remainingTokens = Math.max(0, totalTokenLimit - sessionTokensUsed);
    const currentUsagePercentage = Math.min(100, (sessionTokensUsed / totalTokenLimit) * 100);
    const isOverLimit = sessionTokensUsed >= totalTokenLimit;
    
    const estimatedRemainingTurns = (!isOverLimit && estimatedCostPerTurn > 0)
        ? Math.floor(remainingTokens / estimatedCostPerTurn)
        : 0;

    return (
        <div className="p-3 bg-gray-700/50 rounded-lg space-y-4 border border-gray-600">
            <h3 className="text-sm font-semibold text-white">Stima Consumo Token</h3>
            
            {/* Sezione 1: Utilizzo Attuale */}
            <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Utilizzo Sessione</span>
                    <span className={`font-mono ${isOverLimit ? 'text-red-400 font-semibold' : ''}`}>
                        {sessionTokensUsed.toLocaleString()} / {totalTokenLimit.toLocaleString()}
                    </span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2.5">
                    <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${isOverLimit ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${currentUsagePercentage}%` }}
                    ></div>
                </div>
            </div>

            {/* Sezione 2: Suddivisione Costi per Prossimo Turno */}
            <div className="text-xs text-gray-400 space-y-2 pt-3 border-t border-gray-600/50">
                <div className="flex justify-between">
                    <div>
                        <span>Knowledge Base</span>
                        {knowledgeBaseTokens > 0 && <span className="text-gray-500 italic ml-1">(per turno)</span>}
                    </div>
                    <span className="font-mono">{knowledgeBaseTokens.toLocaleString()} tokens</span>
                </div>
                <div className="flex justify-between">
                    <span>Domanda/Risposta (stima)</span>
                    <span className="font-mono">{Math.round(estimatedQandATokens).toLocaleString()} tokens</span>
                </div>
                <div className="flex justify-between font-medium text-gray-300 mt-1">
                    <span>Costo Stimato / Turno</span>
                    <span className="font-mono">{Math.round(estimatedCostPerTurn).toLocaleString()} tokens</span>
                </div>
            </div>
            
            {/* Sezione 4: Avvisi */}
            {(isOverLimit || (!isOverLimit && knowledgeBaseTokens > 0 && estimatedCostPerTurn > totalTokenLimit)) && (
                <div className="pt-3 border-t border-gray-600/50">
                    {isOverLimit ? (
                        <p className="text-xs text-center text-red-400">
                            Hai superato il limite di token. Rimuovi dei file o cancella la chat per continuare.
                        </p>
                    ) : (
                        <p className="text-xs text-center text-yellow-400">
                           Attenzione: La Knowledge Base più una singola domanda potrebbero superare il limite totale di token.
                       </p>
                    )}
                </div>
            )}
        </div>
    );
};


const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    settings, 
    onSettingsChange, 
    files, 
    onFileChange, 
    onRemoveFile,
    onLoadRemotePDF,
    isParsing,
    knowledgeBaseTokens,
    sessionTokensUsed,
    totalTokenLimit,
    userMessagesCount
}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
    return (
        <aside className="w-80 flex-shrink-0 bg-gray-800 p-4 space-y-6 overflow-y-auto border-r border-gray-700">
            <div>
                <h2 className="text-lg font-semibold text-white">Impostazioni di Precisione</h2>
            </div>

            <div className="space-y-2">
                <label htmlFor="model" className="block text-sm font-medium text-gray-300">
                    Modello AI
                </label>
                <select
                    id="model"
                    value={settings.model}
                    onChange={(e) => onSettingsChange({ model: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
                >
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                </select>
            </div>

            <div className="space-y-2">
                <label htmlFor="temperature" className="block text-sm font-medium text-gray-300">
                    Temperatura: <span className="font-mono text-blue-400">{settings.temperature.toFixed(1)}</span>
                </label>
                <input
                    id="temperature"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(e) => onSettingsChange({ temperature: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
            </div>
            
            <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-300">
                        Base di Conoscenza (PDF)
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                        Carica dei PDF per creare la base di conoscenza. Le risposte del chatbot si baseranno esclusivamente su questi documenti.
                    </p>
                </div>

                <TokenEstimator 
                    knowledgeBaseTokens={knowledgeBaseTokens}
                    sessionTokensUsed={sessionTokensUsed}
                    totalTokenLimit={totalTokenLimit}
                    userMessagesCount={userMessagesCount}
                />
               
                <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept=".pdf"
                    onChange={onFileChange}
                    className="hidden"
                    disabled={isParsing}
                />
                <div className="space-y-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isParsing}
                        className="w-full flex items-center justify-center space-x-2 p-2 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isParsing ? (
                            <>
                                <LoadingSpinner />
                                <span>Elaborazione...</span>
                            </>
                        ) : (
                            <>
                                <UploadIcon />
                                <span>Carica File</span>
                            </>
                        )}
                    </button>
                     <button
                        onClick={() => onLoadRemotePDF('https://www.theround.it/ai/chatchok/doc.pdf', 'doc.pdf')}
                        disabled={isParsing}
                        className="w-full flex items-center justify-center space-x-2 p-2 bg-gray-700/80 rounded-md hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isParsing ? (
                            <>
                                <LoadingSpinner />
                                <span>Elaborazione...</span>
                            </>
                        ) : (
                            <>
                                <SourceIcon className="w-5 h-5"/>
                                <span>Carica da URL</span>
                            </>
                        )}
                    </button>
                </div>
                {files.length > 0 && (
                    <div className="mt-2 space-y-2 text-xs">
                        {files.map(file => (
                             <div key={file.name} className="flex items-center justify-between p-2 bg-gray-700/50 rounded-md">
                                <div className="flex items-center space-x-2 overflow-hidden">
                                    <FileIcon className="w-4 h-4 flex-shrink-0 text-gray-400"/>
                                    <span className="truncate" title={file.name}>{file.name}</span>
                                </div>
                                <button 
                                    onClick={() => onRemoveFile(file.name)}
                                    className="text-gray-400 hover:text-white font-bold text-lg leading-none flex-shrink-0 ml-2">&times;
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {files.length === 0 && knowledgeBaseTokens > 0 && (
                     <div className="p-3 bg-gray-700/50 rounded-lg text-xs text-gray-400 border border-gray-600">
                        <p>
                           Una base di conoscenza di una sessione precedente è attiva.
                        </p>
                        <p className="mt-1">
                           Caricando nuovi file la sostituirai.
                        </p>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <label htmlFor="systemInstruction" className="block text-sm font-medium text-gray-300">
                    Istruzioni di Sistema
                </label>
                <textarea
                    id="systemInstruction"
                    rows={15}
                    value={settings.systemInstruction}
                    onChange={(e) => onSettingsChange({ systemInstruction: e.target.value })}
                    className="w-full p-2 bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600 text-xs font-mono"
                />
            </div>
        </aside>
    );
};

export default SettingsPanel;
