
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { X, Mic, MicOff, Video as VideoIcon, VideoOff, SwitchCamera, Smartphone, Fingerprint, Loader2, Sparkles, Zap } from 'lucide-react';
import { SYSTEM_PROMPT } from '../constants';
import { YoloDetection, YoloDetector } from '../services/yoloService';

interface LiveSessionProps {
  onClose: () => void;
  onTransfer: () => void;
  remoteStream: MediaStream | null;
}

// --- Audio Encoding/Decoding ---
function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
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
  const [isThinking, setIsThinking] = useState(false);
  const [yoloStatus, setYoloStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [useRemoteCamera, setUseRemoteCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const drawingOverlayRef = useRef<HTMLCanvasElement>(null); // For real-time tracker
  const persistentInkRef = useRef<HTMLCanvasElement>(null);  // For cumulative drawing
  const yoloOverlayRef = useRef<HTMLCanvasElement>(null); // For object detection boxes
  const contextFrameCanvasRef = useRef<HTMLCanvasElement>(null); // For background API streaming
  
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const activeVideoStreamRef = useRef<MediaStream | null>(null); 

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const contextIntervalRef = useRef<number | null>(null);
  const yoloIntervalRef = useRef<number | null>(null);
  const yoloBusyRef = useRef<boolean>(false);
  const yoloLastSummaryRef = useRef<string>('');
  
  const handsRef = useRef<any>(null);
  const lastPointRef = useRef<{x: number, y: number} | null>(null);
  const yoloDetectorRef = useRef<YoloDetector | null>(null);

  useEffect(() => {
    initMediaPipe();
    startSession();
    return () => cleanup();
  }, []);

  // Update canvas sizes when video starts playing
  const syncCanvasDimensions = () => {
    const video = videoRef.current;
    if (!video) return;
    
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    [drawingOverlayRef.current, persistentInkRef.current, yoloOverlayRef.current].forEach(canvas => {
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
      }
    });
  };

  useEffect(() => {
    if (useRemoteCamera && remoteStream && videoRef.current) {
        activeVideoStreamRef.current = remoteStream;
        videoRef.current.srcObject = remoteStream;
        videoRef.current.onloadedmetadata = syncCanvasDimensions;
        videoRef.current.play().catch(console.error);
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
    if (contextIntervalRef.current) clearInterval(contextIntervalRef.current);
    if (yoloIntervalRef.current) clearInterval(yoloIntervalRef.current);
    if (localAudioStreamRef.current) localAudioStreamRef.current.getTracks().forEach(t => t.stop());
    if (!useRemoteCamera && activeVideoStreamRef.current) {
        activeVideoStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    if (handsRef.current) handsRef.current.close();
    
    sessionPromiseRef.current?.then(session => session.close && session.close());
  };

  const getApiKey = () => {
    return process.env.API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  };

  const startSession = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError("API Key required (not found in process.env or import.meta.env)");
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localAudioStreamRef.current = audioStream;

      const videoStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: facingMode } 
      });
      activeVideoStreamRef.current = videoStream;

      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.onloadedmetadata = syncCanvasDimensions;
        videoRef.current.play();
      }

      try {
        const detector = new YoloDetector();
        await detector.init();
        yoloDetectorRef.current = detector;
        setYoloStatus('ready');
      } catch (yoloErr) {
        console.error('YOLO model initialization failed.', yoloErr);
        setYoloStatus('error');
      }

      const connectWithModel = (modelName: string) => {
        return ai.live.connect({
          model: modelName,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: { model: "google-speech-v1" },
            systemInstruction: SYSTEM_PROMPT + "\n\nACT AS A LIVE MATH TUTOR. \n\nVoice Commands:\n- 'Observe' or 'Draw': Resets the air-sketch ink.\n- 'Enter' or 'Submit': Sends the air-sketch equation for solving.\n\nYou are receiving image parts that contain video frames with neon green ink overlays. Focus on the green ink to understand what the user is drawing.",
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
              const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData) {
                  setIsThinking(false);
                  await playAudioChunk(audioData);
              }

              const transcript = message.serverContent?.inputTranscription?.text;
              if (transcript) {
                  const lower = transcript.toLowerCase();
                  setLastTranscript(transcript);
                  
                  if (lower.includes("observe") || lower.includes("draw") || lower.includes("track")) {
                      setIsDrawingMode(true);
                      clearDrawing();
                  }
                  
                  if ((lower.includes("enter") || lower.includes("finish") || lower.includes("submit") || lower.includes("done")) && isDrawingMode) {
                      setIsDrawingMode(false);
                      sendDrawingToAgent();
                  }
              }

              if (message.serverContent?.turnComplete) setIsThinking(false);
            },
            onclose: () => setIsConnected(false),
            onerror: (err) => { 
              console.error(`Live connection with ${modelName} failed:`, err);
              if (modelName === 'gemini-2.5-flash-native-audio-preview-12-2025') {
                 console.log("Attempting fallback to lite model...");
                 // This doesn't directly trigger a reconnect here easily because connect returns a promise
                 // We rely on the initial catch block to retry.
              } else {
                 setError("Live connection failed permanently.");
              }
            }
          }
        });
      };

      try {
        sessionPromiseRef.current = connectWithModel('gemini-2.5-flash-native-audio-preview-12-2025');
        await sessionPromiseRef.current;
      } catch (err) {
        console.warn("Primary Live Model failed, falling back to lite version...", err);
        // Note: The native audio live API works specifically with native-audio models.
        // Falling back to a standard lite model might not support the live socket protocol exactly.
        // We attempt it as requested, but standard 'lite' models are usually unary/stream, not WebSocket live.
        sessionPromiseRef.current = connectWithModel('gemini-2.5-flash-lite-preview-09-2025');
        await sessionPromiseRef.current;
      }

    } catch (err: any) {
      setError(err.message || "Permissions denied.");
    }
  };

  const onHandsResults = (results: any) => {
    const overlay = drawingOverlayRef.current;
    const ink = persistentInkRef.current;
    if (!overlay || !ink) return;

    const ctxOverlay = overlay.getContext('2d');
    const ctxInk = ink.getContext('2d');
    if (!ctxOverlay || !ctxInk) return;

    // Clear frame-by-frame tracker
    ctxOverlay.clearRect(0, 0, overlay.width, overlay.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        // 1. Draw MediaPipe Skeleton (Always visible)
        if (window.drawConnectors && window.drawLandmarks) {
          window.drawConnectors(ctxOverlay, landmarks, window.HAND_CONNECTIONS, {color: '#3b82f6', lineWidth: 4});
          window.drawLandmarks(ctxOverlay, landmarks, {color: '#ffffff', lineWidth: 1, radius: 3});
        }

        // 2. Index Tip Logic
        const indexTip = landmarks[8]; 
        const x = indexTip.x * overlay.width;
        const y = indexTip.y * overlay.height;

        // Visual Cursor
        ctxOverlay.beginPath();
        ctxOverlay.arc(x, y, 10, 0, 2 * Math.PI);
        ctxOverlay.fillStyle = isDrawingMode ? '#10b981' : '#3b82f6';
        ctxOverlay.fill();
        ctxOverlay.shadowBlur = 15;
        ctxOverlay.shadowColor = isDrawingMode ? '#10b981' : '#3b82f6';
        ctxOverlay.strokeStyle = 'white';
        ctxOverlay.lineWidth = 3;
        ctxOverlay.stroke();

        // 3. Persistent Path Drawing
        if (isDrawingMode) {
          if (lastPointRef.current) {
            ctxInk.beginPath();
            ctxInk.moveTo(lastPointRef.current.x, lastPointRef.current.y);
            ctxInk.lineTo(x, y);
            ctxInk.strokeStyle = '#10b981'; // Neon Emerald
            ctxInk.lineWidth = 8;
            ctxInk.lineCap = 'round';
            ctxInk.lineJoin = 'round';
            ctxInk.shadowBlur = 12;
            ctxInk.shadowColor = '#10b981';
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

  const drawYoloDetections = (detections: YoloDetection[]) => {
    const canvas = yoloOverlayRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!isVideoOn) return;

    detections.forEach((det) => {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.strokeRect(det.x, det.y, det.width, det.height);

      const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = 'bold 14px sans-serif';
      const textWidth = ctx.measureText(label).width;
      const textHeight = 20;

      const x = det.x;
      const y = Math.max(0, det.y - textHeight);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.fillRect(x, y, textWidth + 12, textHeight);

      ctx.fillStyle = '#111827';
      ctx.fillText(label, x + 6, y + 15);
    });
  };

  const formatYoloSummary = (detections: YoloDetection[]) => {
    if (detections.length === 0) return 'No clear objects detected in scene.';
    return detections
      .slice(0, 4)
      .map((det) => `${det.label} (${(det.confidence * 100).toFixed(0)}%)`)
      .join(', ');
  };

  const sendDrawingToAgent = () => {
    if (!persistentInkRef.current || !videoRef.current) return;
    setIsAnalyzing(true);
    setIsThinking(true);
    
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 640;
    finalCanvas.height = 480;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;

    // Snapshot: Video + Emerald Ink
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    ctx.drawImage(persistentInkRef.current, 0, 0, 640, 480);

    const base64Data = finalCanvas.toDataURL('image/jpeg', 0.9).split(',')[1];

    sessionPromiseRef.current?.then(session => {
        session.sendRealtimeInput({
            media: { mimeType: 'image/jpeg', data: base64Data }
        });
        setTimeout(() => setIsAnalyzing(false), 3000);
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

    // Context frame streaming for general vision
    contextIntervalRef.current = window.setInterval(() => {
        if (isVideoOn && videoRef.current && contextFrameCanvasRef.current) {
            const ctx = contextFrameCanvasRef.current.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                const base64 = contextFrameCanvasRef.current.toDataURL('image/jpeg', 0.3).split(',')[1];
                sessionPromiseRef.current?.then(session => {
                    session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64 } });
                });
            }
        }
    }, 5000);

    yoloIntervalRef.current = window.setInterval(async () => {
      if (!isVideoOn || !videoRef.current || videoRef.current.readyState < 2) return;
      if (!yoloDetectorRef.current?.isReady() || yoloBusyRef.current) return;

      yoloBusyRef.current = true;
      try {
        const detections = await yoloDetectorRef.current.detect(videoRef.current, 0.38, 5);
        drawYoloDetections(detections);

        const summary = formatYoloSummary(detections);
        if (summary !== yoloLastSummaryRef.current) {
          yoloLastSummaryRef.current = summary;
          sessionPromiseRef.current?.then((session) => {
            session.sendRealtimeInput({
              text: `YOLO scene context: ${summary}`
            });
          });
        }
      } catch (yoloErr) {
        console.error('YOLO inference failed.', yoloErr);
      } finally {
        yoloBusyRef.current = false;
      }
    }, 1400);
  };

  const switchCamera = async () => {
    if (remoteStream) {
        setUseRemoteCamera(!useRemoteCamera);
    } else {
        const mode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(mode);
        if (activeVideoStreamRef.current) activeVideoStreamRef.current.getTracks().forEach(t => t.stop());
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode, width: 640, height: 480 } });
        activeVideoStreamRef.current = s;
        if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.onloadedmetadata = syncCanvasDimensions;
        }
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
    <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center font-sans overflow-hidden animate-in fade-in duration-300">
       
       {/* UI Header */}
       <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/90 to-transparent z-[110]">
          <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-slate-500'} animate-pulse`} />
              <div className="flex flex-col">
                  <span className="text-white font-black text-xs tracking-tighter uppercase">
                      {isThinking ? 'Analyzing Sketch...' : (isConnected ? 'Math Engine Live' : 'Initializing...')}
                  </span>
                  {lastTranscript && (
                      <span className="text-[10px] text-slate-400 italic">"{lastTranscript}"</span>
                  )}
              </div>
          </div>
          <div className="flex items-center gap-2">
              <button onClick={onTransfer} className="p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-xl border border-white/10 flex items-center gap-2 transition-all">
                <Smartphone size={18} />
              </button>
              <button onClick={onClose} className="p-2 bg-red-600/20 hover:bg-red-600 text-white rounded-full transition-all border border-red-500/20">
                  <X size={24} />
              </button>
          </div>
       </div>

       {/* Camera Viewport */}
       <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
          <video 
            ref={videoRef} 
            muted 
            playsInline 
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isVideoOn ? 'opacity-50' : 'opacity-0'}`} 
          />
          
          {/* Tracker Layer */}
          <canvas 
            ref={drawingOverlayRef} 
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-[105] opacity-80" 
          />
          
          {/* Ink Layer */}
          <canvas 
            ref={persistentInkRef} 
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-[104] filter drop-shadow-[0_0_8px_#10b981]" 
          />

          <canvas
            ref={yoloOverlayRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-[103] opacity-90"
          />
          
          {isDrawingMode && (
              <div className="absolute top-24 px-6 py-2 bg-emerald-600/90 text-white text-[10px] font-black rounded-full border border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.5)] animate-pulse z-[110] flex items-center gap-2 uppercase tracking-widest">
                  <Sparkles size={14} className="animate-spin-slow" />
                  Drawing Mode
              </div>
          )}

          <div className={`absolute top-40 px-4 py-2 text-[10px] font-black rounded-full z-[110] flex items-center gap-2 uppercase tracking-widest border ${
            yoloStatus === 'ready'
              ? 'bg-amber-500/90 text-black border-amber-300'
              : yoloStatus === 'loading'
                ? 'bg-slate-700/90 text-slate-100 border-slate-500'
                : 'bg-red-600/80 text-white border-red-400'
          }`}>
            <Zap size={12} />
            {yoloStatus === 'ready' ? 'YOLO Active' : yoloStatus === 'loading' ? 'YOLO Loading' : 'YOLO Offline'}
          </div>

          {isAnalyzing && (
              <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center z-[120] backdrop-blur-md">
                  <Loader2 className="w-16 h-16 text-emerald-400 animate-spin mb-4" />
                  <p className="text-white font-black tracking-widest uppercase text-sm">Transferring Snapshot...</p>
              </div>
          )}
          
          <canvas ref={contextFrameCanvasRef} className="hidden" width={320} height={240} />
          {error && <div className="absolute inset-0 bg-black/95 flex items-center justify-center z-[130] p-8 text-center text-red-500 font-bold">{error}</div>}
       </div>

       {/* Control Dock */}
       <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 p-5 bg-slate-900/90 backdrop-blur-3xl rounded-full border border-slate-700/50 shadow-[0_40px_80px_rgba(0,0,0,0.8)] z-[110]">
          <button onClick={() => setIsMicOn(!isMicOn)} className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-slate-800 text-slate-300' : 'bg-red-600 text-white shadow-lg'}`}>
              {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          
          <button 
            onClick={() => { if (isDrawingMode) { setIsDrawingMode(false); sendDrawingToAgent(); } else { setIsDrawingMode(true); clearDrawing(); } }}
            className={`p-6 rounded-full transition-all transform ${isDrawingMode ? 'bg-emerald-600 text-white scale-110 shadow-[0_0_30px_#10b981]' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
            title={isDrawingMode ? "Submit Drawing" : "Start Drawing"}
          >
              <Fingerprint size={32} />
          </button>

          <button onClick={() => setIsVideoOn(!isVideoOn)} className={`p-4 rounded-full transition-all ${isVideoOn ? 'bg-slate-800 text-slate-300' : 'bg-red-600 text-white'}`}>
              {isVideoOn ? <VideoIcon size={24} /> : <VideoOff size={24} />}
          </button>

          <button onClick={switchCamera} className={`p-4 rounded-full border transition-all ${useRemoteCamera ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
              {useRemoteCamera ? <Smartphone size={24} /> : <SwitchCamera size={24} />}
          </button>
       </div>
    </div>
  );
};

export default LiveSession;
