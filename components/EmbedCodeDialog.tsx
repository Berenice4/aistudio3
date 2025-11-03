
import React, { useState, useEffect } from 'react';
import CopyIcon from './icons/CopyIcon';
import CheckIcon from './icons/CheckIcon';

interface EmbedCodeDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const EmbedCodeDialog: React.FC<EmbedCodeDialogProps> = ({ isOpen, onClose }) => {
    const [embedCode, setEmbedCode] = useState('');
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Use the URL without query params for cleanliness, then add our own.
            const cleanUrl = window.location.origin + window.location.pathname;
            const iframeCode = `<iframe
  src="${cleanUrl}?embed=true"
  width="400"
  height="600"
  style="border:1px solid #374151; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);"
  title="Chatchok AI Chatbot"
></iframe>`;

            const fullHtml = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assistente AI Integrato</title>
    <style>
        body { 
            margin: 0; 
            font-family: sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: #f0f2f5;
        }
    </style>
</head>
<body>
    <!-- 
      Copia e incolla questo tag <iframe> nel punto della tua pagina 
      in cui vuoi che appaia la chat. 
      La base di conoscenza caricata nell'app principale 
      sarà automaticamente disponibile.
    -->
    ${iframeCode}
</body>
</html>`;
            setEmbedCode(fullHtml);
            setIsCopied(false); // Reset copied state when dialog opens
        }
    }, [isOpen]);

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
    
    const handleCopy = () => {
        navigator.clipboard.writeText(embedCode).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

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
                className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 shadow-xl border border-gray-700 transform transition-all scale-95 opacity-0 animate-fade-in-scale"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-semibold text-white mb-4">Integra la Chat nel Tuo Sito</h2>
                <p className="text-gray-300 mb-6">
                    Copia e incolla questo script HTML completo nel sorgente del tuo sito web dove vuoi che la chat appaia. La base di conoscenza viene ereditata automaticamente.
                </p>
                <div className="relative">
                    <textarea
                        readOnly
                        value={embedCode}
                        className="w-full h-64 p-3 bg-gray-900 rounded-md font-mono text-sm text-gray-300 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                     <button
                        onClick={handleCopy}
                        className="absolute top-2 right-2 p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500"
                        title={isCopied ? "Copiato!" : "Copia negli Appunti"}
                    >
                        {isCopied ? <CheckIcon /> : <CopyIcon />}
                    </button>
                </div>
                 <div className="flex justify-end mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-400"
                    >
                        Chiudi
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmbedCodeDialog;