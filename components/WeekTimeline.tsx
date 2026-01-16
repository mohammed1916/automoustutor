import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, ChevronRight } from 'lucide-react';
import { CURRICULUM_DATA } from '../constants';

interface WeekTimelineProps {
  currentWeekId: string;
  masteryLevels: Record<string, number>;
  onSelectWeek: (weekId: string) => void;
}

const WeekTimeline: React.FC<WeekTimelineProps> = ({ currentWeekId, masteryLevels, onSelectWeek }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Find index to determine progress filling
  const currentIndex = CURRICULUM_DATA.findIndex(w => w.id === currentWeekId);
  
  // Auto-scroll to selected week on change
  useEffect(() => {
    if (scrollContainerRef.current) {
        const selectedNode = scrollContainerRef.current.children[0].children[currentIndex] as HTMLElement;
        if (selectedNode) {
            selectedNode.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }
  }, [currentIndex]);

  return (
    <div className="w-full bg-slate-950/50 backdrop-blur-sm border-t border-slate-800/50 py-3 relative">
      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto no-scrollbar px-4 md:px-8 w-full"
      >
        <div className="flex items-center min-w-max space-x-0 relative">
          
            {/* Background Track Line */}
            <div className="absolute top-[15px] left-0 w-full h-0.5 bg-slate-800 -z-10 rounded-full" />
            
            {/* Active Progress Line Fill (Simulated by coloring segments) */}

          {CURRICULUM_DATA.map((week, index) => {
            const isCompleted = masteryLevels[week.id] > 80;
            const isCurrent = week.id === currentWeekId;
            const isUnlocked = index <= currentIndex || isCompleted || (index > 0 && masteryLevels[CURRICULUM_DATA[index-1].id] > 80);
            
            // Determine connector color to the NEXT node
            const isLineActive = index < currentIndex;

            return (
              <div key={week.id} className="group relative flex flex-col items-center min-w-[100px] cursor-pointer" onClick={() => onSelectWeek(week.id)}>
                
                {/* Connecting Line (Right side of node) */}
                {index < CURRICULUM_DATA.length - 1 && (
                    <div className="absolute top-[15px] left-[50%] w-full h-0.5 -z-10">
                        <motion.div 
                            initial={false}
                            animate={{ width: isLineActive ? '100%' : '0%' }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                        />
                    </div>
                )}

                {/* Node Circle */}
                <motion.div 
                  initial={false}
                  animate={{ 
                    scale: isCurrent ? 1.2 : 1,
                    backgroundColor: isCurrent ? '#083344' : isCompleted ? '#064e3b' : '#0f172a',
                    borderColor: isCurrent ? '#22d3ee' : isCompleted ? '#10b981' : isUnlocked ? '#475569' : '#1e293b'
                  }}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10
                    ${!isUnlocked && 'opacity-60'}
                  `}
                >
                  {isCompleted ? (
                    <Check size={14} className="text-emerald-400" />
                  ) : isCurrent ? (
                    <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                  ) : !isUnlocked ? (
                    <Lock size={12} className="text-slate-600" />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-200">{index + 1}</span>
                  )}
                </motion.div>

                {/* Text Label */}
                <div className={`
                    mt-2 px-2 py-1 rounded text-[10px] font-medium tracking-wide text-center transition-all duration-300 border border-transparent
                    ${isCurrent 
                        ? 'text-cyan-400 bg-cyan-950/30 border-cyan-900/50 shadow-sm' 
                        : isCompleted 
                            ? 'text-emerald-500' 
                            : 'text-slate-500 group-hover:text-slate-300'}
                `}>
                  <span className="block truncate max-w-[80px]">{week.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Fade Gradients for Scroll Hint */}
      <div className="absolute top-0 left-0 h-full w-8 bg-gradient-to-r from-slate-950 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />
    </div>
  );
};

export default WeekTimeline;