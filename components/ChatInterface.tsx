import React, { useEffect, useRef } from 'react';
import { Message } from '../types';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isLoading, onSendMessage }) => {
  const [inputValue, setInputValue] = React.useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue);
      setInputValue('');
    }
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
              <ReactMarkdown 
                className="prose prose-invert prose-sm max-w-none break-words prose-p:leading-relaxed prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/10"
                remarkPlugins={[remarkGfm]}
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
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your answer..."
            className="w-full bg-slate-800 text-slate-100 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-slate-700 shadow-inner"
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
  );
};

export default ChatInterface;