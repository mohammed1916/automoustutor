
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { X, Mic, MicOff, Video as VideoIcon, VideoOff, SwitchCamera, Smartphone, Fingerprint, Eraser, Loader2 } from 'lucide-react';
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
    // Fix: Add missing property to Window interface
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
  
  // Camera facing mode state
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [useRemoteCamera, setUseRemoteCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // For sending raw video frames
  const drawingOverlayRef = useRef<HTMLCanvasElement>(null); // For real-time skeleton/feedback
  const persistentInkRef = useRef<HTMLCanvasElement>(null); // For the actual math drawing
  
  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  // Stream & Session Refs
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const activeVideoStreamRef = useRef<MediaStream | null>(null); 

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  
  // Timing & Loops
  const nextStartTimeRef = useRef<number>(0);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // MediaPipe Refs
  const handsRef = useRef<any>(null);
  const lastPointRef = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    initMediaPipe();
    startSession();

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (useRemoteCamera && remoteStream && videoRef.current) {
        activeVideoStreamRef.current = remoteStream;
        videoRef.current.srcObject = remoteStream;
        videoRef.current.play().catch(e => console.error("Remote play error", e));
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
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6
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
      // Fix: Use process.env.API_KEY directly as per guidelines
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
          systemInstruction: SYSTEM_PROMPT + "\n\nACT AS A LIVE MATH TUTOR. The user is drawing equations in the air with their finger. \n\nWhen you hear 'Observe this drawing' or 'Analyzing', prepare to receive an image part shortly after. \n\nAnalyze the trajectory captured in the image to extract math problems, graphs, or equations. Provide immediate audio feedback.",
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
             if (base64Audio) await playAudioChunk(base64Audio);

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
          },
          onclose: () => setIsConnected(false),
          onerror: (err) => {
            console.error(err);
            setError("Connection error.");
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

    // Clear frame overlay (skeleton)
    ctxOverlay.clearRect(0, 0, overlay.width, overlay.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        // Draw Skeleton using MediaPipe utils
        if (window.drawConnectors && window.drawLandmarks) {
          window.drawConnectors(ctxOverlay, landmarks, window.HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
          window.drawLandmarks(ctxOverlay, landmarks, {color: '#FF0000', lineWidth: 1, radius: 2});
        }

        const indexTip = landmarks[8]; 
        const x = indexTip.x * overlay.width;
        const y = indexTip.y * overlay.height;

        // Draw Feedback Cursor
        ctxOverlay.beginPath();
        ctxOverlay.arc(x, y, 6, 0, 2 * Math.PI);
        ctxOverlay.fillStyle = isDrawingMode ? '#00FF00' : 'white';
        ctxOverlay.fill();
        ctxOverlay.strokeStyle = 'black';
        ctxOverlay.lineWidth = 2;
        ctxOverlay.stroke();

        if (isDrawingMode) {
          if (lastPointRef.current) {
            ctxInk.beginPath();
            ctxInk.moveTo(lastPointRef.current.x, lastPointRef.current.y);
            ctxInk.lineTo(x, y);
            ctxInk.strokeStyle = '#00FF00';
            ctxInk.lineWidth = 5;
            ctxInk.lineCap = 'round';
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
    if (ink) {
      const ctx = ink.getContext('2d');
      ctx?.clearRect(0, 0, ink.width, ink.height);
    }
  };

  const sendDrawingToAgent = () => {
    if (!persistentInkRef.current || !videoRef.current) return;
    setIsAnalyzing(true);
    
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 640;
    finalCanvas.height = 480;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;

    // Composite: Black Background + Video + Neon Ink
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 640, 480);
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(persistentInkRef.current, 0, 0, 640, 480);
    ctx.globalAlpha = 1.0;

    const base64Data = finalCanvas.toDataURL('image/jpeg', 0.9).split(',')[1];

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
                ctx.globalAlpha = 0.5;
                ctx.drawImage(persistentInkRef.current, 0, 0, 320, 240);
                ctx.globalAlpha = 1.0;
                const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.4).split(',')[1];
                sessionPromiseRef.current?.then(session => {
                    session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64Data } });
                });
            }
        }
    }, 2000); // Send low-res context frames less frequently
    // Fix: access window.streamIntervalId after adding it to interface
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
       
       <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-20">
          <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-slate-500'}`} />
              <div className="flex flex-col">
                  <span className="text-white font-black text-sm tracking-widest uppercase">
                      {isConnected ? 'Math Agent' : 'Connecting...'}
                  </span>
                  {lastTranscript && (
                      <span className="text-[10px] text-slate-400 max-w-[240px] truncate italic">
                          "{lastTranscript}"
                      </span>
                  )}
              </div>
          </div>
          
          <div className="flex items-center gap-2">
              <button onClick={onTransfer} className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold border border-white/10 flex items-center gap-2">
                <Smartphone size={14} />
                <span>Mobile Link</span>
              </button>
              <button onClick={onClose} className="p-2 bg-black/40 hover:bg-red-900/80 rounded-full text-white border border-white/10">
                  <X size={24} />
              </button>
          </div>
       </div>

       <div className="relative w-full h-full bg-black flex items-center justify-center">
          <video ref={videoRef} muted playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isVideoOn ? 'opacity-60' : 'opacity-0'}`} />
          
          {/* Layered Canvases */}
          <canvas ref={persistentInkRef} width={640} height={480} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10 filter drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
          <canvas ref={drawingOverlayRef} width={640} height={480} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-20 opacity-80" />
          
          {/* Status UI */}
          {isDrawingMode && (
              <div className="absolute top-24 px-5 py-2.5 bg-green-900/90 text-green-200 text-sm font-black rounded-full border border-green-500/50 shadow-2xl animate-pulse z-30 flex items-center gap-2 uppercase tracking-tighter">
                  <Fingerprint size={18} className="animate-spin-slow" />
                  Recording Path...
              </div>
          )}

          {isAnalyzing && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center z-40 backdrop-blur-sm animate-in fade-in duration-300">
                  <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
                  <p className="text-white font-bold tracking-widest uppercase text-sm">Consulting Agent...</p>
              </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" width={320} height={240} />
          
          {error && (
              <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
                  <div className="bg-red-900/20 border border-red-500 p-8 rounded-3xl text-center shadow-2xl max-w-sm">
                      <p className="text-red-100 font-bold mb-6">{error}</p>
                      <button onClick={onClose} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl uppercase tracking-widest">
                          Dismiss
                      </button>
                  </div>
              </div>
          )}
       </div>

       <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-5 p-4 bg-slate-900/90 backdrop-blur-xl rounded-full border border-slate-700 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-30">
          <button onClick={() => setIsMicOn(!isMicOn)} className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-slate-800 text-white' : 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'}`}>
              {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
          </button>
          
          <button 
            onClick={() => {
                if (isDrawingMode) {
                    setIsDrawingMode(false);
                    sendDrawingToAgent();
                } else {
                    setIsDrawingMode(true);
                    clearDrawing();
                }
            }}
            className={`p-5 rounded-full transition-all ${isDrawingMode ? 'bg-green-600 text-white scale-110 shadow-[0_0_20px_rgba(34,197,94,0.6)]' : 'bg-slate-700 text-slate-400'}`}
            title={isDrawingMode ? "Submit" : "Draw"}
          >
              <Fingerprint size={28} />
          </button>

          <button onClick={onClose} className="p-4 bg-red-600 text-white rounded-full hover:scale-105 transition-transform shadow-lg">
             <X size={24} />
          </button>

          <button onClick={() => setIsVideoOn(!isVideoOn)} className={`p-4 rounded-full transition-all ${isVideoOn ? 'bg-slate-800 text-white' : 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'}`}>
              {isVideoOn ? <VideoIcon size={22} /> : <VideoOff size={22} />}
          </button>

          <button onClick={switchCamera} className={`p-4 rounded-full border transition-all ${useRemoteCamera ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
              {useRemoteCamera ? <Smartphone size={22} /> : <SwitchCamera size={22} />}
          </button>
       </div>
    </div>
  );
};

export default LiveSession;
