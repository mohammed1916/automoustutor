import React, { useState, useEffect, useCallback } from 'react';
import { LearnerState, Message, ParsedAgentResponse } from './types';
import { INITIAL_LEARNER_STATE, CURRICULUM_DATA } from './constants';
import { sendMessageToAgent } from './services/geminiService';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import CourseCard from './components/CourseCard';
import WeekTimeline from './components/WeekTimeline';
import TopicSidebar from './components/TopicSidebar';
import { Menu, X, ArrowLeft } from 'lucide-react';

type ViewMode = 'HOME' | 'COURSE';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('HOME');
  const [learnerState, setLearnerState] = useState<LearnerState>(INITIAL_LEARNER_STATE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAgentResponse, setLastAgentResponse] = useState<ParsedAgentResponse | null>(null);
  
  // Mobile/Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  // Sync selected week when agent updates current week, unless user manually navigated
  useEffect(() => {
    if (learnerState.currentWeek && CURRICULUM_DATA.find(w => w.id === learnerState.currentWeek)) {
       // Only auto-switch if we are strictly following agent or near startup.
       // For now, let's allow manual navigation to override display, but keep agent state sync.
    }
  }, [learnerState.currentWeek]);

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
             // Optional: Snap to new week if agent advanced
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

  if (view === 'HOME') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-900/20 rounded-full blur-[100px]" />
        </div>

        <div className="z-10 w-full max-w-4xl flex flex-col items-center gap-12">
           <div className="text-center space-y-2">
                <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 tracking-tight">
                    Academia<span className="text-cyan-500">.ai</span>
                </h1>
                <p className="text-slate-500 text-lg">Autonomous Adaptive Learning Platform</p>
           </div>
           
           <CourseCard 
             progress={overallProgress} 
             onStart={() => setView('COURSE')} 
           />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden font-sans text-slate-200">
      
      {/* Top Navigation Bar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setView('HOME')}
                className="p-2 -ml-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            >
                <ArrowLeft size={20} />
            </button>
            <div>
                <h1 className="font-bold text-slate-100 leading-none">Mathematics I</h1>
                <span className="text-xs text-slate-500">Undergraduate Curriculum</span>
            </div>
        </div>
        <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 text-slate-300 hover:text-white"
        >
            {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Week Timeline Scroller */}
      <WeekTimeline 
        currentWeekId={selectedWeekId} 
        masteryLevels={learnerState.masteryLevels}
        onSelectWeek={setSelectedWeekId}
      />

      {/* Main Content Area - Split View */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Sidebar: Topics (Hidden on mobile, togglable via menu conceptually, but strict layout requests it) */}
        <div className="hidden md:flex">
             <TopicSidebar 
                currentWeekId={selectedWeekId} 
                focusTopic={learnerState.focusTopic}
                onTopicClick={handleTopicClick}
             />
        </div>

        {/* Center: Chat Interface */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-slate-800 relative">
             <ChatInterface 
                messages={messages} 
                isLoading={isLoading} 
                onSendMessage={handleSendMessage} 
             />
        </div>

        {/* Right Pane: Visualization & Dashboard (Responsive: Sidebar on Desktop) */}
        <div className={`
            fixed inset-y-0 right-0 z-50 w-80 lg:w-[400px] transform transition-transform duration-300 ease-in-out bg-slate-900 border-l border-slate-800 shadow-2xl
            lg:relative lg:translate-x-0 lg:shadow-none lg:flex lg:flex-col
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
            top-[120px] lg:top-0 h-[calc(100%-120px)] lg:h-full
        `}>
             <Dashboard state={learnerState} lastAgentResponse={lastAgentResponse} />
        </div>
        
        {/* Mobile Overlay for Right Sidebar */}
        {isSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
            />
        )}
      </div>
    </div>
  );
};

export default App;