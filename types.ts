export interface Message {
  id: string;
  role: 'user' | 'model';
  text?: string;
  imageUrl?: string;
  feedback?: 'up' | 'down' | null;
  timestamp: number;
  groundingSources?: { title: string; uri: string }[] | null;
}

export type Model = 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-2.5-pro';

export interface Settings {
    systemInstruction: string;
    model: Model;
    temperature: number; // Creativity
    thinkingMode: boolean;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    settings: Settings;
    isEditing?: boolean;
}
