import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { CurriculumWeek } from '../types';

interface WeekTimelineProps {
  currentWeekId: string;
  masteryLevels: Record<string, number>;
  onSelectWeek: (weekId: string) => void;
  curriculum: CurriculumWeek[];
}

const WeekTimeline: React.FC<WeekTimelineProps> = ({ currentWeekId, masteryLevels, onSelectWeek, curriculum }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Find index to determine progress filling
  const currentIndex = curriculum.findIndex(w => w.id === currentWeekId);
  
  // Auto-scroll to selected week on change
  useEffect(() => {
    if (scrollContainerRef.current) {
        // Safety check for children access
        const wrapper = scrollContainerRef.current.children[0];
        if (wrapper && wrapper.children[currentIndex]) {
            const selectedNode = wrapper.children[currentIndex] as HTMLElement;
            selectedNode.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }
  }, [currentIndex, curriculum.length]);

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

          {curriculum.map((week, index) => {
            const mastery = masteryLevels[week.id] || 0;
            const isCompleted = mastery > 80;
            const isCurrent = week.id === currentWeekId;
            
            // Logic for unlocking:
            // 1. First week is always unlocked.
            // 2. If it's "Extra", it's unlocked if it was dynamically added.
            // 3. Otherwise, check previous week.
            let isUnlocked = false;
            if (index === 0) isUnlocked = true;
            else if (mastery > 0) isUnlocked = true; // If we have ANY progress (e.g. jumped here), unlock it
            else if (index > 0 && (masteryLevels[curriculum[index-1].id] || 0) > 80) isUnlocked = true;
            
            // If current, obviously unlocked
            if (isCurrent) isUnlocked = true;

            // Determine connector color to the NEXT node
            const isLineActive = index < currentIndex;

            return (
              <div key={week.id} className="group relative flex flex-col items-center min-w-[100px] cursor-pointer" onClick={() => onSelectWeek(week.id)}>
                
                {/* Connecting Line (Right side of node) */}
                {index < curriculum.length - 1 && (
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
                  <span className="block truncate max-w-[80px]" title={week.id}>{week.id}</span>
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
