import React, { useEffect, useRef, useState } from 'react';
import { Message } from '../types';
import { Send, User, Bot, Loader2, PenTool, Image as ImageIcon } from 'lucide-react';
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
  onSendMessage: (text: string, image?: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, onSendMessage }) => {
  const [inputValue, setInputValue] = useState('');
  const [showDrawingPad, setShowDrawingPad] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, showDrawingPad]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleDrawingSubmit = (imageBase64: string) => {
      // Send the drawing with an optional text caption (or empty string if no caption)
      // Usually better to have some text context, but empty is allowed by our update
      const text = inputValue.trim() || "Analyze this drawing.";
      onSendMessage(text, imageBase64);
      setInputValue('');
      setShowDrawingPad(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
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
              
              {/* Display Image if present */}
              {msg.image && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-white/10">
                      <img src={msg.image} alt="User drawing" className="max-w-full h-auto bg-slate-950" />
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

      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <div className="max-w-4xl mx-auto space-y-4">
            
            {showDrawingPad && (
                <DrawingPad 
                    onConfirm={handleDrawingSubmit} 
                    onCancel={() => setShowDrawingPad(false)} 
                />
            )}

            <form onSubmit={handleSubmit} className="relative">
                <button
                    type="button"
                    onClick={() => setShowDrawingPad(!showDrawingPad)}
                    className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors z-10 ${showDrawingPad ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    title="Draw an equation or graph"
                    disabled={isLoading}
                >
                    <PenTool size={18} />
                </button>
                
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={showDrawingPad ? "Add a caption to your drawing..." : "Type your answer or draw..."}
                    className="w-full bg-slate-800 text-slate-100 rounded-xl pl-12 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-700 shadow-inner"
                    disabled={isLoading}
                />
                
                <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Send size={18} />
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
