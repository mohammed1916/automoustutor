import React, { useEffect, useRef, useState } from 'react';
import { Peer } from 'peerjs';
import { Camera, Wifi, WifiOff, RefreshCw, Zap } from 'lucide-react';

interface MobileConnectViewProps {
  desktopPeerId: string;
}

const MobileConnectView: React.FC<MobileConnectViewProps> = ({ desktopPeerId }) => {
  const [status, setStatus] = useState<'initializing' | 'connecting' | 'connected' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const connRef = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Get Camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false // Mute audio to prevent feedback loop
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // 2. Init Peer
        const peer = new Peer();
        peerRef.current = peer;

        peer.on('open', (id) => {
          setStatus('connecting');

          // Open control channel
          const conn = peer.connect(desktopPeerId);
          connRef.current = conn;

          conn.on('open', () => {
            console.log('Control channel open (mobile → desktop)');
          });

          conn.on('error', (e) => {
            console.error('Control channel error', e);
          });

          connectToDesktop(peer, stream);
        });

        peer.on('error', (err) => {
          console.error("Peer Error", err);
          setStatus('error');
          setErrorMessage("Connection failed. Retrying...");
          setTimeout(() => window.location.reload(), 3000);
        });

      } catch (err: any) {
        setStatus('error');
        setErrorMessage("Camera access denied or not supported.");
      }
    };

    init();

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      connRef.current?.close();
      peerRef.current?.destroy();
    };
  }, [desktopPeerId]);

  const connectToDesktop = (peer: Peer, stream: MediaStream) => {
    try {
      const call = peer.call(desktopPeerId, stream);

      // Notify desktop that streaming started
      if (connRef.current?.open) {
        connRef.current.send('STREAM_STARTED');
      } else {
        connRef.current?.on('open', () => {
          connRef.current?.send('STREAM_STARTED');
        });
      }

      
      call.on('close', () => {
        setStatus('error');
        setErrorMessage("Desktop disconnected.");
      });

      call.on('error', (e) => {
          console.error(e);
          setStatus('error');
      });
      
      // Wait a bit to assume connection is stable if no immediate error
      setTimeout(() => {
          if (status !== 'error') setStatus('connected');
      }, 1000);

    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Status Indicator */}
      <div className={`absolute inset-0 transition-colors duration-500 ${status === 'connected' ? 'bg-emerald-900/20' : 'bg-red-900/20'}`} />

      <div className="z-10 w-full h-full flex flex-col p-6">
        
        <div className="flex-1 relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
           <video 
             ref={videoRef} 
             autoPlay 
             muted 
             playsInline 
             className="w-full h-full object-cover"
           />
           
           <div className="absolute top-4 left-0 w-full flex justify-center">
             <div className={`px-4 py-2 rounded-full backdrop-blur-md border flex items-center gap-2 font-bold text-sm shadow-lg
                ${status === 'connected' 
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                  : status === 'error'
                  ? 'bg-red-500/20 border-red-500/50 text-red-400'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300'}
             `}>
                {status === 'connected' && <Wifi size={16} />}
                {status === 'connecting' && <RefreshCw size={16} className="animate-spin" />}
                {status === 'error' && <WifiOff size={16} />}
                
                <span className="uppercase tracking-wider">
                  {status === 'initializing' ? 'Starting Camera...' : 
                   status === 'connecting' ? 'Connecting to Desktop...' :
                   status === 'connected' ? 'Streaming Live' : 'Connection Lost'}
                </span>
             </div>
           </div>

           {status === 'connected' && (
              <div className="absolute bottom-8 left-0 w-full text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/60 rounded-full text-white text-xs backdrop-blur-sm">
                      <Zap size={12} className="text-yellow-400 fill-current" />
                      <span>Point at math problems to solve</span>
                  </div>
              </div>
           )}
        </div>

        {status === 'error' && (
          <div className="mt-6 text-center text-red-400 max-w-xs mx-auto text-sm bg-red-950/50 p-4 rounded-xl border border-red-900">
             <p>{errorMessage}</p>
             <button onClick={() => window.location.reload()} className="mt-2 text-white font-bold underline">
               Tap to Retry
             </button>
          </div>
        )}
        
        <div className="mt-6 text-center">
            <h1 className="text-xl font-bold text-slate-200">Academia.ai Mobile</h1>
            <p className="text-slate-500 text-xs mt-1">Remote Camera Link</p>
        </div>

      </div>
    </div>
  );
};

export default MobileConnectView;