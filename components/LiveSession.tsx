import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { X, Mic, MicOff, Video as VideoIcon, VideoOff, Loader2, Zap, SwitchCamera, Smartphone } from 'lucide-react';
import { SYSTEM_PROMPT } from '../constants';

interface LiveSessionProps {
  onClose: () => void;
  onTransfer: () => void;
}

// --- Audio Helpers (from Google GenAI SDK Documentation) ---

function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Float32 audio from browser to PCM Int16 for Gemini
function floatTo16BitPCM(float32Array: Float32Array): DataView {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return view;
}

const LiveSession: React.FC<LiveSessionProps> = ({ onClose, onTransfer }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Camera facing mode state for mobile
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  // Stream & Session Refs
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null); 
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  // Timing & Loops
  const nextStartTimeRef = useRef<number>(0);
  const videoIntervalRef = useRef<number | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);

  useEffect(() => {
    startSession();

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (videoIntervalRef.current) window.clearInterval(videoIntervalRef.current);
    if (audioProcessorRef.current) audioProcessorRef.current.disconnect();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    
    sessionPromiseRef.current?.then(session => {
        if(session.close) session.close();
    });
  };

  const startSession = async () => {
    try {
      const apiKey = process.env.API_KEY || '';
      if (!apiKey) throw new Error("API Key missing");

      const ai = new GoogleGenAI({ apiKey });

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: { width: 640, height: 480, facingMode: facingMode } 
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_PROMPT + "\n\nIMPORTANT: You are in a LIVE VIDEO session. Keep responses concise, conversational, and encouraging.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        },
        callbacks: {
          onopen: () => {
            console.log("Live Session Connected");
            setIsConnected(true);
            startAudioStreaming(stream);
            startVideoStreaming();
          },
          onmessage: async (message: LiveServerMessage) => {
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio) {
                 await playAudioChunk(base64Audio);
             }
          },
          onclose: () => {
            console.log("Live Session Closed");
            setIsConnected(false);
          },
          onerror: (err) => {
            console.error("Live Session Error", err);
            setError("Connection error. Please try again.");
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (err: any) {
      console.error("Failed to start live session:", err);
      setError(err.message || "Failed to access camera/microphone");
    }
  };

  const startAudioStreaming = (stream: MediaStream) => {
    const ctx = inputAudioContextRef.current;
    if (!ctx) return;

    if (audioProcessorRef.current) {
        audioProcessorRef.current.disconnect();
    }

    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    audioProcessorRef.current = processor;

    processor.onaudioprocess = (e) => {
        if (!isMicOn) return; 

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        
        const uint8 = new Uint8Array(pcmData.buffer);
        const base64 = uint8ArrayToBase64(uint8);

        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput({
                media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64
                }
            });
        });
    };

    source.connect(processor);
    processor.connect(ctx.destination);
  };

  const startVideoStreaming = () => {
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);

    videoIntervalRef.current = window.setInterval(() => {
        if (!isVideoOn || !videoRef.current || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const video = videoRef.current;
        
        canvas.width = video.videoWidth * 0.5;
        canvas.height = video.videoHeight * 0.5;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        
        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput({
                media: {
                    mimeType: 'image/jpeg',
                    data: base64Data
                }
            });
        });

    }, 1000); 
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);

    try {
        if (streamRef.current) {
            streamRef.current.getVideoTracks().forEach(t => t.stop());
        }
        
        const newStream = await navigator.mediaDevices.getUserMedia({
             video: { facingMode: newMode, width: 640, height: 480 }
        });
        
        if (streamRef.current && videoRef.current) {
             videoRef.current.srcObject = newStream;
             videoRef.current.play();
        }
        
    } catch (e) {
        console.error("Error switching camera:", e);
    }
  };

  const playAudioChunk = async (base64Audio: string) => {
      const ctx = outputAudioContextRef.current;
      if (!ctx) return;

      try {
          const byteData = base64ToUint8Array(base64Audio);
          const dataInt16 = new Int16Array(byteData.buffer);
          
          const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
          const channelData = buffer.getChannelData(0);
          
          for (let i = 0; i < dataInt16.length; i++) {
              channelData[i] = dataInt16[i] / 32768.0;
          }

          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          
          const currentTime = ctx.currentTime;
          if (nextStartTimeRef.current < currentTime) {
              nextStartTimeRef.current = currentTime;
          }
          
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;

      } catch (e) {
          console.error("Audio playback error", e);
      }
  };

  const toggleMic = () => {
    setIsMicOn(!isMicOn);
  };

  const toggleVideo = () => {
    setIsVideoOn(prev => !prev);
    if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach(track => track.enabled = !isVideoOn);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
       
       {/* Header */}
       <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
          <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-white font-bold text-sm tracking-widest uppercase">
                  {isConnected ? 'Live Agent' : 'Connecting...'}
              </span>
          </div>
          
          <div className="flex items-center gap-2">
              {/* Transfer Button */}
              <button
                onClick={onTransfer}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors border border-white/10"
                title="Continue this session on your mobile device"
              >
                <Smartphone size={16} />
                <span>Transfer to Mobile</span>
              </button>

              <button onClick={onClose} className="p-2 bg-black/40 hover:bg-red-900/80 rounded-full text-white transition-colors border border-white/10">
                  <X size={24} />
              </button>
          </div>
       </div>

       {/* Video Container */}
       <div className="relative w-full h-full flex items-center justify-center bg-black">
          <video 
            ref={videoRef} 
            muted 
            playsInline 
            className={`w-full h-full object-cover transition-opacity duration-500 ${isVideoOn ? 'opacity-100' : 'opacity-0'}`}
          />
          
          {!isVideoOn && (
              <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center border-4 border-slate-700">
                      <VideoOff size={48} className="text-slate-500" />
                  </div>
              </div>
          )}

          {isConnected && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex gap-1 items-end h-16 pointer-events-none">
                {[1,2,3,4,5].map(i => (
                    <div key={i} className="w-2 bg-cyan-400 rounded-full animate-bounce" style={{ height: '30%', animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }} />
                ))}
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
          
          {error && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                  <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-xl max-w-md text-center">
                      <p className="text-red-200 mb-4">{error}</p>
                      <button onClick={onClose} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg">
                          Close Session
                      </button>
                  </div>
              </div>
          )}
       </div>

       {/* Controls */}
       <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 sm:gap-6 p-3 sm:p-4 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700 shadow-2xl">
          <button 
            onClick={toggleMic}
            className={`p-3 sm:p-4 rounded-full transition-all ${isMicOn ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-600 text-white hover:bg-red-500'}`}
            title="Toggle Mic"
          >
              {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          
          <button 
             onClick={onClose}
             className="px-6 py-3 sm:px-8 sm:py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full shadow-lg hover:shadow-red-900/50 transition-all flex items-center gap-2 text-sm sm:text-base whitespace-nowrap"
          >
             <Zap size={20} fill="currentColor" />
             END LIVE
          </button>

          <button 
            onClick={toggleVideo}
            className={`p-3 sm:p-4 rounded-full transition-all ${isVideoOn ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-600 text-white hover:bg-red-500'}`}
            title="Toggle Video"
          >
              {isVideoOn ? <VideoIcon size={24} /> : <VideoOff size={24} />}
          </button>

          <button 
            onClick={switchCamera}
            className="p-3 sm:p-4 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all border border-slate-600"
            title="Switch Camera (Front/Back)"
          >
              <SwitchCamera size={24} />
          </button>
       </div>

    </div>
  );
};

export default LiveSession;