import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { LearnerState, ParsedAgentResponse } from '../types';
import { Brain, Activity, Target, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface DashboardProps {
  state: LearnerState;
  lastAgentResponse: ParsedAgentResponse | null;
}

const Dashboard: React.FC<DashboardProps> = ({ state, lastAgentResponse }) => {
  const chartData = Object.entries(state.masteryLevels).map(([week, score]) => ({
    subject: week,
    A: score,
    fullMark: 100,
  }));

  return (
    <div className="h-full bg-slate-900 border-l border-slate-700 flex flex-col overflow-y-auto text-slate-200">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/50">
        <h2 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
          <Brain className="w-6 h-6" />
          Neural State
        </h2>
        <p className="text-xs text-slate-400 mt-1">Autonomous Adaptive Agent v1.0</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 p-4">
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Target className="w-3 h-3" /> Focus
          </div>
          <div className="font-semibold text-sm truncate" title={state.focusTopic}>
            {state.focusTopic}
          </div>
          <div className="text-xs text-cyan-500 mt-1">{state.currentWeek}</div>
        </div>
        
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
           <div className="text-xs text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Action
          </div>
          <div className="font-semibold text-sm">
            {state.lastAction || 'IDLE'}
          </div>
        </div>
      </div>

      {/* Knowledge Graph */}
      <div className="flex-1 min-h-[300px] p-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center">Mastery Map</h3>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                name="Mastery"
                dataKey="A"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="#06b6d4"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Internal Thought Process (Debug View) */}
      <div className="p-4 border-t border-slate-700 bg-slate-900">
        <h3 className="text-xs font-bold text-amber-500 uppercase mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Internal Monologue
        </h3>
        
        {lastAgentResponse ? (
          <div className="space-y-4 text-xs font-mono">
            <div>
              <div className="text-slate-500 mb-1">RATIONALE</div>
              <div className="bg-slate-800 p-3 rounded border border-slate-700 leading-relaxed opacity-90 overflow-x-auto">
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:p-2 prose-pre:rounded-sm">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {lastAgentResponse.rationale}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
            
            <div>
              <div className="text-green-500/80 mb-1 font-bold text-[10px] uppercase tracking-wider">Verification</div>
              <div className="bg-slate-800 p-3 rounded border border-green-900/30 overflow-x-auto">
                 <div className="prose prose-invert prose-sm max-w-none prose-p:text-green-100 prose-strong:text-green-400">
                   <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {lastAgentResponse.verification}
                  </ReactMarkdown>
                 </div>
              </div>
            </div>

            <div>
              <div className="text-purple-500/80 mb-1 font-bold text-[10px] uppercase tracking-wider">Next Intent</div>
              <div className="bg-slate-800 p-3 rounded border border-purple-900/30 overflow-x-auto">
                 <div className="prose prose-invert prose-sm max-w-none prose-p:text-purple-100">
                   <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {lastAgentResponse.nextIntent}
                  </ReactMarkdown>
                 </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-slate-600 text-center py-8 italic text-sm">
            Waiting for agent activation...
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;