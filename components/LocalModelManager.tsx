import React from 'react';
import { LocalModelStatus, SetupJob } from '../types';
import { Loader2, RefreshCcw, X } from 'lucide-react';

interface LocalModelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  models: LocalModelStatus[];
  isLoading: boolean;
  jobsByModelId: Record<string, SetupJob | undefined>;
  selectedModelId: string;
  onRefresh: () => void;
  onSetup: (modelId: string) => void;
  onSelectModel: (modelId: string) => void;
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

const getGuidance = (model: LocalModelStatus) => {
  const endpoint = model.baseUrl || 'http://127.0.0.1:11434';

  switch (model.status.issue) {
    case 'missing_cli':
      return {
        tone: 'border-amber-800/60 bg-amber-950/20 text-amber-200',
        title: 'Install Ollama first',
        steps: [
          'Install Ollama on this machine.',
          'Open Ollama once so the local runtime is available.',
          `Come back and refresh status for ${endpoint}.`
        ]
      };
    case 'endpoint_unreachable':
      return {
        tone: 'border-orange-800/60 bg-orange-950/20 text-orange-200',
        title: 'Ollama is installed, but the API is not reachable',
        steps: [
          `Expected endpoint: ${endpoint}`,
          'Start Ollama or run `ollama serve` in a terminal.',
          'If you changed the host, update `OLLAMA_BASE_URL` to match it and refresh.'
        ]
      };
    case 'model_missing':
      return {
        tone: 'border-cyan-800/60 bg-cyan-950/20 text-cyan-200',
        title: 'Runtime is healthy, model still needs to be downloaded',
        steps: [
          `Auto Setup will run \`ollama pull ${model.model}\`.`,
          'You can also pull it manually in a terminal if you prefer.',
          'When the download finishes, select this model and start chatting.'
        ]
      };
    case 'manual_setup_required':
      return {
        tone: 'border-slate-700 bg-slate-950/30 text-slate-300',
        title: 'Manual runtime setup required',
        steps: [
          `Start a local OpenAI-compatible server at ${model.baseUrl || 'your configured /v1 endpoint'}.`,
          `Load the model named ${model.model}.`,
          'Then refresh this screen and choose the model from the selector.'
        ]
      };
    case 'ready':
      return {
        tone: 'border-emerald-800/60 bg-emerald-950/20 text-emerald-200',
        title: 'Local model is ready',
        steps: [
          `Endpoint: ${endpoint}`,
          'You can switch to this model now.',
          'If you want a fresh pull, use Reinstall / Update.'
        ]
      };
    default:
      return {
        tone: 'border-slate-700 bg-slate-950/30 text-slate-300',
        title: 'Status details',
        steps: [model.status.message]
      };
  }
};

const getSetupLabel = (model: LocalModelStatus) => {
  if (model.status.issue === 'missing_cli') return 'Install Ollama First';
  if (model.status.issue === 'endpoint_unreachable') return 'Retry Ollama Check';
  if (model.status.ready) return 'Reinstall / Update';
  if (model.status.issue === 'manual_setup_required') return 'Manual Setup';
  return 'Auto Setup';
};

const LocalModelManager: React.FC<LocalModelManagerProps> = ({
  isOpen,
  onClose,
  models,
  isLoading,
  jobsByModelId,
  selectedModelId,
  onRefresh,
  onSetup,
  onSelectModel
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
            const guidance = getGuidance(model);
            const isSelected = selectedModelId === model.modelId;
            const setupDisabled = jobRunning || model.status.issue === 'manual_setup_required' || model.status.issue === 'missing_cli';
            return (
              <div key={model.modelId} className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{model.label}</div>
                    <div className="text-xs text-slate-400 font-mono">{model.model}</div>
                    <div className="text-xs text-slate-500 mt-1">Runtime: {model.runtime || model.provider}</div>
                    {model.baseUrl && <div className="text-xs text-slate-500 font-mono mt-1">Endpoint: {model.baseUrl}</div>}
                  </div>
                  <div className={`text-[11px] px-2 py-1 rounded-full border ${statusPill(model)}`}>{statusLabel(model)}</div>
                </div>

                <div className="text-xs text-slate-400 mt-3">{model.status.message}</div>

                <div className={`mt-3 rounded-lg border p-3 text-xs ${guidance.tone}`}>
                  <div className="font-semibold text-sm mb-2">{guidance.title}</div>
                  <div className="space-y-1.5">
                    {guidance.steps.map((step) => (
                      <div key={step}>{step}</div>
                    ))}
                  </div>
                </div>

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

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => onSetup(model.modelId)}
                    disabled={setupDisabled}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-cyan-700/60 bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {jobRunning ? <Loader2 size={14} className="animate-spin" /> : null}
                    {getSetupLabel(model)}
                  </button>
                  <button
                    onClick={() => onSelectModel(model.modelId)}
                    disabled={!model.status.ready}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-700/60 bg-emerald-900/20 text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSelected ? 'Currently Selected' : 'Use This Model'}
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
