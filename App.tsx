import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LearnerState, Message, ParsedAgentResponse, CurriculumWeek } from './types';
import { INITIAL_LEARNER_STATE, CURRICULUM_DATA } from './constants';
import { sendMessageToAgent } from './services/geminiService';
import { analyzeCurriculumIntent } from './services/routingService';
import { getSession, logout, loadProgress, saveProgress, UserProfile } from './services/storageService';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import CourseCard from './components/CourseCard';
import WeekTimeline from './components/WeekTimeline';
import TopicSidebar from './components/TopicSidebar';
import AuthModal from './components/AuthModal';
import MobileConnectView from './components/MobileConnectView';
import { Menu, X, ArrowLeft, GraduationCap, Sparkles, Smartphone, QrCode, Link as LinkIcon, Check, LogOut, User as UserIcon, LogIn } from 'lucide-react';
import { Peer } from 'peerjs';

type ViewMode = 'HOME' | 'COURSE' | 'MOBILE_CONNECT';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('HOME');
  
  // User Session State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Dynamic Curriculum State
  const [curriculum, setCurriculum] = useState<CurriculumWeek[]>(CURRICULUM_DATA);
  
  const [learnerState, setLearnerState] = useState<LearnerState>(INITIAL_LEARNER_STATE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [lastAgentResponse, setLastAgentResponse] = useState<ParsedAgentResponse | null>(null);
  
  // Mobile/Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [selectedWeekId, setSelectedWeekId] = useState<string>(INITIAL_LEARNER_STATE.currentWeek);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const [hasStarted, setHasStarted] = useState(false);

  const [isMobileStreaming, setIsMobileStreaming] = useState(false);

  // WebRTC / Mobile Connection State
  const [mobileConnectId, setMobileConnectId] = useState<string | null>(null);
  const [desktopPeerId, setDesktopPeerId] = useState<string>('');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);

  // --- INITIALIZATION & AUTH CHECK ---
  useEffect(() => {
    // 1. Check for Mobile Connect Param
    const params = new URLSearchParams(window.location.search);
    const mobileConnect = params.get('mobileConnect');
    if (mobileConnect) {
      setMobileConnectId(mobileConnect);
      setView('MOBILE_CONNECT');
      return;
    }

    // 2. Check for Sync Data (Mobile URL legacy)
    const syncData = params.get('sync');
    if (syncData) {
        try {
            const decoded = decodeURIComponent(atob(syncData));
            const syncedState = JSON.parse(decoded);
            setLearnerState(syncedState);
            if (syncedState.currentWeek) {
                setSelectedWeekId(syncedState.currentWeek);
            }
            window.history.replaceState({}, '', window.location.pathname);
            setView('COURSE');
        } catch (e) {
            console.error("Sync failed", e);
        }
    } else {
        // 3. Check for Local Storage Session
        const session = getSession();
        if (session) {
            setUser(session);
            const progress = loadProgress(session.id);
            if (progress) {
                setLearnerState(progress.state);
                setMessages(progress.messages);
                if (progress.state.currentWeek) {
                    setSelectedWeekId(progress.state.currentWeek);
                }
                if (progress.messages.length > 0) setHasStarted(true);
            }
        }
    }
  }, []);

  // --- PEERJS INIT (DESKTOP) ---
  useEffect(() => {
    // Only init peer if we are not in mobile mode
    if (view !== 'MOBILE_CONNECT' && !peerRef.current) {

      const id = 'math-agent-' + crypto.randomUUID();
      const peer = new Peer(id);

      // ---- Peer Ready ----
      peer.on('open', (id) => {
        console.log('My Peer JS ID is:', id);
        setDesktopPeerId(id);
      });

      // ---- Control Channel (Status) ----
      peer.on('connection', (conn) => {
        console.log('Control channel connected');

        conn.on('data', (data) => {
          console.log('Control message:', data);

          if (data === 'STREAM_STARTED') {
            console.log('Mobile stream started (signal)');
            setIsMobileStreaming(true); // UPDATE STATE
          }
        });

        conn.on('close', () => {
          console.log('Control channel closed');
          setIsMobileStreaming(false);
        });
      });

      // ---- Media Channel (Video) ----
      peer.on('call', (call) => {
        console.log('Receiving media call...');

        call.answer(); // one-way (mobile → desktop)

        call.on('stream', (stream) => {
          console.log('Received remote stream');

          setRemoteStream(stream);
          setIsMobileStreaming(true); // BACKUP SIGNAL
          setShowQrModal(false);
        });

        call.on('close', () => {
          console.log('Call closed');
          setRemoteStream(null);
          setIsMobileStreaming(false);
        });
      });

      // ---- Error Handling ----
      peer.on('error', (err) => {
        console.error('PeerJS error:', err);
      });

      peerRef.current = peer;
    }

  }, [view]);


  // --- SAVE ON UPDATE ---
  useEffect(() => {
    if (user && hasStarted && view !== 'MOBILE_CONNECT') {
        saveProgress(user.id, learnerState, messages);
    }
  }, [user, learnerState, messages, hasStarted, view]);

  // --- AGENT SESSION START ---
  const startSession = useCallback(async () => {
    if (hasStarted) return;
    setHasStarted(true);
    setIsLoading(true);

    try {
      if (messages.length > 0) {
          setIsLoading(false);
          return;
      }

      const response = await sendMessageToAgent(
          user ? `Hi, I am ${user.name}. Let's begin.` : '', 
          learnerState, 
          [], 
          undefined, 
          curriculum
      );
      
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
  }, [hasStarted, learnerState, curriculum, messages.length, user]);

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
      setUser(loggedInUser);
      const progress = loadProgress(loggedInUser.id);
      if (progress) {
          setLearnerState(progress.state);
          setMessages(progress.messages);
          if (progress.state.currentWeek) setSelectedWeekId(progress.state.currentWeek);
          setHasStarted(true);
          setView('COURSE');
      } else {
          saveProgress(loggedInUser.id, learnerState, messages);
      }
  };

  const handleLogout = () => {
      logout();
      setUser(null);
      setView('HOME');
      setLearnerState(INITIAL_LEARNER_STATE);
      setMessages([]);
      setHasStarted(false);
  };

  const handleSendMessage = async (text: string, attachment?: string) => {
    if (!hasStarted) setHasStarted(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachment: attachment 
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setIsRouting(true); 

    let currentWeekOverride: string | undefined;
    let updatedCurriculum = [...curriculum];

    try {
      if (text.length > 5 || attachment) {
        const routeResult = await analyzeCurriculumIntent(text, curriculum, attachment);
        if (routeResult.action === 'NAVIGATE' && routeResult.targetWeekId) {
             if (routeResult.targetWeekId !== selectedWeekId) {
                 setSelectedWeekId(routeResult.targetWeekId);
                 currentWeekOverride = routeResult.targetWeekId;
                 setMessages(prev => [...prev, {
                     id: Date.now().toString(),
                     role: 'system',
                     content: `Switched context to **${routeResult.targetWeekId}**.`,
                     timestamp: Date.now()
                 }]);
             }
        } else if (routeResult.action === 'ADD_MODULE' && routeResult.newModule) {
            updatedCurriculum = [...curriculum, routeResult.newModule];
            setCurriculum(updatedCurriculum);
            setSelectedWeekId(routeResult.newModule.id);
            currentWeekOverride = routeResult.newModule.id;
            
            setMessages(prev => [...prev, {
                 id: Date.now().toString(),
                 role: 'system',
                 content: `Added new module: **${routeResult.newModule.title}**.`,
                 timestamp: Date.now()
            }]);
            
            setLearnerState(prev => ({
                ...prev,
                masteryLevels: {
                    ...prev.masteryLevels,
                    [routeResult.newModule!.id]: 0
                }
            }));
        }
      }

      setIsRouting(false);

      const apiHistory = messages.map(m => {
        const parts: any[] = [{ text: m.role === 'agent' ? (m.metadata?.raw || m.content) : m.content }];
        if (m.attachment) {
            const mimeMatch = m.attachment.match(/^data:(.*?);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
            const cleanBase64 = m.attachment.split(',')[1] || m.attachment;
            parts.unshift({ inlineData: { mimeType, data: cleanBase64 } });
        } else if (m.image) {
            const cleanBase64 = m.image.split(',')[1] || m.image;
            parts.unshift({ inlineData: { mimeType: 'image/png', data: cleanBase64 } });
        }
        return { role: m.role === 'agent' ? 'model' : 'user' as 'model' | 'user', parts: parts };
      });
      
      const contextState = { ...learnerState, currentWeek: currentWeekOverride || learnerState.currentWeek };
      const response = await sendMessageToAgent(text, contextState, apiHistory, attachment, updatedCurriculum);

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
        if (response.memoryUpdate.currentWeek && response.memoryUpdate.currentWeek !== selectedWeekId) {
             setSelectedWeekId(response.memoryUpdate.currentWeek);
        }
      }

    } catch (error) {
      console.error("Agent interaction failed", error);
       setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'system', 
          content: 'Error processing response. The agent loop has been interrupted.', 
          timestamp: Date.now() 
        }]);
    } finally {
      setIsLoading(false);
      setIsRouting(false);
    }
  };

  const handleTopicClick = (topic: string) => {
      handleSendMessage(`I want to focus on the subconcept "${topic}" in ${selectedWeekId}.`);
  };

  // Robust URL generation for production
  const getMobileConnectUrl = () => {
      // Use origin and pathname to ensure a clean, absolute URL
      // This avoids blob: URLs if window.location is standard, and removes query params
        const url = new URL(window.location.href);
        // Remove old params
        url.search = "";
        // Add pairing param
        url.searchParams.set("mobileConnect", desktopPeerId);
        return url.toString();
  };

  const copyToClipboard = () => {
      navigator.clipboard.writeText(getMobileConnectUrl());
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const overallProgress = (Object.values(learnerState.masteryLevels) as number[]).reduce((a, b) => a + b, 0) / (curriculum.length || 1);

  // --- RENDER ---
  if (view === 'MOBILE_CONNECT' && mobileConnectId) {
    return <MobileConnectView desktopPeerId={mobileConnectId} />;
  }

  return (
    <>
    <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onSuccess={handleLoginSuccess} 
    />

    {view === 'HOME' ? (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-6 right-6 z-20">
            {user ? (
                 <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2 text-slate-300">
                         <div className="w-8 h-8 rounded-full bg-cyan-900 flex items-center justify-center border border-cyan-700">
                             <span className="font-bold text-xs">{user.name.charAt(0)}</span>
                         </div>
                         <span className="text-sm font-medium">{user.name}</span>
                     </div>
                     <button 
                        onClick={handleLogout}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                        title="Sign Out"
                     >
                         <LogOut size={18} />
                     </button>
                 </div>
            ) : (
                <button 
                    onClick={() => setIsAuthOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 transition-colors"
                >
                    <LogIn size={16} />
                    <span>Sign In</span>
                </button>
            )}
        </div>

        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
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
               v1.1.0 • Powered by Gemini 2.0 Flash (Multi-Agent System)
           </div>
        </div>
      </div>
    ) : (
      <div className="flex flex-col h-screen bg-black overflow-hidden font-sans text-slate-200">
        <div className="flex flex-col bg-slate-950 border-b border-slate-900 z-30 shadow-md">
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
                  {isRouting && (
                     <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-900/30 border border-indigo-500/30 text-indigo-400 text-xs animate-pulse">
                        <Sparkles size={12} />
                        <span>Navigator Active</span>
                     </div>
                  )}
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowQrModal(true)}
                  className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${remoteStream ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                >
                  <Smartphone size={16} />
                  <span>{isMobileStreaming ? 'Mobile Streaming' : 'Connect Mobile'}</span>
                </button>

                {user ? (
                    <div className="hidden md:flex items-center gap-2 px-2 py-1 bg-slate-900 rounded-full border border-slate-800">
                         <div className="w-5 h-5 rounded-full bg-cyan-900/50 flex items-center justify-center text-[10px] font-bold">
                             {user.name.charAt(0)}
                         </div>
                    </div>
                ) : (
                    <button 
                        onClick={() => setIsAuthOpen(true)}
                        className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-cyan-900/20 text-cyan-400 border border-cyan-900/50 hover:bg-cyan-900/40 rounded-lg text-xs font-bold transition-colors"
                    >
                        Sign In to Save
                    </button>
                )}

                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="lg:hidden p-2 text-slate-300 hover:text-white rounded-md hover:bg-slate-800"
                >
                    {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>

            <div className="w-full">
                 <WeekTimeline 
                  currentWeekId={selectedWeekId} 
                  masteryLevels={learnerState.masteryLevels}
                  onSelectWeek={setSelectedWeekId}
                  curriculum={curriculum} 
                />
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          <div className="hidden md:flex w-64 xl:w-72 shrink-0 border-r border-slate-800 bg-slate-900/50 flex-col">
               <TopicSidebar 
                  currentWeekId={selectedWeekId} 
                  focusTopic={learnerState.focusTopic}
                  onTopicClick={handleTopicClick}
                  curriculum={curriculum}
               />
          </div>

          <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative z-0">
               <ChatInterface 
                  messages={messages} 
                  isLoading={isLoading} 
                  onSendMessage={handleSendMessage}
                  onStartSession={startSession}
                  remoteStream={remoteStream}
               />
          </div>

          <div className={`
              fixed inset-y-0 right-0 z-50 w-80 lg:w-96 transform transition-transform duration-300 ease-in-out 
              bg-slate-900 border-l border-slate-800 shadow-2xl
              lg:relative lg:translate-x-0 lg:shadow-none lg:flex lg:flex-col
              ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
              top-[130px] lg:top-0 h-[calc(100%-130px)] lg:h-full
          `}>
               <Dashboard state={learnerState} lastAgentResponse={lastAgentResponse} />
               {isSidebarOpen && user && (
                   <div className="p-4 border-t border-slate-800 lg:hidden">
                       <button onClick={handleLogout} className="w-full py-2 bg-red-900/20 text-red-400 border border-red-900/50 rounded-lg flex items-center justify-center gap-2">
                           <LogOut size={16} /> Sign Out
                       </button>
                   </div>
               )}
          </div>
          
          {isSidebarOpen && (
              <div 
                  className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
                  onClick={() => setIsSidebarOpen(false)}
              />
          )}
        </div>

        {showQrModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center relative shadow-2xl">
              <button 
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="w-16 h-16 bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <QrCode className="w-8 h-8 text-cyan-400" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">
                  Sync Mobile Camera
              </h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Scan with your phone to stream its camera to this session. No login required.
              </p>
              
              <div className="bg-white p-4 rounded-xl mx-auto w-fit mb-6 shadow-lg min-h-[200px] flex items-center justify-center">
                {desktopPeerId ? (
                    <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getMobileConnectUrl())}&color=000000`} 
                    alt="Mobile Connect QR Code" 
                    className="w-48 h-48"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-cyan-500 rounded-full animate-spin" />
                        <span className="text-xs text-slate-400">Initializing Connection...</span>
                    </div>
                )}
              </div>

              {desktopPeerId && (
                <div className="mb-4 p-2 bg-black/30 rounded border border-white/5 text-[10px] font-mono text-slate-500 break-all select-all">
                    {getMobileConnectUrl()}
                </div>
              )}
              
              <button 
                  onClick={copyToClipboard}
                  disabled={!desktopPeerId}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {copySuccess ? <Check size={16} className="text-emerald-400" /> : <LinkIcon size={16} />}
                  {copySuccess ? 'Copied Link' : 'Copy Connect Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    )}
    </>
  );
};

export default App;