import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, ChevronRight, Award } from 'lucide-react';

interface CourseCardProps {
  onStart: () => void;
  progress: number;
}

const CourseCard: React.FC<CourseCardProps> = ({ onStart, progress }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className="bg-slate-900 border border-slate-700 rounded-2xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden group cursor-pointer"
      onClick={onStart}
    >
      {/* Background Gradient */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all duration-500"></div>

      <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
        {/* Icon/Image Placehoder */}
        <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-cyan-900 to-slate-800 flex items-center justify-center border border-slate-700 shadow-lg shrink-0">
          <BookOpen className="w-12 h-12 text-cyan-400" />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
               <span className="px-2 py-0.5 rounded-full bg-cyan-900/50 text-cyan-400 text-[10px] font-bold tracking-wider uppercase border border-cyan-800">
                  Adaptive Curriculum
               </span>
               <span className="px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 text-[10px] font-bold tracking-wider uppercase border border-emerald-800 flex items-center gap-1">
                  <Award size={10} /> Certified
               </span>
            </div>
            <h2 className="text-3xl font-bold text-slate-100">Mathematics I</h2>
            <p className="text-slate-400 mt-2 text-sm leading-relaxed">
              Master the foundations of undergraduate mathematics through an autonomous, adaptive AI agent that evolves with your learning pace.
            </p>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-500" />
              <span>11 Weeks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>Live Agent</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <span>Overall Progress</span>
              <span className="text-cyan-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-cyan-600 to-emerald-500 rounded-full"
              />
            </div>
          </div>
        </div>
        
        <div className="hidden md:flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-500/50 transition-all duration-300">
                <ChevronRight size={24} />
            </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CourseCard;
