
export type Role = 'user' | 'model';

export interface Source {
    uri: string;
    title:string;
}

export interface Message {
    role: Role;
    text: string;
    sources?: Source[];
}

export interface Settings {
  model: string;
  temperature: number;
  systemInstruction: string;
}

export interface GeminiResponse {
    text: string;
    sources: Source[];
    tokenCount: number;
}
