
import React from 'react';
import type { Settings } from '../types';
import LoadingSpinner from './LoadingSpinner';
import SourceIcon from './icons/SourceIcon';

interface SettingsPanelProps {
    settings: Settings;
    onSettingsChange: (newSettings: Partial<Settings>) => void;
    onLoadRemotePDF: () => Promise<void>;
    onClearKnowledgeBase: () => void;
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
    
    // Con il RAG, il costo della KB non è più l'intero documento, ma solo i chunk pertinenti.
    // Questa stima ora è meno predittiva perché non sappiamo a priori quali chunk verranno usati.
    // Mostriamo comunque il costo totale della KB per dare un'idea della sua dimensione.
    const avgContextTokens = Math.min(knowledgeBaseTokens, 8000); // Stima approssimativa di 4-5 chunk
    const avgQandATokens = 1500; // Stima per domanda e risposta
    
    let estimatedCostPerTurn: number;

    if (userMessagesCount > 0 && sessionTokensUsed > 0) {
        // La stima dinamica è ancora la più accurata per il Q&A.
        estimatedCostPerTurn = Math.round(sessionTokensUsed / userMessagesCount);
    } else {
        // Stima statica iniziale
        estimatedCostPerTurn = avgContextTokens + avgQandATokens;
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
                    <span>Dimensione Totale KB</span>
                    <span className="font-mono">{knowledgeBaseTokens.toLocaleString()} tokens</span>
                </div>
                 <div className="flex justify-between">
                    <span>Contesto Inviato (stima)</span>
                    <span className="font-mono">~{avgContextTokens.toLocaleString()} tokens</span>
                </div>
                <div className="flex justify-between font-medium text-gray-300 mt-1">
                    <span>Costo Stimato / Turno</span>
                    <span className="font-mono">~{Math.round(estimatedCostPerTurn).toLocaleString()} tokens</span>
                </div>
            </div>
            
            {/* Sezione 4: Avvisi */}
            {isOverLimit && (
                <div className="pt-3 border-t border-gray-600/50">
                    <p className="text-xs text-center text-red-400">
                        Hai superato il limite di token. Cancella la chat per continuare.
                    </p>
                </div>
            )}
        </div>
    );
};


const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    settings, 
    onSettingsChange, 
    onLoadRemotePDF,
    onClearKnowledgeBase,
    isParsing,
    knowledgeBaseTokens,
    sessionTokensUsed,
    totalTokenLimit,
    userMessagesCount
}) => {
    
    const isKnowledgeBaseLoaded = knowledgeBaseTokens > 0;

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
                        Le risposte del chatbot si basano esclusivamente su un documento PDF caricato da remoto.
                    </p>
                </div>

                <TokenEstimator 
                    knowledgeBaseTokens={knowledgeBaseTokens}
                    sessionTokensUsed={sessionTokensUsed}
                    totalTokenLimit={totalTokenLimit}
                    userMessagesCount={userMessagesCount}
                />
               
                <div className="space-y-2">
                     <button
                        onClick={onLoadRemotePDF}
                        disabled={isParsing}
                        className="w-full flex items-center justify-center space-x-2 p-2 bg-gray-700/80 rounded-md hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isParsing ? (
                            <>
                                <LoadingSpinner />
                                <span>Caricamento...</span>
                            </>
                        ) : (
                            <>
                                <SourceIcon className="w-5 h-5"/>
                                <span>{isKnowledgeBaseLoaded ? "Ricarica Knowledge Base" : "Carica Knowledge Base"}</span>
                            </>
                        )}
                    </button>
                </div>
                
                {isKnowledgeBaseLoaded && !isParsing && (
                     <div className="p-3 bg-gray-700/50 rounded-lg text-xs text-gray-400 border border-gray-600 flex justify-between items-center">
                        <p>
                           Documento <span className="font-semibold text-gray-300">doc.pdf</span> caricato.
                        </p>
                        <button 
                            onClick={onClearKnowledgeBase}
                            className="text-gray-400 hover:text-white font-bold text-lg leading-none flex-shrink-0 ml-2"
                            title="Rimuovi knowledge base"
                        >
                            &times;
                        </button>
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
