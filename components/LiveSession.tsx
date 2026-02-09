
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { X, Mic, MicOff, Video as VideoIcon, VideoOff, SwitchCamera, Smartphone, Fingerprint, Eraser, Loader2, Sparkles } from 'lucide-react';
import { SYSTEM_PROMPT } from '../constants';

interface LiveSessionProps {
  onClose: () => void;
  onTransfer: () => void;
  remoteStream: MediaStream | null;
}

// --- Audio Helpers ---
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

declare global {
  interface Window {
    Hands: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
    streamIntervalId?: number;
  }
}

const LiveSession: React.FC<LiveSessionProps> = ({ onClose, onTransfer, remoteStream }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isModelThinking, setIsModelThinking] = useState(false);
  
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [useRemoteCamera, setUseRemoteCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const drawingOverlayRef = useRef<HTMLCanvasElement>(null); 
  const persistentInkRef = useRef<HTMLCanvasElement>(null); 
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const activeVideoStreamRef = useRef<MediaStream | null>(null); 

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const handsRef = useRef<any>(null);
  const lastPointRef = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    initMediaPipe();
    startSession();
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (useRemoteCamera && remoteStream && videoRef.current) {
        activeVideoStreamRef.current = remoteStream;
        videoRef.current.srcObject = remoteStream;
        videoRef.current.play().catch(e => console.error("Video play error", e));
    }
  }, [useRemoteCamera, remoteStream]);

  const initMediaPipe = async () => {
    if (window.Hands) {
      const hands = new window.Hands({locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }});
      
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });
      
      hands.onResults(onHandsResults);
      handsRef.current = hands;
    }
  };

  const cleanup = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioProcessorRef.current) audioProcessorRef.current.disconnect();
    if (localAudioStreamRef.current) localAudioStreamRef.current.getTracks().forEach(track => track.stop());
    if (!useRemoteCamera && activeVideoStreamRef.current) {
        activeVideoStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    if (handsRef.current) handsRef.current.close();
    if (window.streamIntervalId) clearInterval(window.streamIntervalId);
    
    sessionPromiseRef.current?.then(session => {
        if(session.close) session.close();
    });
  };

  const startSession = async () => {
    try {
      if (!process.env.API_KEY) throw new Error("API Key missing");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localAudioStreamRef.current = audioStream;

      const videoStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: facingMode } 
      });
      activeVideoStreamRef.current = videoStream;

      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.play();
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: { model: "google-speech-v1" },
          systemInstruction: SYSTEM_PROMPT + "\n\nACT AS A LIVE MATH TUTOR. The user is drawing equations in the air. \n\nVoice Triggers:\n- 'Observe' or 'Draw': Resets and starts trajectory recording.\n- 'Enter' or 'Finished': Sends the snapshot to you.\n\nWhen a drawing is received, analyze the handwriting/ink to extract math problems. Respond with intuition and step-by-step guidance.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            startAudioStreaming(audioStream);
            startProcessingLoop();
          },
          onmessage: async (message: LiveServerMessage) => {
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio) {
                 setIsModelThinking(false);
                 await playAudioChunk(base64Audio);
             }

             const transcript = message.serverContent?.inputTranscription?.text;
             if (transcript) {
                 const lower = transcript.toLowerCase();
                 setLastTranscript(transcript);
                 
                 if (lower.includes("observe") || lower.includes("draw") || lower.includes("start tracking")) {
                     setIsDrawingMode(true);
                     clearDrawing();
                 }
                 
                 if ((lower.includes("enter") || lower.includes("finish") || lower.includes("done")) && isDrawingMode) {
                     setIsDrawingMode(false);
                     sendDrawingToAgent();
                 }
             }

             if (message.serverContent?.turnComplete) {
                 setIsModelThinking(false);
             }
          },
          onclose: () => setIsConnected(false),
          onerror: (err) => {
            console.error(err);
            setError("Session error.");
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
    } catch (err: any) {
      setError(err.message || "Access denied.");
    }
  };

  const onHandsResults = (results: any) => {
    const overlay = drawingOverlayRef.current;
    const ink = persistentInkRef.current;
    if (!overlay || !ink) return;

    const ctxOverlay = overlay.getContext('2d');
    const ctxInk = ink.getContext('2d');
    if (!ctxOverlay || !ctxInk) return;

    ctxOverlay.clearRect(0, 0, overlay.width, overlay.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        // Render Skeleton
        if (window.drawConnectors && window.drawLandmarks) {
          window.drawConnectors(ctxOverlay, landmarks, window.HAND_CONNECTIONS, {color: '#3b82f6', lineWidth: 3});
          window.drawLandmarks(ctxOverlay, landmarks, {color: '#60a5fa', lineWidth: 1, radius: 4});
        }

        const indexTip = landmarks[8]; 
        const x = indexTip.x * overlay.width;
        const y = indexTip.y * overlay.height;

        // Interactive Cursor
        ctxOverlay.beginPath();
        ctxOverlay.arc(x, y, 8, 0, 2 * Math.PI);
        ctxOverlay.fillStyle = isDrawingMode ? '#22c55e' : '#3b82f6';
        ctxOverlay.fill();
        ctxOverlay.strokeStyle = 'white';
        ctxOverlay.lineWidth = 2;
        ctxOverlay.stroke();

        if (isDrawingMode) {
          if (lastPointRef.current) {
            ctxInk.beginPath();
            ctxInk.moveTo(lastPointRef.current.x, lastPointRef.current.y);
            ctxInk.lineTo(x, y);
            ctxInk.strokeStyle = '#22c55e';
            ctxInk.lineWidth = 6;
            ctxInk.lineCap = 'round';
            ctxInk.shadowBlur = 10;
            ctxInk.shadowColor = '#22c55e';
            ctxInk.stroke();
          }
          lastPointRef.current = { x, y };
        } else {
          lastPointRef.current = null;
        }
      }
    } else {
      lastPointRef.current = null;
    }
  };

  const clearDrawing = () => {
    const ink = persistentInkRef.current;
    if (ink) ink.getContext('2d')?.clearRect(0, 0, ink.width, ink.height);
  };

  const sendDrawingToAgent = () => {
    if (!persistentInkRef.current || !videoRef.current) return;
    setIsAnalyzing(true);
    setIsModelThinking(true);
    
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 640;
    finalCanvas.height = 480;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 640, 480);
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    ctx.drawImage(persistentInkRef.current, 0, 0, 640, 480);

    const base64Data = finalCanvas.toDataURL('image/jpeg', 0.95).split(',')[1];

    sessionPromiseRef.current?.then(session => {
        session.sendRealtimeInput({
            media: { mimeType: 'image/jpeg', data: base64Data }
        });
        setTimeout(() => setIsAnalyzing(false), 2000);
    });
  };

  const startAudioStreaming = (stream: MediaStream) => {
    const ctx = inputAudioContextRef.current;
    if (!ctx) return;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    audioProcessorRef.current = processor;
    processor.onaudioprocess = (e) => {
        if (!isMicOn) return; 
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        const base64 = uint8ArrayToBase64(new Uint8Array(pcmData.buffer));
        sessionPromiseRef.current?.then(session => {
            session.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: base64 } });
        });
    };
    source.connect(processor);
    processor.connect(ctx.destination);
  };

  const startProcessingLoop = () => {
    const loop = async () => {
        if (videoRef.current && handsRef.current && isVideoOn) {
             if (videoRef.current.readyState >= 2) {
                 await handsRef.current.send({image: videoRef.current});
             }
        }
        animationFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    const streamInterval = window.setInterval(() => {
        if (isVideoOn && videoRef.current && canvasRef.current && persistentInkRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                ctx.globalAlpha = 0.4;
                ctx.drawImage(persistentInkRef.current, 0, 0, 320, 240);
                ctx.globalAlpha = 1.0;
                const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.3).split(',')[1];
                sessionPromiseRef.current?.then(session => {
                    session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64Data } });
                });
            }
        }
    }, 4000); 
    window.streamIntervalId = streamInterval;
  };

  const switchCamera = async () => {
    if (remoteStream) {
        setUseRemoteCamera(!useRemoteCamera);
    } else {
        const newMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newMode);
        try {
            if (activeVideoStreamRef.current) activeVideoStreamRef.current.getTracks().forEach(t => t.stop());
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newMode, width: 640, height: 480 } });
            activeVideoStreamRef.current = s;
            if (videoRef.current) videoRef.current.srcObject = s;
        } catch (e) { console.error(e); }
    }
  };

  const playAudioChunk = async (base64Audio: string) => {
      const ctx = outputAudioContextRef.current;
      if (!ctx) return;
      const byteData = base64ToUint8Array(base64Audio);
      const dataInt16 = new Int16Array(byteData.buffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      if (nextStartTimeRef.current < ctx.currentTime) nextStartTimeRef.current = ctx.currentTime;
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center font-sans overflow-hidden">
       <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-40">
          <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
              <div className="flex flex-col">
                  <span className="text-white font-black text-xs tracking-widest uppercase">
                      {isConnected ? (isModelThinking ? 'Agent Thinking...' : 'Agent Listening') : 'Connecting...'}
                  </span>
                  {lastTranscript && (
                      <span className="text-[10px] text-slate-300 max-w-[240px] truncate italic">
                          "{lastTranscript}"
                      </span>
                  )}
              </div>
          </div>
          <div className="flex items-center gap-2">
              <button onClick={onTransfer} className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-white/10 flex items-center gap-2">
                <Smartphone size={14} />
                <span>Mobile Cam</span>
              </button>
              <button onClick={onClose} className="p-2 bg-red-600/20 hover:bg-red-600 text-white rounded-full transition-colors">
                  <X size={24} />
              </button>
          </div>
       </div>

       <div className="relative w-full h-full bg-black flex items-center justify-center">
          <video ref={videoRef} muted playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isVideoOn ? 'opacity-40' : 'opacity-0'}`} />
          <canvas ref={persistentInkRef} width={640} height={480} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10" />
          <canvas ref={drawingOverlayRef} width={640} height={480} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
          
          {isDrawingMode && (
              <div className="absolute top-24 px-6 py-2 bg-emerald-600 text-white text-xs font-black rounded-full border border-emerald-400 shadow-[0_0_20px_rgba(34,197,94,0.6)] animate-pulse z-30 flex items-center gap-2 uppercase tracking-widest">
                  <Sparkles size={16} />
                  Recording Math Trajectory
              </div>
          )}

          {isAnalyzing && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50 backdrop-blur-md animate-in fade-in duration-500">
                  <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mb-4" />
                  <p className="text-white font-black tracking-widest uppercase text-lg">Consulting Neural Core...</p>
              </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" width={320} height={240} />
          {error && <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-[60]"><p className="text-red-500 font-bold">{error}</p></div>}
       </div>

       <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 p-5 bg-slate-900/90 backdrop-blur-2xl rounded-full border border-slate-700 shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-40">
          <button onClick={() => setIsMicOn(!isMicOn)} className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-slate-800 text-slate-300' : 'bg-red-600 text-white shadow-lg shadow-red-900/40'}`}>
              {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          <button 
            onClick={() => { if (isDrawingMode) { setIsDrawingMode(false); sendDrawingToAgent(); } else { setIsDrawingMode(true); clearDrawing(); } }}
            className={`p-6 rounded-full transition-all ${isDrawingMode ? 'bg-emerald-600 text-white scale-125 shadow-[0_0_25px_rgba(34,197,94,0.8)]' : 'bg-slate-700 text-slate-400'}`}
          >
              <Fingerprint size={32} />
          </button>
          <button onClick={() => setIsVideoOn(!isVideoOn)} className={`p-4 rounded-full transition-all ${isVideoOn ? 'bg-slate-800 text-slate-300' : 'bg-red-600 text-white shadow-lg shadow-red-900/40'}`}>
              {isVideoOn ? <VideoIcon size={24} /> : <VideoOff size={24} />}
          </button>
          <button onClick={switchCamera} className={`p-4 rounded-full border transition-all ${useRemoteCamera ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-900/40' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
              {useRemoteCamera ? <Smartphone size={24} /> : <SwitchCamera size={24} />}
          </button>
       </div>
    </div>
  );
};

export default LiveSession;
