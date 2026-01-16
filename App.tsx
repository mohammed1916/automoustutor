import React, { useState, useEffect, useCallback } from 'react';
import { LearnerState, Message, ParsedAgentResponse } from './types';
import { INITIAL_LEARNER_STATE, CURRICULUM_DATA } from './constants';
import { sendMessageToAgent } from './services/geminiService';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import CourseCard from './components/CourseCard';
import WeekTimeline from './components/WeekTimeline';
import TopicSidebar from './components/TopicSidebar';
import { Menu, X, ArrowLeft, GraduationCap } from 'lucide-react';

type ViewMode = 'HOME' | 'COURSE';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('HOME');
  const [learnerState, setLearnerState] = useState<LearnerState>(INITIAL_LEARNER_STATE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAgentResponse, setLastAgentResponse] = useState<ParsedAgentResponse | null>(null);
  
  // Mobile/Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Controls Right Sidebar (Dashboard) on mobile
  const [selectedWeekId, setSelectedWeekId] = useState<string>(INITIAL_LEARNER_STATE.currentWeek);
  
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
        if(response.memoryUpdate.currentWeek) {
            setSelectedWeekId(response.memoryUpdate.currentWeek);
        }
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

  // Auto-start on mount (background)
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
      const apiHistory = messages.map(m => ({
        role: m.role === 'agent' ? 'model' : 'user' as 'model' | 'user',
        parts: [{ text: m.role === 'agent' ? (m.metadata?.raw || m.content) : m.content }]
      }));
      
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
        // If agent changes week, optionally snap to it
        if (response.memoryUpdate.currentWeek && response.memoryUpdate.currentWeek !== selectedWeekId) {
             setSelectedWeekId(response.memoryUpdate.currentWeek);
        }
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

  const handleTopicClick = (topic: string) => {
      // Direct instruction to agent
      const instruction = `I want to focus on the subconcept "${topic}" in ${selectedWeekId}.`;
      handleSendMessage(instruction);
  };

  // Calculate overall progress for Home Card
  const overallProgress = Object.values(learnerState.masteryLevels).reduce((a: number, b: number) => a + b, 0) / 11;

  // --- VIEW: HOME PAGE ---
  if (view === 'HOME') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
             {/* Dynamic background elements */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[100px]" />
            <div className="absolute top-[40%] left-[20%] w-[20%] h-[20%] bg-emerald-900/10 rounded-full blur-[80px]" />
        </div>

        <div className="z-10 w-full max-w-5xl flex flex-col items-center gap-16 animate-fade-in">
           <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 shadow-xl">
                        <GraduationCap className="w-8 h-8 text-cyan-400" />
                    </div>
                </div>
                <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 tracking-tight">
                    Academia<span className="text-cyan-500">.ai</span>
                </h1>
                <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                    An autonomous, adaptive agent designed to guide you through undergraduate mathematics. 
                    No rigid paths—just pure, personalized learning.
                </p>
           </div>
           
           <CourseCard 
             progress={overallProgress} 
             onStart={() => setView('COURSE')} 
           />
           
           <div className="text-slate-600 text-xs font-mono uppercase tracking-widest mt-8">
               v1.0.4 • Powered by Gemini 2.0 Flash
           </div>
        </div>
      </div>
    );
  }

  // --- VIEW: COURSE INTERFACE ---
  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden font-sans text-slate-200">
      
      {/* 1. TOP BAR & WEEK NAVIGATION */}
      <div className="flex flex-col bg-slate-950 border-b border-slate-900 z-30 shadow-md">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setView('HOME')}
                    className="group flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                    <div className="p-1.5 rounded-lg group-hover:bg-slate-800 transition-colors">
                        <ArrowLeft size={18} />
                    </div>
                    <span className="font-bold text-sm tracking-wide hidden sm:block">DASHBOARD</span>
                </button>
                <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
                <div>
                    <h1 className="font-bold text-slate-100 text-sm md:text-base leading-none">Mathematics I</h1>
                </div>
            </div>
            
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 text-slate-300 hover:text-white rounded-md hover:bg-slate-800"
            >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Horizontal Timeline */}
          <div className="w-full">
               <WeekTimeline 
                currentWeekId={selectedWeekId} 
                masteryLevels={learnerState.masteryLevels}
                onSelectWeek={setSelectedWeekId}
              />
          </div>
      </div>

      {/* 2. MAIN WORKSPACE (Split View) */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT PANE: SUB-CONCEPTS (Navigation) */}
        <div className="hidden md:flex w-64 xl:w-72 shrink-0 border-r border-slate-800 bg-slate-900/50 flex-col">
             <TopicSidebar 
                currentWeekId={selectedWeekId} 
                focusTopic={learnerState.focusTopic}
                onTopicClick={handleTopicClick}
             />
        </div>

        {/* CENTER PANE: CHAT (The Interaction) */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative z-0">
             <ChatInterface 
                messages={messages} 
                isLoading={isLoading} 
                onSendMessage={handleSendMessage} 
             />
        </div>

        {/* RIGHT PANE: VISUALIZATION & AGENT THOUGHTS (Dashboard) */}
        <div className={`
            fixed inset-y-0 right-0 z-50 w-80 lg:w-96 transform transition-transform duration-300 ease-in-out 
            bg-slate-900 border-l border-slate-800 shadow-2xl
            lg:relative lg:translate-x-0 lg:shadow-none lg:flex lg:flex-col
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
            top-[130px] lg:top-0 h-[calc(100%-130px)] lg:h-full
        `}>
             <Dashboard state={learnerState} lastAgentResponse={lastAgentResponse} />
        </div>
        
        {/* Mobile Overlay */}
        {isSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
            />
        )}
      </div>
    </div>
  );
};

export default App;