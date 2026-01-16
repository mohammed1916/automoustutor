import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Disc } from 'lucide-react';
import { CURRICULUM_DATA } from '../constants';

interface TopicSidebarProps {
  currentWeekId: string;
  focusTopic: string;
  onTopicClick: (topic: string) => void;
}

const TopicSidebar: React.FC<TopicSidebarProps> = ({ currentWeekId, focusTopic, onTopicClick }) => {
  const currentWeekData = CURRICULUM_DATA.find(w => w.id === currentWeekId);

  if (!currentWeekData) return null;

  return (
    <div className="h-full bg-slate-900 border-r border-slate-800 flex flex-col w-64 shrink-0">
      <div className="p-4 border-b border-slate-800 bg-slate-950/50">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Curriculum</h3>
        <h2 className="text-lg font-bold text-slate-100 leading-tight">{currentWeekData.title}</h2>
        <p className="text-xs text-slate-500 mt-2">{currentWeekData.description}</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {currentWeekData.topics.map((topic, idx) => {
            const isActive = topic === focusTopic;
            return (
                <motion.button
                    key={idx}
                    onClick={() => onTopicClick(topic)}
                    whileHover={{ x: 4 }}
                    className={`
                        w-full text-left p-3 rounded-lg text-sm transition-all duration-200 flex items-center justify-between group
                        ${isActive 
                            ? 'bg-cyan-950/50 text-cyan-400 border border-cyan-900/50' 
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'}
                    `}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-slate-700 group-hover:bg-slate-500'}`} />
                        <span className="truncate w-40">{topic}</span>
                    </div>
                    {isActive && <ChevronRight size={14} className="opacity-80" />}
                </motion.button>
            )
        })}
      </div>
      
      <div className="p-4 border-t border-slate-800">
         <div className="p-3 rounded bg-slate-800/50 border border-slate-700 text-xs text-slate-400 leading-relaxed">
            <span className="text-cyan-500 font-bold block mb-1">Agent Strategy:</span>
            Select a subconcept to explicitly direct the agent's focus for the next interaction.
         </div>
      </div>
    </div>
  );
};

export default TopicSidebar;
