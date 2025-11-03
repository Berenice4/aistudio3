
export type Role = 'user' | 'model';

export interface Message {
    role: Role;
    text: string;
}

export interface Settings {
  model: string;
  temperature: number;
  systemInstruction: string;
}
