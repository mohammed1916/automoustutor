import React, { useEffect, useRef, useState } from 'react';
import { Message } from '../types';
import { Send, User, Bot, Loader2, PenTool, Image as ImageIcon, Paperclip, X, FileText, UploadCloud, Mic, Square, Video, Smartphone, Radio } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Mermaid from './Mermaid';
import FunctionPlot from './FunctionPlot';
import DrawingPad from './DrawingPad';

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string, attachment?: string) => void;
  onStartSession?: () => void;
  onStartLiveSession?: () => void;
  remoteStream?: MediaStream | null;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, onSendMessage, onStartSession, onStartLiveSession, remoteStream }) => {
  const [inputValue, setInputValue] = useState('');
  const [showDrawingPad, setShowDrawingPad] = useState(false);
  
  // Media States
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Camera/Video State
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [useRemoteCamera, setUseRemoteCamera] = useState(false);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);

  const timerIntervalRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, showDrawingPad, pendingAttachment, showCamera]);

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Handle video stream assignment
  useEffect(() => {
    if (showCamera && videoRef.current) {
        if (useRemoteCamera && remoteStream) {
            videoRef.current.srcObject = remoteStream;
        } else if (cameraStream) {
            videoRef.current.srcObject = cameraStream;
        }
    }
  }, [showCamera, cameraStream, remoteStream, useRemoteCamera]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((inputValue.trim() || pendingAttachment) && !isLoading) {
      onSendMessage(inputValue, pendingAttachment || undefined);
      setInputValue('');
      setPendingAttachment(null);
    }
  };

  const handleDrawingSubmit = (imageBase64: string) => {
      setPendingAttachment(imageBase64);
      setShowDrawingPad(false);
  };

  // --- FILE HANDLING ---
  const processFile = (file: File) => {
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
        alert("File size exceeds 20MB limit for direct uploads. Please upload a shorter clip or compress the video.");
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPendingAttachment(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
            const file = items[i].getAsFile();
            if (file) {
                processFile(file);
                e.preventDefault();
                return;
            }
        }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
  };

  // --- AUDIO RECORDING ---
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Audio recording is not supported in this browser.");
        return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
            setPendingAttachment(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure a microphone is connected and permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- CAMERA & VIDEO RECORDING ---
  const startCamera = async () => {
      if (remoteStream && !useRemoteCamera) {
          // If remote is available, default to it? Or ask?
          // For now, let's just initialize local if not explicitly switched
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (!remoteStream) {
             alert("Camera access is not supported in this browser.");
             return;
          }
      }

      if (!useRemoteCamera) {
        try {
            const constraints: MediaStreamConstraints = {
                video: { facingMode: 'environment' },
                audio: true
            };
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            }
            setCameraStream(stream);
        } catch (err) {
            console.error("Error accessing local camera:", err);
            if (!remoteStream) {
               alert("Could not access local camera.");
               return;
            }
        }
      }
      
      setShowCamera(true);
  };

  const stopCameraStream = () => {
      if (videoRecorderRef.current && videoRecorderRef.current.state === 'recording') {
          videoRecorderRef.current.onstop = null;
          videoRecorderRef.current.stop();
      }
      setIsRecordingVideo(false);

      if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
      }
      setShowCamera(false);
  };

  const startVideoRecording = () => {
      const activeStream = useRemoteCamera ? remoteStream : cameraStream;
      if (!activeStream) return;
      
      try {
          // Note: If remote stream has no audio, recording might lack audio unless we mix it in.
          // For simplicity, we record whatever tracks are on the stream.
          const mediaRecorder = new MediaRecorder(activeStream);
          videoRecorderRef.current = mediaRecorder;
          videoChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  videoChunksRef.current.push(event.data);
              }
          };

          mediaRecorder.onstop = () => {
              const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
              const reader = new FileReader();
              reader.onloadend = () => {
                  setPendingAttachment(reader.result as string);
              };
              reader.readAsDataURL(blob);
              stopCameraStream(); 
          };

          mediaRecorder.start();
          setIsRecordingVideo(true);
      } catch (e) {
          console.error("Failed to start video recorder", e);
          alert("Failed to start video recording. Stream might be incompatible.");
      }
  };

  const stopVideoRecording = () => {
      if (videoRecorderRef.current && isRecordingVideo) {
          videoRecorderRef.current.stop();
          setIsRecordingVideo(false);
      }
  };
  
  const takeSnapshot = () => {
      if (videoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0);
              const dataUrl = canvas.toDataURL('image/jpeg');
              setPendingAttachment(dataUrl);
              stopCameraStream();
          }
      }
  };

  // --- RENDER HELPERS ---

  const renderAttachmentPreview = () => {
      if (!pendingAttachment) return null;
      
      const isImage = pendingAttachment.startsWith('data:image');
      const isAudio = pendingAttachment.startsWith('data:audio');
      const isVideo = pendingAttachment.startsWith('data:video');
      
      return (
          <div className="mx-4 mb-2 p-3 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-between max-w-md animate-fade-in relative group">
              <div className="flex items-center gap-3 overflow-hidden">
                  {isImage ? (
                      <div className="w-10 h-10 rounded bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-600">
                          <img src={pendingAttachment} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                  ) : isAudio ? (
                      <div className="w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center flex-shrink-0 border border-red-500/30">
                          <Mic className="text-red-400 w-5 h-5" />
                      </div>
                  ) : isVideo ? (
                      <div className="w-10 h-10 rounded bg-indigo-900/30 flex items-center justify-center flex-shrink-0 border border-indigo-500/30">
                          <Video className="text-indigo-400 w-5 h-5" />
                      </div>
                  ) : (
                      <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-600">
                          <FileText className="text-cyan-400 w-5 h-5" />
                      </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">
                        {isImage ? 'Image' : isAudio ? 'Audio Clip' : isVideo ? 'Video Clip' : 'Document'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                         {isVideo ? 'Ready to analyze' : 'Ready to send'}
                    </span>
                  </div>
              </div>
              <button 
                  type="button"
                  onClick={() => setPendingAttachment(null)}
                  className="p-1.5 hover:bg-slate-700 rounded-full text-slate-400 hover:text-red-400 transition-colors"
              >
                  <X size={16} />
              </button>
          </div>
      );
  };

  return (
    <div 
        className="flex flex-col h-full bg-slate-950 text-slate-100 relative"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm border-2 border-dashed border-cyan-500 m-4 rounded-xl flex flex-col items-center justify-center pointer-events-none">
              <UploadCloud className="w-16 h-16 text-cyan-400 mb-4 animate-bounce" />
              <h3 className="text-xl font-bold text-slate-200">Drop to Attach</h3>
          </div>
      )}

      {/* Camera Overlay */}
      {showCamera && (
          <div className="absolute inset-0 z-[60] bg-black flex flex-col">
              <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="max-w-full max-h-full object-contain"
                    onLoadedMetadata={() => videoRef.current?.play()}
                    muted={useRemoteCamera} // Mute remote to prevent echo if both active
                  />
                  {isRecordingVideo && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-900/80 px-3 py-1 rounded-full animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-xs font-bold text-white">REC</span>
                    </div>
                  )}
                  
                  {/* Camera Source Switcher */}
                  {remoteStream && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur rounded-full p-1 flex items-center border border-slate-700">
                          <button 
                             onClick={() => setUseRemoteCamera(false)}
                             className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${!useRemoteCamera ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                          >
                              Local
                          </button>
                          <button 
                             onClick={() => setUseRemoteCamera(true)}
                             className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${useRemoteCamera ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                          >
                              <Smartphone size={12} />
                              Mobile
                          </button>
                      </div>
                  )}

                  <div className="absolute top-4 right-4">
                      <button onClick={stopCameraStream} className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70">
                          <X size={24} />
                      </button>
                  </div>
              </div>
              
              <div className="h-24 bg-slate-900 flex items-center justify-center gap-8">
                  {/* Snapshot Button (Always available) */}
                  {!isRecordingVideo && (
                      <button onClick={takeSnapshot} className="w-12 h-12 rounded-full border-2 border-white bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all" title="Take Snapshot">
                          <div className="w-10 h-10 rounded-full bg-white" />
                      </button>
                  )}

                  {isRecordingVideo ? (
                      <button onClick={stopVideoRecording} className="w-16 h-16 rounded-full border-4 border-red-500 bg-red-500 flex items-center justify-center hover:scale-105 transition-all shadow-[0_0_20px_rgba(239,68,68,0.5)]" title="Stop Recording">
                          <Square size={24} fill="currentColor" className="text-white" />
                      </button>
                  ) : (
                      <button onClick={startVideoRecording} className="w-16 h-16 rounded-full border-4 border-red-500 bg-transparent flex items-center justify-center hover:bg-red-500/20 transition-all" title="Start Recording">
                          <div className="w-12 h-12 rounded-full bg-red-500" />
                      </button>
                  )}
              </div>
          </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 p-8 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center shadow-2xl border border-slate-700">
                  <Bot size={40} className="text-cyan-400" />
              </div>
              <div className="max-w-md space-y-2">
                  <h2 className="text-2xl font-bold text-white">Ready to Begin?</h2>
                  <p className="text-slate-400">
                      I'm your AI tutor. I can assess your current level, guide you through the curriculum, or answer specific questions.
                  </p>
              </div>
              {onStartSession && (
                  <button 
                      onClick={onStartSession}
                      className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold shadow-lg shadow-cyan-900/20 transition-all transform hover:scale-105 flex items-center gap-2"
                  >
                      <span>Start Diagnostic Assessment</span>
                      <Send size={16} />
                  </button>
              )}
          </div>
        ) : (
            messages.map((msg) => (
            <div
                key={msg.id}
                className={`flex items-start gap-4 ${
                msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
            >
                <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' ? 'bg-cyan-600' : 'bg-emerald-600'
                }`}
                >
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                <div
                className={`max-w-[85%] rounded-lg p-4 leading-relaxed shadow-lg ${
                    msg.role === 'user'
                    ? 'bg-slate-800 border border-slate-700 text-slate-100'
                    : 'bg-slate-900 border border-emerald-900/30 text-slate-200'
                }`}
                >
                {msg.role === 'agent' && msg.metadata?.action && (
                    <div className="mb-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-900/50 text-emerald-400 border border-emerald-800">
                    {msg.metadata.action}
                    </div>
                )}
                
                {/* Attachment Rendering */}
                {msg.attachment && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-white/10 bg-black/20">
                        {msg.attachment.startsWith('data:image') ? (
                            <img src={msg.attachment} alt="User attachment" className="max-w-full h-auto max-h-[300px]" />
                        ) : msg.attachment.startsWith('data:audio') ? (
                            <div className="flex items-center gap-3 p-3 bg-slate-900/80">
                                <div className="w-10 h-10 bg-red-900/50 rounded-full flex items-center justify-center">
                                    <Mic className="text-red-400 w-5 h-5" />
                                </div>
                                <audio controls src={msg.attachment} className="h-8 max-w-[200px]" />
                            </div>
                        ) : msg.attachment.startsWith('data:video') ? (
                            <div className="bg-black/50">
                                <video controls src={msg.attachment} className="max-w-full h-auto max-h-[300px]" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-3 bg-slate-900/80">
                                <FileText className="text-cyan-400 w-8 h-8" />
                                <div className="text-sm font-mono text-slate-300">Document Attached</div>
                            </div>
                        )}
                    </div>
                )}
                {/* Legacy Support for 'image' prop if it exists in old messages */}
                {msg.image && !msg.attachment && (
                    <div className="mb-3 rounded-lg overflow-hidden border border-white/10 bg-black/20">
                        <img src={msg.image} alt="User attachment" className="max-w-full h-auto max-h-[300px]" />
                    </div>
                )}

                <div className="prose prose-invert prose-sm max-w-none break-words prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0">
                  <ReactMarkdown 
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                      code({node, inline, className, children, ...props}: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeContent = String(children).replace(/\n$/, '');

                          if (!inline && match) {
                          if (match[1] === 'mermaid') {
                              return <Mermaid chart={codeContent} />;
                          }
                          if (match[1] === 'plot') {
                              try {
                              const plotOptions = JSON.parse(codeContent);
                              return <FunctionPlot options={plotOptions} />;
                              } catch (e) {
                              return <div className="text-red-400 text-xs">Invalid Plot JSON</div>;
                              }
                          }
                          }

                          return !inline && match ? (
                          <div className="rounded-md bg-black/30 border border-white/10 p-3 my-3 overflow-x-auto">
                              <code className={className} {...props}>
                              {children}
                              </code>
                          </div>
                          ) : (
                          <code className="bg-slate-700/50 px-1 py-0.5 rounded text-cyan-200 font-mono text-xs" {...props}>
                              {children}
                          </code>
                          );
                      }
                      }}
                  >
                      {msg.content}
                  </ReactMarkdown>
                </div>
                </div>
            </div>
            ))
        )}
        
        {isLoading && (
          <div className="flex items-start gap-4">
             <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 animate-pulse">
              <Bot size={16} />
            </div>
            <div className="bg-slate-900 border border-emerald-900/30 rounded-lg p-4 flex items-center gap-2 text-emerald-500 text-sm">
              <Loader2 className="animate-spin w-4 h-4" />
              <span>Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-800 z-10">
        <div className="max-w-4xl mx-auto space-y-4">
            
            {showDrawingPad && (
                <DrawingPad 
                    onConfirm={handleDrawingSubmit} 
                    onCancel={() => setShowDrawingPad(false)} 
                />
            )}

            {renderAttachmentPreview()}

            <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*,application/pdf,audio/*,video/*"
                    onChange={handleFileSelect}
                />
                
                <div className="flex-1 relative">
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                        {isRecording ? (
                            <div className="flex items-center gap-2 px-2 py-1 bg-red-900/80 rounded-lg animate-pulse">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-xs font-mono text-red-200">{formatDuration(recordingDuration)}</span>
                                <button 
                                    type="button" 
                                    onClick={stopRecording}
                                    className="ml-2 p-1 hover:bg-red-800 rounded"
                                >
                                    <Square size={12} fill="currentColor" className="text-white" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Attach File (Video, Audio, Image, PDF)"
                                    disabled={isLoading}
                                >
                                    <Paperclip size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowDrawingPad(!showDrawingPad)}
                                    className={`p-2 rounded-lg transition-colors ${showDrawingPad ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                                    title="Draw"
                                    disabled={isLoading}
                                >
                                    <PenTool size={18} />
                                </button>
                                {onStartLiveSession && (
                                    <button
                                        type="button"
                                        onClick={onStartLiveSession}
                                        className="p-2 text-red-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors animate-pulse"
                                        title="Start Live Session"
                                        disabled={isLoading}
                                    >
                                        <Radio size={18} />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={startRecording}
                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Record Audio Clip"
                                    disabled={isLoading}
                                >
                                    <Mic size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={startCamera}
                                    className={`p-2 rounded-lg transition-colors ${useRemoteCamera && remoteStream ? 'text-emerald-400 bg-emerald-900/30' : 'text-slate-400 hover:text-red-400 hover:bg-slate-700'}`}
                                    title="Record Video Clip"
                                    disabled={isLoading}
                                >
                                    <Video size={18} />
                                </button>
                            </>
                        )}
                    </div>

                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onPaste={handlePaste}
                        placeholder={showDrawingPad ? "Add a caption to your drawing..." : isRecording ? "Recording audio..." : "Type, or start a Live Session..."}
                        className="w-full bg-slate-800 text-slate-100 rounded-xl pl-[230px] pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-700 shadow-inner"
                        disabled={isLoading || isRecording}
                    />
                    
                    <button
                        type="submit"
                        disabled={(!inputValue.trim() && !pendingAttachment) || isLoading || isRecording}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;