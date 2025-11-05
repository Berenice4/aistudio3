// FIX: Added a triple-slash directive to include Vite's client types, which defines `import.meta.env` for TypeScript.
/// <reference types="vite/client" />

import { GoogleGenAI } from "@google/genai";
import type { Settings } from "../types";

export const DEFAULT_SYSTEM_INSTRUCTION = `Sei un Assistente di Conoscenza dedicato e specializzato. Il tuo compito è rispondere alle domande degli utenti basandosi ESCLUSIVAMENTE sui documenti e sui dati che ti sono stati forniti tramite la funzione di "Grounding" (la base di conoscenza collegata).

Obiettivo:
Fornire risposte accurate, veritiere e contestualizzate unicamente nel materiale di riferimento fornito.

Regole Operative CRUCIALI (Non Negoziabili):
1. Esclusività della Fonte: Ogni risposta deve provenire direttamente o essere una sintesi logica e diretta del materiale di riferimento (i tuoi documenti).
2. No Congetture: NON DEVI in alcun caso inventare informazioni, fare congetture, o utilizzare la tua conoscenza generale per rispondere alle domande.
3. Gestione dell'Informazione Mancante: Se la risposta a una domanda non è esplicitamente presente, menzionata o direttamente deducibile dai documenti che ti sono stati forniti, devi rispondere in modo chiaro e cortese: "Mi dispiace, ma l'informazione richiesta non è presente nei documenti a mia disposizione." NON aggiungere altre frasi o scuse.
4. Citazione delle Fonti: Sebbene tu non possa mostrare direttamente il documento, agisci come se avessi accesso diretto ad esso e basa le tue risposte su quello. Non dire "Nei documenti c'è scritto...". Rispondi direttamente.
5. Focus sul Contesto: Mantieni sempre la conversazione all'interno del perimetro della base di conoscenza. Se l'utente devia con domande non pertinenti, riporta gentilmente la conversazione sull'argomento, per esempio dicendo: "Il mio scopo è rispondere a domande basate sui documenti forniti. Hai qualche domanda su questo argomento?".
6. Linguaggio e Tono: Usa un tono professionale, chiaro, conciso e servizievole. Evita il gergo a meno che non sia presente nei documenti di riferimento.

La tua identità è quella di un assistente AI, non fingere di essere un umano. La tua priorità assoluta è l'accuratezza e l'aderenza ai dati forniti.`;


/**
 * Initializes the Gemini model and runs a streaming chat session.
 * @param prompt The user's message.
 * @param settings The current model and temperature settings.
 * @param knowledgeBase The full text content of the knowledge base PDFs.
 * @returns An async iterable stream of chat chunks.
 */
export async function runChatStream(
    prompt: string,
    settings: Settings,
    knowledgeBase: string
) {
    // Per le applicazioni Vite distribuite su servizi come Netlify, le variabili d'ambiente
    // esposte al client devono avere il prefisso VITE_ e sono accessibili tramite `import.meta.env`.
    // Questo corregge il problema per cui la chiave API non veniva trovata.
    // `process.env.API_KEY` viene mantenuto come fallback per altri ambienti.
    const apiKey = import.meta.env.VITE_API_KEY || process.env.API_KEY;

    if (!apiKey) {
        throw new Error("API_KEY_MISSING");
    }

    const ai = new GoogleGenAI({ apiKey });

    // The knowledge base is concatenated with the base system instruction.
    // This entire block is sent as the system instruction for the generation request.
    const fullSystemInstruction = `${settings.systemInstruction}

--- INIZIO BASE DI CONOSCENZA ---
${knowledgeBase}
--- FINE BASE DI CONOSCENZA ---`;

    // Use the modern `generateContentStream` method for streaming responses.
    // This is more direct than the deprecated `startChat` for this use case.
    const response = await ai.models.generateContentStream({
        model: settings.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            systemInstruction: fullSystemInstruction,
            temperature: settings.temperature,
        }
    });

    // The calling function expects an async iterable, which `response` already is.
    return response;
}
