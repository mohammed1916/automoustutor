import React, { useEffect, useRef, useState } from 'react';
import { Message } from '../types';
import { Send, User, Bot, Loader2, PenTool, Image as ImageIcon, Paperclip, X, FileText, UploadCloud, Mic, Camera as CameraIcon, Square, Check, RefreshCw } from 'lucide-react';
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
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, onSendMessage }) => {
  const [inputValue, setInputValue] = useState('');
  const [showDrawingPad, setShowDrawingPad] = useState(false);
  
  // Media States
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Camera State
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
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
        
        // Stop all tracks
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
      alert("Could not access microphone.");
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

  // --- CAMERA ---
  const startCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          setCameraStream(stream);
          setShowCamera(true);
      } catch (err) {
          console.error("Error accessing camera:", err);
          alert("Could not access camera.");
      }
  };

  const stopCameraStream = () => {
      if (cameraStream) {
          cameraStream.getTracks().forEach(track => track.stop());
          setCameraStream(null);
      }
      setShowCamera(false);
  };

  const takePhoto = () => {
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
                  ) : (
                      <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-600">
                          <FileText className="text-cyan-400 w-5 h-5" />
                      </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">
                        {isImage ? 'Image' : isAudio ? 'Audio Clip' : 'Document'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                        Ready to send
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
                    srcObject={cameraStream as any}
                  />
                  <div className="absolute top-4 right-4">
                      <button onClick={stopCameraStream} className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70">
                          <X size={24} />
                      </button>
                  </div>
              </div>
              <div className="h-24 bg-slate-900 flex items-center justify-center gap-8">
                  <button onClick={takePhoto} className="w-16 h-16 rounded-full border-4 border-white bg-transparent hover:bg-white/20 transition-all" />
              </div>
          </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        {messages.map((msg) => (
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

              <ReactMarkdown 
                className="prose prose-invert prose-sm max-w-none break-words prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0"
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
        ))}
        
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
                    accept="image/*,application/pdf,audio/*"
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
                                    title="Attach File"
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
                                <button
                                    type="button"
                                    onClick={startRecording}
                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Record Audio"
                                    disabled={isLoading}
                                >
                                    <Mic size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={startCamera}
                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Camera"
                                    disabled={isLoading}
                                >
                                    <CameraIcon size={18} />
                                </button>
                            </>
                        )}
                    </div>

                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onPaste={handlePaste}
                        placeholder={showDrawingPad ? "Add a caption to your drawing..." : isRecording ? "Recording audio..." : "Type, paste image, or drop file..."}
                        className="w-full bg-slate-800 text-slate-100 rounded-xl pl-[160px] pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-700 shadow-inner"
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