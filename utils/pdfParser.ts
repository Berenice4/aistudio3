
import * as pdfjsLib from 'pdfjs-dist';

// Imposta il percorso del worker per pdf.js, essenziale per l'esecuzione in un ambiente web.
// Fa in modo che l'analisi pesante avvenga in un thread separato per non bloccare l'interfaccia utente.
try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';
} catch (e) {
    console.warn("Could not set PDF.js worker source. PDF parsing might be slower or fail in some environments.");
}


/**
 * Estrae il testo da un singolo file PDF.
 * @param file L'oggetto File del PDF da analizzare.
 * @returns Una Promise che si risolve con il testo estratto come stringa.
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
    // Legge il file come ArrayBuffer, che è il formato richiesto da pdf.js.
    const arrayBuffer = await file.arrayBuffer();

    // Carica il documento PDF dall'ArrayBuffer.
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let allText = '';
    
    // Itera su ogni pagina del PDF.
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Estrae gli item di testo e li unisce in una singola stringa per la pagina.
        const pageText = textContent.items
            .map(item => ('str' in item ? item.str : ''))
            .join(' ');
            
        allText += pageText + '\n'; // Aggiunge un a capo tra le pagine.
    }
    
    return allText;
};
