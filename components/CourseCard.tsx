import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, ChevronRight, Play, BarChart3, Clock } from 'lucide-react';

interface CourseCardProps {
  onStart: () => void;
  progress: number;
  title?: string;
  subtitle?: string;
}

const CourseCard: React.FC<CourseCardProps> = ({ onStart, progress, title = "Mathematics I", subtitle = "Undergraduate Curriculum" }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="group relative w-full max-w-3xl bg-slate-900/50 backdrop-blur-xl border border-slate-800 hover:border-cyan-500/50 rounded-3xl p-8 overflow-hidden cursor-pointer transition-all duration-500 shadow-2xl hover:shadow-[0_0_40px_rgba(8,145,178,0.2)]"
      onClick={onStart}
    >
      {/* Decorative Background Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/10 via-slate-900/0 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative z-10 flex flex-col md:flex-row gap-8">

        {/* Left: Icon & Badge */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300 group-hover:border-cyan-500/30">
            <BookOpen className="w-10 h-10 text-cyan-400" />
          </div>
          <div className="px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-900/50 text-cyan-400 text-xs font-bold tracking-wider uppercase shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            Active Course
          </div>
        </div>

        {/* Center: Details */}
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div>
            <h2 className="text-3xl font-bold text-slate-100 group-hover:text-white transition-colors">{title}</h2>
            <h3 className="text-lg text-slate-400 font-medium">{subtitle}</h3>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-slate-500 py-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>11 Weeks</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Self-Paced</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span>Adaptive Difficulty</span>
            </div>
          </div>

          {/* Progress Bar Container */}
          <div className="space-y-2 max-w-md">
            <div className="flex justify-between text-xs font-semibold uppercase tracking-wider">
              <span className="text-slate-500">Mastery Progress</span>
              <span className="text-cyan-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1.5, delay: 0.2, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
              />
            </div>
          </div>
        </div>

        {/* Right: Action Button */}
        <div className="flex items-center justify-center md:justify-end">
          <button className="w-14 h-14 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-lg shadow-cyan-900/50 group-hover:scale-110 transition-all duration-300">
            <Play className="w-6 h-6 ml-1 fill-current" />
          </button>
        </div>

      </div>
    </motion.div>
  );
};

export default CourseCard;