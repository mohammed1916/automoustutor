import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Lock, Unlock } from 'lucide-react';
import { CURRICULUM_DATA } from '../constants';

interface WeekTimelineProps {
  currentWeekId: string;
  masteryLevels: Record<string, number>;
  onSelectWeek: (weekId: string) => void;
}

const WeekTimeline: React.FC<WeekTimelineProps> = ({ currentWeekId, masteryLevels, onSelectWeek }) => {
  // Find index to determine progress filling
  const currentIndex = CURRICULUM_DATA.findIndex(w => w.id === currentWeekId);
  
  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 pt-4 pb-2">
      <div className="overflow-x-auto no-scrollbar px-4 pb-2">
        <div className="flex items-center min-w-max space-x-2">
          {CURRICULUM_DATA.map((week, index) => {
            const isCompleted = masteryLevels[week.id] > 80;
            const isCurrent = week.id === currentWeekId;
            const isFuture = index > currentIndex && !isCompleted && masteryLevels[week.id] === 0;
            
            // Calculate exact fill status for visual timeline connector
            // Simple logic: if index < currentIndex, it's "past".
            
            return (
              <div key={week.id} className="group relative flex flex-col items-center gap-2 cursor-pointer" onClick={() => onSelectWeek(week.id)}>
                
                {/* Timeline Connector Line (Left) */}
                {index > 0 && (
                   <div className={`absolute top-4 -left-[50%] w-full h-0.5 -z-0 ${index <= currentIndex ? 'bg-cyan-900' : 'bg-slate-800'}`}>
                     {index <= currentIndex && (
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          className="h-full bg-cyan-600 shadow-[0_0_10px_rgba(8,145,178,0.5)]"
                        />
                     )}
                   </div>
                )}

                {/* Node */}
                <motion.div 
                  className={`
                    relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                    ${isCurrent 
                        ? 'bg-cyan-950 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)] scale-110' 
                        : isCompleted 
                            ? 'bg-emerald-950/50 border-emerald-600 text-emerald-500' 
                            : 'bg-slate-900 border-slate-700 text-slate-600 hover:border-slate-500'}
                  `}
                  whileHover={{ scale: 1.1 }}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={14} />
                  ) : isFuture ? (
                    <Lock size={12} />
                  ) : (
                    <span className="text-[10px] font-bold">{index + 1}</span>
                  )}
                </motion.div>

                {/* Label */}
                <div className={`
                    text-[10px] font-medium tracking-wide w-20 text-center truncate transition-colors duration-300
                    ${isCurrent ? 'text-cyan-400' : isCompleted ? 'text-emerald-500' : 'text-slate-600'}
                `}>
                  {week.id}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeekTimeline;
