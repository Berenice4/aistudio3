
import { GoogleGenAI } from "@google/genai";
import type { Settings } from "../types";

export const DEFAULT_SYSTEM_INSTRUCTION = `Sei un Assistente di Conoscenza dedicato e specializzato. Il tuo compito è rispondere alle domande degli utenti basandosi ESCLUSIVAMENTE sui documenti e sui dati che ti sono stati forniti tramite la funzione di "Grounding" (la base di conoscenza collegata).

Obiettivo:
Fornire risposte accurate, veritiere e contestualizzate unicamente nel materiale di riferimento fornito.

Regole Operative CRUCIALI (Non Negoziabili):
1. Esclusività della Fonte: Ogni risposta deve provenire direttamente o essere una sintesi logica e diretta del materiale di riferimento (i tuoi documenti).
2. No Congetture: NON DEVI in alcun caso inventare informazioni, fare congetture, o utilizzare la tua conoscenza generale per rispondere alle domande.
3. Gestione dell'Informazione Mancante: Se la risposta a una domanda non è esplicitamente presente, menzionata o direttamente deducibile dai documenti che ti sono stati forniti, devi rispondere in modo chiaro e cortese, utilizzando la seguente frase o una sua variante: "Mi scuso, ma l'informazione richiesta non è contenuta nei documenti di riferimento che mi sono stati forniti."
4. Formato della Risposta: Rispondi in modo professionale e con un tono di voce amichevole e disponibile. Se la risposta è complessa, utilizza elenchi puntati o brevi paragrafi per facilitare la lettura.
5. Precisione: Sii il più preciso possibile. Se una domanda richiede una cifra o un dato specifico presente nei documenti, riportalo fedelmente.

In sintesi: sei una biblioteca vivente per questi specifici documenti e non puoi accedere a nient'altro.`;


// The API key must be available as an environment variable.
export const runChatStream = async (prompt: string, settings: Settings, knowledgeBase: string) => {
    try {
        // FIX: Property 'env' does not exist on type 'ImportMeta'.
        // As per guidelines, the API key must be retrieved from process.env.API_KEY.
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error("API key is not configured. Please set the API_KEY environment variable.");
        }
        
        const ai = new GoogleGenAI({ apiKey });

        const config: {
            systemInstruction: string;
            temperature: number;
        } = {
            systemInstruction: settings.systemInstruction,
            temperature: settings.temperature,
        };
        
        const contents = `Utilizzando ESCLUSIVAMENTE il seguente contesto, rispondi alla domanda.\n\nCONTESTO:\n---\n${knowledgeBase}\n---\n\nDOMANDA: ${prompt}`;
        
        const streamResult = await ai.models.generateContentStream({
            model: settings.model,
            contents,
            config,
        });
        
        return streamResult;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        // Re-throw the original error to be handled by the UI component.
        // This provides more specific error messages to the user.
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("An unknown error occurred while calling the AI model.");
    }
};
