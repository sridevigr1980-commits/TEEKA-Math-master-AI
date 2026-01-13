
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { GradeLevel, MathTopic } from '../types';

const decode = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const encode = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

interface Props {
  gradeLevel: GradeLevel;
  topic: MathTopic;
}

export const LiveVoiceSession: React.FC<Props> = ({ gradeLevel, topic }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Idle');
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const startSession = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setStatus('Listening...');
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error(e);
            setStatus('Error');
          },
          onclose: () => {
            setIsActive(false);
            setStatus('Idle');
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are a patient and encouraging math tutor for a ${gradeLevel} student. The current focus is ${topic}. Use terminology appropriate for this level and guide the user through solving math problems step-by-step through conversation.`,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
      });

      sessionRef.current = await sessionPromise;
      setIsActive(true);
    } catch (err) {
      console.error(err);
      setStatus('Permission Denied');
    }
  };

  const stopSession = () => {
    sessionRef.current?.close();
    setIsActive(false);
    setStatus('Idle');
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 flex flex-col items-center">
      <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${isActive ? 'bg-indigo-500 animate-pulse' : 'bg-slate-200'}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-12 w-12 ${isActive ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">Live Voice Tutoring</h3>
      <div className="flex space-x-2 mb-4">
        <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase rounded-md border border-indigo-100">{gradeLevel}</span>
        <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase rounded-md border border-indigo-100">{topic}</span>
      </div>
      <p className="text-slate-500 text-center mb-6 max-w-xs">
        {isActive ? "Tutor is active. Talk about a math problem now!" : "Click start to have a real-time voice conversation with your AI math tutor."}
      </p>
      <div className="text-sm font-medium text-slate-400 mb-6">Status: {status}</div>
      <button
        onClick={isActive ? stopSession : startSession}
        className={`px-8 py-3 rounded-full font-semibold transition-all shadow-lg active:scale-95 ${isActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
      >
        {isActive ? 'Stop Session' : 'Start Session'}
      </button>
    </div>
  );
};
