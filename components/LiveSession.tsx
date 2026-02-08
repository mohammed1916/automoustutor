import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { X, Mic, MicOff, Video as VideoIcon, VideoOff, SwitchCamera, Smartphone, Fingerprint, Eraser } from 'lucide-react';
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
  }
}

const LiveSession: React.FC<LiveSessionProps> = ({ onClose, onTransfer, remoteStream }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>("");
  
  // Camera facing mode state
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [useRemoteCamera, setUseRemoteCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // For sending video frames
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null); // For overlay drawing
  
  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  // Stream & Session Refs
  // We keep audio and video streams separate to allow mixing (e.g., Local Mic + Remote Video)
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const activeVideoStreamRef = useRef<MediaStream | null>(null); // Can be local or remote

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

  // Watch for remote stream changes
  useEffect(() => {
    if (useRemoteCamera && remoteStream && videoRef.current) {
        activeVideoStreamRef.current = remoteStream;
        videoRef.current.srcObject = remoteStream;
        videoRef.current.play().catch(e => console.error("Remote play error", e));
    } else if (!useRemoteCamera && activeVideoStreamRef.current && videoRef.current) {
        // Ensure we revert to local if user toggles off
        // This is handled by switchSource logic, but this safety check helps
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
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      hands.onResults(onHandsResults);
      handsRef.current = hands;
    }
  };

  const cleanup = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioProcessorRef.current) audioProcessorRef.current.disconnect();
    
    // Stop local tracks
    if (localAudioStreamRef.current) localAudioStreamRef.current.getTracks().forEach(track => track.stop());
    
    // Only stop video if it's local. Don't kill the remote stream as it belongs to App state
    if (!useRemoteCamera && activeVideoStreamRef.current) {
        activeVideoStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    if (handsRef.current) handsRef.current.close();
    
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

      // 1. Get Audio (Always Local)
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localAudioStreamRef.current = audioStream;

      // 2. Get Video (Default Local)
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
          inputAudioTranscription: { model: "google-speech-v1" }, // Enable input transcription
          systemInstruction: SYSTEM_PROMPT + "\n\nIMPORTANT: You are in a LIVE VIDEO session with MediaPipe hand tracking. If the user draws something, analyze the drawing. If the user asks to 'Observe this drawing', wait for them to say 'Enter' before analyzing.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        },
        callbacks: {
          onopen: () => {
            console.log("Live Session Connected");
            setIsConnected(true);
            startAudioStreaming(audioStream); // Use local audio
            startProcessingLoop(); // Loops over whatever video is active
          },
          onmessage: async (message: LiveServerMessage) => {
             // 1. Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio) {
                 await playAudioChunk(base64Audio);
             }

             // 2. Command Recognition from Input Transcription
             const transcript = message.serverContent?.inputTranscription?.text;
             if (transcript) {
                 const lower = transcript.toLowerCase();
                 setLastTranscript(transcript);
                 
                 // "Observe this drawing" -> Enable Drawing Mode
                 if (lower.includes("observe this drawing") || lower.includes("start drawing") || lower.includes("tracking mode")) {
                     setIsDrawingMode(true);
                     clearDrawing();
                 }
                 
                 // "Enter" / "Finish" -> Disable Drawing & Analyze
                 if ((lower.includes("enter") || lower.includes("finish") || lower.includes("analyze")) && isDrawingMode) {
                     setIsDrawingMode(false);
                     sendDrawingToAgent();
                 }
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

  // --- Hand Tracking Logic ---

  const onHandsResults = (results: any) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const indexTip = landmarks[8]; // Index Finger Tip

      if (isDrawingMode) {
        const x = indexTip.x * canvas.width;
        const y = indexTip.y * canvas.height;

        if (lastPointRef.current) {
          ctx.beginPath();
          ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
          ctx.lineTo(x, y);
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        lastPointRef.current = { x, y };
      } else {
        lastPointRef.current = null;
      }
    } else {
      lastPointRef.current = null;
    }
  };

  const clearDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const sendDrawingToAgent = () => {
    if (!drawingCanvasRef.current) return;
    
    // Create a composite image: Video Frame + Drawing
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = 640;
    finalCanvas.height = 480;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx || !videoRef.current) return;

    // Draw Video
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    // Draw Overlay
    ctx.drawImage(drawingCanvasRef.current, 0, 0, 640, 480);

    const base64Data = finalCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    sessionPromiseRef.current?.then(session => {
        session.sendRealtimeInput({
            media: {
                mimeType: 'image/jpeg',
                data: base64Data
            }
        });
    });
  };

  // --- Streaming Loops ---

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

  const startProcessingLoop = () => {
    const loop = async () => {
        if (!isVideoOn || !videoRef.current || !canvasRef.current || !drawingCanvasRef.current) {
            animationFrameRef.current = requestAnimationFrame(loop);
            return;
        }

        const video = videoRef.current;
        
        // 1. Send to MediaPipe
        // Note: When remote stream is active, video.readyState is still valid
        if (handsRef.current && video.readyState >= 2) {
             await handsRef.current.send({image: video});
        }

        animationFrameRef.current = requestAnimationFrame(loop);
    };
    
    loop();

    // Separate low-fps stream loop for general context
    const streamInterval = window.setInterval(() => {
        if (isVideoOn && videoRef.current && canvasRef.current && drawingCanvasRef.current) {
            const canvas = canvasRef.current;
            const overlay = drawingCanvasRef.current;
            const video = videoRef.current;
            
            canvas.width = 320;
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Composite for stream
                ctx.drawImage(video, 0, 0, 320, 240);
                ctx.drawImage(overlay, 0, 0, 320, 240); // Include drawing in stream
                
                const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                sessionPromiseRef.current?.then(session => {
                    session.sendRealtimeInput({
                        media: { mimeType: 'image/jpeg', data: base64Data }
                    });
                });
            }
        }
    }, 1000); 

    (window as any).streamIntervalId = streamInterval;
  };

  const switchCamera = async () => {
    // If we have a remote stream, we toggle between that and local
    if (remoteStream) {
        if (useRemoteCamera) {
            // Switch back to local
            setUseRemoteCamera(false);
            try {
                const newStream = await navigator.mediaDevices.getUserMedia({
                     video: { facingMode: 'user', width: 640, height: 480 }
                });
                activeVideoStreamRef.current = newStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = newStream;
                    videoRef.current.play();
                }
            } catch (e) {
                console.error("Error reverting to local camera", e);
            }
        } else {
            // Switch to remote
            setUseRemoteCamera(true);
            activeVideoStreamRef.current = remoteStream;
            if (videoRef.current) {
                videoRef.current.srcObject = remoteStream;
                videoRef.current.play();
            }
        }
    } else {
        // Standard local switch (User <-> Env)
        const newMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newMode);
        try {
            // Stop old local if it exists
            if (activeVideoStreamRef.current) activeVideoStreamRef.current.getVideoTracks().forEach(t => t.stop());
            
            const newStream = await navigator.mediaDevices.getUserMedia({
                 video: { facingMode: newMode, width: 640, height: 480 }
            });
            activeVideoStreamRef.current = newStream;
            if (videoRef.current) {
                 videoRef.current.srcObject = newStream;
                 videoRef.current.play();
            }
        } catch (e) {
            console.error("Error switching local camera", e);
        }
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

  return (
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
       
       {/* Header */}
       <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
          <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
              <div className="flex flex-col">
                  <span className="text-white font-bold text-sm tracking-widest uppercase">
                      {isConnected ? 'Live Agent' : 'Connecting...'}
                  </span>
                  {lastTranscript && (
                      <span className="text-[10px] text-slate-400 max-w-[200px] truncate">
                          "{lastTranscript}"
                      </span>
                  )}
              </div>
          </div>
          
          <div className="flex items-center gap-2">
              <button onClick={onTransfer} className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-white/10">
                <Smartphone size={16} />
                <span>Transfer</span>
              </button>
              <button onClick={onClose} className="p-2 bg-black/40 hover:bg-red-900/80 rounded-full text-white border border-white/10">
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
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${isVideoOn ? 'opacity-100' : 'opacity-0'}`}
          />
          
          {/* Drawing Overlay Canvas */}
          <canvas 
            ref={drawingCanvasRef}
            width={640}
            height={480}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />

          {isDrawingMode && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-900/80 text-green-200 text-sm font-bold rounded-full border border-green-500/50 flex items-center gap-2 animate-bounce">
                  <Fingerprint size={16} />
                  Drawing Mode Active
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
            onClick={() => setIsMicOn(!isMicOn)}
            className={`p-3 sm:p-4 rounded-full transition-all ${isMicOn ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-600 text-white hover:bg-red-500'}`}
          >
              {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          
          {/* Manual Drawing Toggle */}
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
            className={`p-3 sm:p-4 rounded-full transition-all ${isDrawingMode ? 'bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 'bg-slate-700 text-slate-300 hover:text-white'}`}
            title={isDrawingMode ? "Finish & Send" : "Start Drawing"}
          >
              <Fingerprint size={24} />
          </button>

          <button 
             onClick={onClose}
             className="px-6 py-3 sm:px-8 sm:py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full shadow-lg flex items-center gap-2"
          >
             <X size={20} />
          </button>

          <button 
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`p-3 sm:p-4 rounded-full transition-all ${isVideoOn ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-600 text-white hover:bg-red-500'}`}
          >
              {isVideoOn ? <VideoIcon size={24} /> : <VideoOff size={24} />}
          </button>

          <button 
            onClick={switchCamera}
            className={`p-3 sm:p-4 rounded-full border transition-all ${useRemoteCamera ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:text-white'}`}
            title={remoteStream ? "Switch to Mobile Camera" : "Switch Camera"}
          >
              {useRemoteCamera ? <Smartphone size={24} /> : <SwitchCamera size={24} />}
          </button>
       </div>

    </div>
  );
};

export default LiveSession;