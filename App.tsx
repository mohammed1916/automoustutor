import React, { useState, useEffect, useCallback } from 'react';
import { LearnerState, Message, ParsedAgentResponse } from './types';
import { INITIAL_LEARNER_STATE } from './constants';
import { sendMessageToAgent } from './services/geminiService';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import { Menu, X } from 'lucide-react';

const App: React.FC = () => {
  const [learnerState, setLearnerState] = useState<LearnerState>(INITIAL_LEARNER_STATE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAgentResponse, setLastAgentResponse] = useState<ParsedAgentResponse | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar toggle
  const [hasStarted, setHasStarted] = useState(false);

  // Initialize the agent session
  const startSession = useCallback(async () => {
    if (hasStarted) return;
    setHasStarted(true);
    setIsLoading(true);

    try {
      const response = await sendMessageToAgent('', learnerState, []);
      
      const newMsg: Message = {
        id: Date.now().toString(),
        role: 'agent',
        content: response.content,
        timestamp: Date.now(),
        metadata: response
      };

      setMessages([newMsg]);
      setLastAgentResponse(response);
      
      if (response.memoryUpdate) {
        setLearnerState(prev => ({ ...prev, ...response.memoryUpdate }));
      }
    } catch (error) {
      console.error("Failed to start session:", error);
      setMessages(prev => [
        ...prev, 
        { 
          id: Date.now().toString(), 
          role: 'system', 
          content: 'Error: Could not connect to Agent. Please check API Key configuration.', 
          timestamp: Date.now() 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [hasStarted, learnerState]);

  // Auto-start on mount
  useEffect(() => {
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build history for API
      // We limit history to prevent context overflow, although Flash has large window.
      // We filter only relevant fields for the 'parts'
      const apiHistory = messages.map(m => ({
        role: m.role === 'agent' ? 'model' : 'user' as 'model' | 'user',
        parts: [{ text: m.role === 'agent' ? (m.metadata?.raw || m.content) : m.content }]
      }));

      // Add the new user message to history happens inside sendMessageToAgent logic implicitly via prompt construction 
      // but strictly we pass history of PREVIOUS messages.
      
      const response = await sendMessageToAgent(text, learnerState, apiHistory);

      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: response.content,
        timestamp: Date.now(),
        metadata: response
      };

      setMessages(prev => [...prev, agentMsg]);
      setLastAgentResponse(response);

      if (response.memoryUpdate) {
        setLearnerState(prev => ({ ...prev, ...response.memoryUpdate }));
      }

    } catch (error) {
      console.error("Agent interaction failed", error);
       setMessages(prev => [
        ...prev, 
        { 
          id: Date.now().toString(), 
          role: 'system', 
          content: 'Error processing response. The agent loop has been interrupted.', 
          timestamp: Date.now() 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-black overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative z-0">
        {/* Mobile Header */}
        <div className="h-14 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between lg:hidden shrink-0">
          <span className="font-bold text-slate-100">Adaptive Math Agent</span>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-slate-300 hover:text-white"
          >
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
        </div>

        <ChatInterface 
          messages={messages} 
          isLoading={isLoading} 
          onSendMessage={handleSendMessage} 
        />
      </div>

      {/* Sidebar / Dashboard */}
      <div className={`
        fixed inset-y-0 right-0 z-50 w-80 lg:w-96 transform transition-transform duration-300 ease-in-out bg-slate-900 border-l border-slate-800 shadow-2xl
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <Dashboard state={learnerState} lastAgentResponse={lastAgentResponse} />
      </div>
    </div>
  );
};

export default App;
