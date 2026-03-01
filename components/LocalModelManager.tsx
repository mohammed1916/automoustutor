import React from 'react';
import { LocalModelStatus, SetupJob } from '../types';
import { Loader2, RefreshCcw, X } from 'lucide-react';

interface LocalModelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  models: LocalModelStatus[];
  isLoading: boolean;
  jobsByModelId: Record<string, SetupJob | undefined>;
  onRefresh: () => void;
  onSetup: (modelId: string) => void;
}

const statusPill = (model: LocalModelStatus) => {
  if (model.status.ready) return 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50';
  if (model.status.available) return 'bg-amber-900/40 text-amber-300 border-amber-700/50';
  return 'bg-red-900/40 text-red-300 border-red-700/50';
};

const statusLabel = (model: LocalModelStatus) => {
  if (model.status.ready) return 'Ready';
  if (model.status.available) return 'Runtime OK';
  return 'Runtime Missing';
};

const LocalModelManager: React.FC<LocalModelManagerProps> = ({
  isOpen,
  onClose,
  models,
  isLoading,
  jobsByModelId,
  onRefresh,
  onSetup
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-white font-bold text-lg">Local VLM Setup</h2>
            <p className="text-xs text-slate-400">Download and prepare local models from one place.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 flex items-center gap-2"
            >
              <RefreshCcw size={14} />
              Refresh
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
          {isLoading && (
            <div className="text-slate-300 text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Loading local model status...
            </div>
          )}

          {!isLoading && models.length === 0 && (
            <div className="text-slate-400 text-sm">No local models are configured.</div>
          )}

          {models.map((model) => {
            const job = jobsByModelId[model.modelId];
            const jobRunning = job?.status === 'running' || job?.status === 'queued';
            return (
              <div key={model.modelId} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{model.label}</div>
                    <div className="text-xs text-slate-400 font-mono">{model.model}</div>
                    <div className="text-xs text-slate-500 mt-1">Runtime: {model.runtime || model.provider}</div>
                  </div>
                  <div className={`text-[11px] px-2 py-1 rounded-full border ${statusPill(model)}`}>{statusLabel(model)}</div>
                </div>

                <div className="text-xs text-slate-400 mt-3">{model.status.message}</div>

                {job && (
                  <div className="mt-3 p-3 rounded-lg border border-slate-800 bg-black/30">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{job.message}</span>
                      <span className="text-slate-500">{job.progress}%</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded bg-slate-800 overflow-hidden">
                      <div className="h-full bg-cyan-500" style={{ width: `${Math.max(0, Math.min(100, job.progress || 0))}%` }} />
                    </div>
                    {job.error && <div className="mt-2 text-xs text-red-400">{job.error}</div>}
                  </div>
                )}

                <div className="mt-4">
                  <button
                    onClick={() => onSetup(model.modelId)}
                    disabled={jobRunning}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-cyan-700/60 bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {jobRunning ? <Loader2 size={14} className="animate-spin" /> : null}
                    {model.status.ready ? 'Reinstall / Update' : 'Auto Setup'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LocalModelManager;
