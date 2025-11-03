import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { Source, Settings, GeminiResponse } from "../types";

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


export const runChatStream = async (prompt: string, settings: Settings, knowledgeBase?: string) => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const config: {
            systemInstruction: string;
            temperature: number;
            tools?: { googleSearch: {} }[];
        } = {
            systemInstruction: settings.systemInstruction,
            temperature: settings.temperature,
        };

        let contents: string;

        if (knowledgeBase && knowledgeBase.trim().length > 0) {
            // Modalità Knowledge Base: usa il testo dei PDF come contesto e non usa strumenti esterni.
            contents = `Utilizzando ESCLUSIVAMENTE il seguente contesto, rispondi alla domanda.\n\nCONTESTO:\n---\n${knowledgeBase}\n---\n\nDOMANDA: ${prompt}`;
        } else {
            // Modalità Web Search: usa la ricerca Google se non ci sono PDF.
            contents = prompt;
            config.tools = [{ googleSearch: {} }];
        }

        const streamResult = await ai.models.generateContentStream({
            model: settings.model,
            contents,
            config,
        });
        
        return streamResult;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to get response from AI model: ${error.message}`);
        }
        throw new Error("Failed to get response from AI model due to an unknown error.");
    }
};

export const processFinalResponse = (response: GenerateContentResponse): Omit<GeminiResponse, 'text'> => {
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    
    const sources: Source[] = groundingChunks
        .map(chunk => chunk.web)
        .filter((web): web is { uri: string; title: string } => !!(web?.uri && web.title))
        .map(web => ({
            uri: web.uri,
            title: web.title,
        }));

    // Il conteggio dei token potrebbe non essere disponibile in `usageMetadata` per le risposte in streaming.
    // Questa logica controlla prima la proprietà ufficiale `usageMetadata.totalTokenCount`.
    // Come fallback, controlla una proprietà non tipizzata `totalTokens` che potrebbe esistere sull'oggetto di risposta.
    const tokenCount = response.usageMetadata?.totalTokenCount ?? (response as any).totalTokens ?? 0;
        
    return { sources, tokenCount };
};