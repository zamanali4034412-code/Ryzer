
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality, Part, Type, FunctionDeclaration, Content, GenerateContentResponse } from "@google/genai";
import type { Message, ChatSession, Settings, Model } from './types';

// FIX: Add type definitions for the Web Speech API
interface SpeechRecognitionAlternative { readonly transcript: string; readonly confidence: number; }
interface SpeechRecognitionResult { readonly isFinal: boolean; readonly length: number; item(index: number): SpeechRecognitionAlternative;[index: number]: SpeechRecognitionAlternative; }
interface SpeechRecognitionResultList { readonly length: number; item(index: number): SpeechRecognitionResult;[index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionEvent extends Event { readonly resultIndex: number; readonly results: SpeechRecognitionResultList; }
interface SpeechRecognitionErrorEvent extends Event { readonly error: string; readonly message: string; }
interface SpeechRecognition extends EventTarget { continuous: boolean; interimResults: boolean; lang: string; onresult: (event: SpeechRecognitionEvent) => void; onerror: (event: SpeechRecognitionErrorEvent) => void; onend: () => void; abort(): void; stop(): void; start(): void; }
interface SpeechRecognitionStatic { new (): SpeechRecognition; }

declare global {
    interface Window {
        SpeechRecognition: SpeechRecognitionStatic;
        webkitSpeechRecognition: SpeechRecognitionStatic;
        marked: { parse: (markdown: string) => string; };
        DOMPurify: { sanitize: (html: string) => string; };
        hljs: { highlightElement: (element: HTMLElement) => void; };
        AudioContext: typeof AudioContext;
        webkitAudioContext: typeof AudioContext;
    }
}
// --- ICONS ---
const AiIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" opacity=".3"/><path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/><circle cx="12" cy="12" r="2"/></svg>);
const UserIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/><path d="M0 0h24v24H0z" fill="none"/></svg>);
const SendIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/><path d="M0 0h24v24H0z" fill="none"/></svg>);
const StopIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>);
const ImageIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0h24v24H0z" fill="none"/><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>);
const ClearIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>);
const MicrophoneIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/><path d="M0 0h24v24H0z" fill="none"/></svg>);
const ThumbsUpIcon = ({ filled }: { filled: boolean }) => (<svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-colors ${filled ? 'text-indigo-500 fill-indigo-500' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'}`} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none"><path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V3a.75.75 0 0 1 .75-.75A2.25 2.25 0 0 1 16.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904M6.633 10.5l-1.884-1.884a.75.75 0 0 0-1.06 0l-1.06 1.06a.75.75 0 0 0 0 1.06l1.884 1.884a.75.75 0 0 0 1.06 0Z" /></svg>);
const ThumbsDownIcon = ({ filled }: { filled: boolean }) => (<svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-colors ${filled ? 'text-indigo-500 fill-indigo-500' : 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'}`} viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none"><path strokeLinecap="round" strokeLinejoin="round" d="M7.867 15.5c.806 0 1.533.446 2.031 1.08a9.041 9.041 0 0 1 2.861 2.4c.723.384 1.35.956 1.653 1.715a4.498 4.498 0 0 0 .322 1.672V21a.75.75 0 0 1-.75.75A2.25 2.25 0 0 1 13.5 19.5c0-1.152.26-2.243.723-3.218.266-.558-.107-1.282-.725-1.282H9.374c-1.026 0-1.945-.694-2.054-1.715-.045-.422-.068-.85-.068-1.285a11.95 11.95 0 0 1 2.649-7.521c.388-.482.987-.729-1.605-.729H6.52c-.483 0-.964.078-1.423.23l-3.114 1.04a4.501 4.501 0 0 0-1.423.23H.996M7.867 15.5l-1.884 1.884a.75.75 0 0 0-1.06 0l-1.06-1.06a.75.75 0 0 0 0-1.06l1.884-1.884a.75.75 0 0 0 1.06 0Z" /></svg>);
const CopyIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>);
const CheckIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>);
const SettingsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01-.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>);
const RegenerateIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.885-.666A5.002 5.002 0 0114.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566z" clipRule="evenodd" /></svg>);
const SpeakerIcon = ({ speaking }: { speaking: boolean }) => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">{speaking ? <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /> : <path fillRule="evenodd" d="M5.05 3.636a1 1 0 011.414 0L10 7.172l3.536-3.536a1 1 0 111.414 1.414L11.414 8.586l3.536 3.536a1 1 0 01-1.414 1.414L10 10l-3.536 3.536a1 1 0 01-1.414-1.414L8.586 8.586 5.05 5.05a1 1 0 010-1.414z" clipRule="evenodd" /></svg>);
const SunIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 14.464A1 1 0 106.465 13.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 11a1 1 0 100-2H4a1 1 0 100 2h1zM4.54 5.46a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0z" /></svg>);
const MoonIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>);
const DownloadIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>);
const PaperclipIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>);
const XIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
const MenuIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>);
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>);
const PencilIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>);
const TrashIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>);
const SearchIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const GlobeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9M3 12h18" /></svg>);


// --- HELPER FUNCTIONS ---
const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
}

const DEFAULT_SETTINGS: Settings = {
    systemInstruction: 'You are a helpful and friendly assistant named Ryzer. You must format your responses in Markdown.',
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    thinkingMode: false,
};

// --- SUB-COMPONENTS ---
const ChatMessage: React.FC<{ message: Message; onFeedback: (id: string, feedback: 'up' | 'down') => void; onRegenerate: (id: string) => void; onSpeak: (text: string, id: string) => void; isLastModelMessage: boolean; isSpeaking: boolean; }> = ({ message, onFeedback, onRegenerate, onSpeak, isLastModelMessage, isSpeaking }) => {
    const isUser = message.role === 'user';
    const contentRef = useRef<HTMLDivElement>(null);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (contentRef.current && message.text && message.role === 'model') {
            const dirtyHtml = window.marked.parse(message.text);
            contentRef.current.innerHTML = window.DOMPurify.sanitize(dirtyHtml);
            contentRef.current.querySelectorAll('pre code').forEach((block) => { window.hljs.highlightElement(block as HTMLElement); });
        }
    }, [message.text, message.role]);

    const handleCopy = () => {
        if (message.text) {
            navigator.clipboard.writeText(message.text).then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            });
        }
    };
    
    return (
        <div className={`flex items-start gap-3 w-full max-w-4xl mx-auto message-enter ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="flex-shrink-0 mt-1">{isUser ? <UserIcon /> : <AiIcon />}</div>
            <div className={`flex flex-col gap-1 w-full ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-lg p-3 text-gray-900 dark:text-white ${isUser ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-gray-700'} w-fit max-w-full`}>
                    {message.text && (message.role === 'model' ? <div ref={contentRef} className="markdown-content text-sm md:text-base"></div> : <p className="text-sm md:text-base whitespace-pre-wrap">{message.text}</p>)}
                    {message.imageUrl && <img src={message.imageUrl} alt={isUser ? "User upload" : "Generated"} className="mt-2 rounded-lg max-w-full h-auto md:max-w-md" />}
                    {message.groundingSources && message.groundingSources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-gray-600">
                            <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5"><GlobeIcon /> Sources</h4>
                            <div className="flex flex-col gap-1.5">
                                {message.groundingSources.map((source, index) => (
                                    <a key={index} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 dark:text-blue-400 hover:underline truncate">
                                       {index + 1}. {source.title || source.uri}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs px-1">
                    <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                </div>
                {message.role === 'model' && (message.text || message.imageUrl) && (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <button onClick={handleCopy} className="hover:text-black dark:hover:text-white transition-colors" title="Copy"><>{isCopied ? <CheckIcon /> : <CopyIcon />}</></button>
                        <button onClick={() => onFeedback(message.id, 'up')} title="Good response"><ThumbsUpIcon filled={message.feedback === 'up'} /></button>
                        <button onClick={() => onFeedback(message.id, 'down')} title="Bad response"><ThumbsDownIcon filled={message.feedback === 'down'} /></button>
                        {message.text && <button onClick={() => onSpeak(message.text ?? '', message.id)} className="hover:text-black dark:hover:text-white transition-colors" title="Read aloud"><SpeakerIcon speaking={isSpeaking} /></button>}
                        {isLastModelMessage && <button onClick={() => onRegenerate(message.id)} className="hover:text-black dark:hover:text-white transition-colors" title="Regenerate"><RegenerateIcon /></button>}
                    </div>
                )}
            </div>
        </div>
    );
};

const ChatInput: React.FC<{ onSendMessage: (text: string, image?: string) => void; isLoading: boolean; isImageMode: boolean; onToggleImageMode: () => void; onStopGeneration: () => void; attachedImage: string | null; setAttachedImage: (img: string | null) => void; useGoogleSearch: boolean; setUseGoogleSearch: (use: boolean) => void;}> = ({ onSendMessage, isLoading, isImageMode, onToggleImageMode, onStopGeneration, attachedImage, setAttachedImage, useGoogleSearch, setUseGoogleSearch }) => {
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) return;
        const r = new SpeechRecognitionAPI();
        r.continuous = true; r.interimResults = true; r.lang = 'en-US';
        r.onresult = (e) => { setInput(Array.from(e.results).map(r => r[0].transcript).join('')); };
        r.onerror = (e) => { console.error('Speech recognition error:', e.error); setIsListening(false); };
        r.onend = () => setIsListening(false);
        recognitionRef.current = r;
        return () => r.abort();
    }, []);
    
    const handleToggleListening = () => {
        if (isLoading || !recognitionRef.current) return;
        if (isListening) { recognitionRef.current.stop(); } else { recognitionRef.current.start(); }
        setIsListening(!isListening);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await blobToBase64(file);
            setAttachedImage(base64);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if ((input.trim() || attachedImage) && !isLoading) {
            onSendMessage(input.trim(), attachedImage ?? undefined);
            setInput('');
            setAttachedImage(null);
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-4xl mx-auto">
             {attachedImage && (
                <div className="relative w-fit">
                    <img src={attachedImage} alt="Attachment preview" className="h-20 w-20 object-cover rounded-md"/>
                    <button type="button" onClick={() => setAttachedImage(null)} className="absolute top-0 right-0 -mt-2 -mr-2 bg-gray-800 dark:bg-gray-700 text-white rounded-full p-1 hover:bg-red-600 dark:hover:bg-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500" aria-label="Remove image"><XIcon/></button>
                </div>
            )}
            <div className="flex items-center gap-2">
                <button type="button" onClick={onToggleImageMode} disabled={isLoading} className={`p-3 rounded-lg text-white transition duration-200 disabled:opacity-50 ${isImageMode ? 'bg-indigo-600' : 'bg-gray-600 hover:bg-gray-500'}`} title="Toggle image generation mode"><ImageIcon /></button>
                <button type="button" onClick={handleToggleListening} disabled={isLoading} className={`p-3 rounded-lg text-white transition duration-200 disabled:opacity-50 ${isListening ? 'bg-red-600 animate-pulse' : 'bg-gray-600 hover:bg-gray-500'}`} title={isListening ? "Stop listening" : "Start listening"}><MicrophoneIcon /></button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-3 rounded-lg text-white bg-gray-600 hover:bg-gray-500 transition duration-200 disabled:opacity-50" title="Attach image"><PaperclipIcon /></button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*"/>
                <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={isImageMode ? "Describe an image to create..." : "Type your message..."} disabled={isLoading} rows={1} className="flex-1 p-3 bg-slate-200 dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition duration-200 disabled:opacity-50 resize-none max-h-40"/>
                <div className="flex items-center gap-2">
                    <label htmlFor="google-search-toggle" className="flex items-center cursor-pointer" title="Ground response with Google Search">
                        <div className="relative">
                            <input type="checkbox" id="google-search-toggle" className="sr-only" checked={useGoogleSearch} onChange={() => setUseGoogleSearch(!useGoogleSearch)} />
                            <div className={`block w-12 h-6 rounded-full transition ${useGoogleSearch ? 'bg-indigo-600' : 'bg-gray-600'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useGoogleSearch ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                        <div className="ml-2 text-gray-500 dark:text-gray-400"><SearchIcon /></div>
                    </label>
                </div>
                <button type={isLoading ? 'button' : 'submit'} onClick={isLoading ? onStopGeneration : undefined} disabled={(!input.trim() && !attachedImage) && !isLoading} className="p-3 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed transition duration-200" title={isLoading ? "Stop generation" : "Send message"}>{isLoading ? <StopIcon /> : <SendIcon />}</button>
            </div>
        </form>
    );
};

const LoadingDots = () => (<div className="flex justify-start w-full max-w-4xl mx-auto"><div className="flex items-center gap-3"><div className="flex-shrink-0 mt-1"><AiIcon /></div><div className="bg-slate-100 dark:bg-gray-700 rounded-lg p-3 flex items-center space-x-2"><div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div><div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse [animation-delay:0.2s]"></div><div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse [animation-delay:0.4s]"></div></div></div></div>);

const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void; settings: Settings; setSettings: (s: Settings) => void; onSave: () => void; }> = ({ isOpen, onClose, theme, setTheme, settings, setSettings, onSave }) => {
    if (!isOpen) return null;

    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newModel = e.target.value as Model;
        const newSettings = { ...settings, model: newModel };
        if (newModel !== 'gemini-2.5-pro') {
            newSettings.thinkingMode = false; // Disable thinking mode if not Pro
        }
        setSettings(newSettings);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-30 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">Settings</h2>
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <span className="font-medium">Theme</span>
                        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full bg-slate-200 dark:bg-gray-700">{theme === 'light' ? <MoonIcon/> : <SunIcon/>}</button>
                    </div>
                    <div>
                        <label htmlFor="model-select" className="block mb-2 text-sm font-medium">AI Model</label>
                        <select id="model-select" value={settings.model} onChange={handleModelChange} className="w-full p-2 bg-slate-100 dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg">
                            <option value="gemini-2.5-flash-lite">Flash Lite (Fastest)</option>
                            <option value="gemini-2.5-flash">Flash (Balanced)</option>
                            <option value="gemini-2.5-pro">Pro (Most Powerful)</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="creativity-slider" className="block mb-2 text-sm font-medium">Creativity (Temperature): {settings.temperature}</label>
                        <input id="creativity-slider" type="range" min="0" max="1" step="0.1" value={settings.temperature} onChange={e => setSettings({...settings, temperature: parseFloat(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"/>
                    </div>
                     <div className="flex items-center justify-between">
                        <label htmlFor="thinking-mode-toggle" className={`font-medium ${settings.model !== 'gemini-2.5-pro' ? 'text-gray-400 dark:text-gray-500' : ''}`}>Thinking Mode</label>
                        <div className="relative">
                            <input type="checkbox" id="thinking-mode-toggle" className="sr-only" checked={settings.thinkingMode} onChange={() => setSettings({...settings, thinkingMode: !settings.thinkingMode})} disabled={settings.model !== 'gemini-2.5-pro'}/>
                            <div className={`block w-10 h-6 rounded-full transition ${settings.thinkingMode ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${settings.thinkingMode ? 'transform translate-x-4' : ''}`}></div>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="system-prompt" className="block mb-2 text-sm font-medium">System Prompt</label>
                        <textarea id="system-prompt" rows={4} value={settings.systemInstruction} onChange={e => setSettings({...settings, systemInstruction: e.target.value})} className="w-full p-2 bg-slate-100 dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg"></textarea>
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={onSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save & Close</button>
                </div>
            </div>
        </div>
    );
};

const WelcomeScreen: React.FC<{ onExampleClick: (prompt: string, imageMode?: boolean) => void }> = ({ onExampleClick }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AiIcon/>
        <h1 className="text-4xl font-bold mt-4">Ryzer</h1>
        <p className="mt-2 text-slate-600 dark:text-gray-400">Your all-in-one AI that talks, thinks, and creates.</p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
            <button onClick={() => onExampleClick("Explain quantum computing in simple terms")} className="p-4 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left"><b>Explain quantum computing</b><br/><span className="text-sm text-gray-500 dark:text-gray-400">in simple terms</span></button>
            <button onClick={() => onExampleClick("Create an image of a majestic lion in a futuristic city", true)} className="p-4 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left"><b>Create an image</b><br/><span className="text-sm text-gray-500 dark:text-gray-400">of a majestic lion...</span></button>
            <button onClick={() => onExampleClick("What are three tips for learning a new language?")} className="p-4 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left"><b>Tips for learning a new language?</b><br/><span className="text-sm text-gray-500 dark:text-gray-400">list three ideas</span></button>
            <button onClick={() => onExampleClick("Write a short story about a robot who discovers music.")} className="p-4 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-left"><b>Write a short story</b><br/><span className="text-sm text-gray-500 dark:text-gray-400">about a robot who discovers music</span></button>
        </div>
    </div>
);

// --- MAIN APP ---
const App: React.FC = () => {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isImageMode, setIsImageMode] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [tempSettings, setTempSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const [isSpeakingMessageId, setIsSpeakingMessageId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [useGoogleSearch, setUseGoogleSearch] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const stopGenerationRef = useRef<boolean>(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // --- Active Session ---
    const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId), [sessions, activeSessionId]);
    const setMessages = (updater: (prevMessages: Message[]) => Message[]) => {
        setSessions(prevSessions => prevSessions.map(s => 
            s.id === activeSessionId ? { ...s, messages: updater(s.messages) } : s
        ));
    };

    // --- EFFECTS for Persistence and Setup ---
    useEffect(() => {
        const savedSessions = localStorage.getItem('ryzer-sessions');
        const savedActiveId = localStorage.getItem('ryzer-active-session-id');
        const savedTheme = localStorage.getItem('ryzer-theme') as 'light' | 'dark' | null;

        if (savedTheme) setTheme(savedTheme);
        else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
        else setTheme('light');

        if (savedSessions) {
            const parsedSessions = JSON.parse(savedSessions);
            setSessions(parsedSessions);
            if (savedActiveId && parsedSessions.some((s: ChatSession) => s.id === savedActiveId)) {
                setActiveSessionId(savedActiveId);
            } else if (parsedSessions.length > 0) {
                setActiveSessionId(parsedSessions[0].id);
            } else {
                handleNewChat();
            }
        } else {
            handleNewChat();
        }
    }, []);

    useEffect(() => {
        if (sessions.length > 0) {
            localStorage.setItem('ryzer-sessions', JSON.stringify(sessions));
        }
        if (activeSessionId) {
            localStorage.setItem('ryzer-active-session-id', activeSessionId);
        }
    }, [sessions, activeSessionId]);

    useEffect(() => { localStorage.setItem('ryzer-theme', theme); document.documentElement.className = theme; }, [theme]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeSession?.messages, isLoading]);

    // --- CHAT SESSION HANDLERS ---
    const handleNewChat = () => {
        const newSession: ChatSession = {
            id: `session-${Date.now()}`,
            title: 'New Chat',
            messages: [],
            settings: DEFAULT_SETTINGS,
        };
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
    };
    
    const handleClearChat = () => { if (!isLoading && activeSession) setMessages(() => []); };
    const handleDeleteChat = (id: string) => {
        setSessions(prev => prev.filter(s => s.id !== id));
        if (activeSessionId === id) {
            if (sessions.length > 1) {
                setActiveSessionId(sessions.find(s => s.id !== id)?.id || null);
            } else {
                handleNewChat();
            }
        }
    };
    
    const handleRenameChat = (id: string, newTitle: string) => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle, isEditing: false } : s));
    };

    // --- OTHER HANDLERS ---
    const handleFeedback = (id: string, feedback: 'up' | 'down') => setMessages(p => p.map(m => m.id === id ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m));
    const handleStopGeneration = () => { stopGenerationRef.current = true; };
    const handleSettingsSave = () => {
        if (activeSession) {
            setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, settings: tempSettings } : s));
        }
        setIsSettingsOpen(false);
    };
    const handleSettingsOpen = () => {
        if (activeSession) {
            setTempSettings(activeSession.settings);
            setIsSettingsOpen(true);
        }
    };

    const handleSpeak = async (text: string, id: string) => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
        }

        if (isSpeakingMessageId === id) {
            setIsSpeakingMessageId(null);
            return;
        }
        setIsSpeakingMessageId(id);
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text }] }],
                config: { responseModalities: [Modality.AUDIO] }
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("No audio data returned");

            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const audioContext = audioContextRef.current;
            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext);
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.onended = () => {
                setIsSpeakingMessageId(null);
                audioSourceRef.current = null;
            };
            source.start(0);
            audioSourceRef.current = source;

        } catch (error) {
            console.error("TTS Error:", error);
            setIsSpeakingMessageId(null);
        }
    };
    
    const handleRegenerate = async (messageId: string) => {
        if (!activeSession) return;
        const messageIndex = activeSession.messages.findIndex(m => m.id === messageId);
        if (messageIndex > 0) {
            const lastUserMessage = activeSession.messages.slice(0, messageIndex).reverse().find(m => m.role === 'user');
            if (lastUserMessage) {
                setMessages(prev => prev.slice(0, messageIndex));
                await handleSendMessage(lastUserMessage.text || '', lastUserMessage.imageUrl || undefined, true);
            }
        }
    };
    
    const handleExportChat = () => {
        if (!activeSession) return;
        const dataStr = JSON.stringify(activeSession, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ryzer-chat-${activeSession.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleSendMessage = useCallback(async (input: string, image?: string, isRegeneration = false) => {
        if (!activeSession) return;
        setIsLoading(true);
        stopGenerationRef.current = false;
        
        if (!isRegeneration) {
            const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', text: input, imageUrl: image, timestamp: Date.now() };
            setMessages(prev => [...prev, userMessage]);
        }
    
        if (isImageMode && !image) {
            // Text-to-Image Generation
            setIsImageMode(false);
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const response = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: input }] }, config: { responseModalities: [Modality.IMAGE] } });
                const part = response.candidates?.[0]?.content?.parts?.[0];
                if (part?.inlineData) {
                    const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    setMessages(prev => [...prev, { id: `model-${Date.now()}`, role: 'model', imageUrl, timestamp: Date.now() }]);
                } else throw new Error('No image data received.');
            } catch (error) {
                console.error("Error generating image:", error);
                setMessages(prev => [...prev, { id: `model-${Date.now()}`, role: 'model', text: "Sorry, I could not generate an image from that prompt.", timestamp: Date.now() }]);
            } finally { setIsLoading(false); }
        } else {
            // Chat (with optional vision and other settings)
            const modelMessageId = `model-${Date.now()}`;
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                
                const history: Content[] = activeSession.messages.map(msg => ({
                    role: msg.role,
                    parts: (msg.text ? [{ text: msg.text }] as Part[] : []).concat(msg.imageUrl ? [{
                        inlineData: {
                            mimeType: msg.imageUrl.match(/data:(image\/.*?);/)?.[1] || 'image/jpeg',
                            data: msg.imageUrl.split(',')[1]
                        }
                    }] : [])
                }));

                const contents: (string | Part)[] = [input];
                if (image) {
                    const mimeType = image.match(/data:(image\/.*?);/)?.[1];
                    const base64Data = image.split(',')[1];
                    if (mimeType && base64Data) {
                        contents.unshift({ inlineData: { mimeType, data: base64Data } });
                    }
                }
                
                const modelConfig: any = {
                    systemInstruction: activeSession.settings.systemInstruction,
                    temperature: activeSession.settings.temperature,
                };

                if (useGoogleSearch) {
                    modelConfig.tools = [{ googleSearch: {} }];
                }
                 if (activeSession.settings.model === 'gemini-2.5-pro' && activeSession.settings.thinkingMode) {
                    modelConfig.thinkingConfig = { thinkingBudget: 32768 };
                }

                setMessages(prev => [...prev, { id: modelMessageId, role: 'model', text: '', timestamp: Date.now() }]);
        
                const stream = await ai.models.generateContentStream({
                    model: activeSession.settings.model,
                    contents: { role: 'user', parts: contents.map(c => typeof c === 'string' ? { text: c } : c) },
                    history,
                    config: modelConfig,
                });
        
                let fullResponse = '';
                let finalResponse: GenerateContentResponse | undefined;
                for await (const chunk of stream) {
                    if (stopGenerationRef.current) break;
                    fullResponse += chunk.text;
                    setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, text: fullResponse } : m));
                    finalResponse = chunk;
                }
                
                const groundingChunks = finalResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if (groundingChunks) {
                    const sources = groundingChunks.map((chunk: any) => ({
                        title: chunk.web?.title || chunk.web?.uri || 'Source',
                        uri: chunk.web?.uri || '#'
                    }));
                    setMessages(prev => prev.map(m => m.id === modelMessageId ? { ...m, groundingSources: sources } : m));
                }

            } catch (error: any) {
                console.error("Error sending message:", error);
                const errorMessage = error.message || "Sorry, something went wrong. Please try again.";
                setMessages(prev => prev.map(m => m.id === modelMessageId && !m.text ? { ...m, text: errorMessage } : m));
            } finally { setIsLoading(false); stopGenerationRef.current = false; }
        }
    }, [activeSession, isImageMode, useGoogleSearch]);

    const lastModelMessage = activeSession?.messages.slice().reverse().find(m => m.role === 'model');

    return (
        <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans">
            <aside className={`bg-slate-100 dark:bg-gray-800 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0'} overflow-hidden`}>
                <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-blue-500">Ryzer</h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400">Your all-in-one AI that talks, thinks, and creates.</p>
                </div>
                <div className="p-2 flex-shrink-0">
                    <button onClick={handleNewChat} className="w-full flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors font-semibold">
                        <PlusIcon /> New Chat
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sessions.map(session => (
                        <div key={session.id} className={`group flex items-center p-2 rounded-lg cursor-pointer ${activeSessionId === session.id ? 'bg-indigo-500 text-white' : 'hover:bg-slate-200 dark:hover:bg-gray-700'}`} onClick={() => setActiveSessionId(session.id)}>
                            {session.isEditing ? (
                                <>
                                <input type="text" defaultValue={session.title} autoFocus onBlur={(e) => handleRenameChat(session.id, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleRenameChat(session.id, e.currentTarget.value) }} className="flex-1 bg-transparent border-b border-white/50 outline-none text-sm"/>
                                </>
                            ) : (
                                <span className="flex-1 truncate text-sm">{session.title}</span>
                            )}
                            <div className={`flex items-center gap-1 transition-opacity ${activeSessionId === session.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                {!session.isEditing && <button onClick={(e) => { e.stopPropagation(); setSessions(p => p.map(s => s.id === session.id ? {...s, isEditing: true} : s)) }} className="p-1 rounded hover:bg-white/20"><PencilIcon /></button>}
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(session.id); }} className="p-1 rounded hover:bg-white/20"><TrashIcon /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            <div className="flex flex-col flex-1">
                <header className="relative p-4 border-b border-slate-200 dark:border-gray-700 shadow-sm bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700" title="Toggle Sidebar"><MenuIcon /></button>
                        <button onClick={handleClearChat} disabled={isLoading || !activeSession?.messages.length} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700 disabled:opacity-50" title="Clear conversation"><ClearIcon /></button>
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-blue-500">{activeSession?.title || 'Ryzer'}</h1>
                    <div className="flex items-center gap-2">
                        <button onClick={handleExportChat} disabled={isLoading || !activeSession?.messages.length} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700 disabled:opacity-50" title="Export Chat"><DownloadIcon /></button>
                        <button onClick={handleSettingsOpen} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-700" title="Settings"><SettingsIcon /></button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 space-y-6">
                    {activeSession?.messages.length ? activeSession.messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} onFeedback={handleFeedback} onRegenerate={handleRegenerate} onSpeak={handleSpeak} isLastModelMessage={lastModelMessage?.id === msg.id} isSpeaking={isSpeakingMessageId === msg.id}/>
                    )) : <WelcomeScreen onExampleClick={(p, imgMode) => { if(imgMode) setIsImageMode(true); handleSendMessage(p); }}/> }
                    {isLoading && <LoadingDots />}
                    <div ref={messagesEndRef} />
                </main>

                <footer className="p-4 bg-white dark:bg-gray-900 border-t border-slate-200 dark:border-gray-700">
                    <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} isImageMode={isImageMode} onToggleImageMode={() => setIsImageMode(p => !p)} onStopGeneration={handleStopGeneration} attachedImage={attachedImage} setAttachedImage={setAttachedImage} useGoogleSearch={useGoogleSearch} setUseGoogleSearch={setUseGoogleSearch}/>
                </footer>
            </div>
            
            {activeSession && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} theme={theme} setTheme={setTheme} settings={tempSettings} setSettings={setTempSettings} onSave={handleSettingsSave}/>}
        </div>
    );
}

export default App;
