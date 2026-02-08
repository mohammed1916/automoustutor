import React from 'react';
import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { CurriculumWeek } from '../types';

interface TopicSidebarProps {
  currentWeekId: string;
  focusTopic: string;
  onTopicClick: (topic: string) => void;
  curriculum: CurriculumWeek[];
}

const TopicSidebar: React.FC<TopicSidebarProps> = ({ currentWeekId, focusTopic, onTopicClick, curriculum }) => {
  const currentWeekData = curriculum.find(w => w.id === currentWeekId);

  if (!currentWeekData) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Layers size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">Sub-Concepts</span>
        </div>
        <h2 className="text-base font-bold text-slate-100 leading-snug">{currentWeekData.title}</h2>
      </div>
      
      {/* List */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1 custom-scrollbar">
        {currentWeekData.topics.map((topic, idx) => {
            const isActive = topic === focusTopic;
            return (
                <motion.button
                    key={idx}
                    onClick={() => onTopicClick(topic)}
                    whileHover={{ x: 2, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                        w-full text-left p-3 rounded-lg text-sm transition-all duration-200 flex items-start gap-3 group border
                        ${isActive 
                            ? 'bg-slate-800 border-cyan-900/50 shadow-sm' 
                            : 'border-transparent hover:border-slate-800 text-slate-400 hover:text-slate-200'}
                    `}
                >
                    <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 text-[10px] font-mono border ${isActive ? 'bg-cyan-950 border-cyan-800 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                        {idx + 1}
                    </div>
                    <div className="flex-1">
                        <span className={`block leading-tight ${isActive ? 'text-cyan-100 font-medium' : ''}`}>
                            {topic}
                        </span>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shadow-[0_0_5px_rgba(34,211,238,0.8)]" />}
                </motion.button>
            )
        })}
      </div>
      
      {/* Footer / Tip */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/30">
         <div className="flex gap-2">
             <div className="mt-0.5">
                 <div className="w-1 h-full min-h-[20px] bg-slate-700 rounded-full" />
             </div>
             <p className="text-[10px] text-slate-500 leading-relaxed">
                Clicking a topic directs the agent to focus its next lesson or assessment on that specific concept.
             </p>
         </div>
      </div>
    </div>
  );
};

export default TopicSidebar;
