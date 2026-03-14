import { loadEnvLocal } from '../utils/loadEnv.js';

loadEnvLocal();

const DEFAULT_OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const DEFAULT_OPENAI_COMPAT_BASE_URL = process.env.OPENAI_COMPAT_BASE_URL || 'http://127.0.0.1:1234/v1';

export const MODEL_REGISTRY = [
  {
    id: 'gemini-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    isLocal: false,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    supportsVision: true,
    supportsLive: true,
    apiKeyEnv: 'GEMINI_API_KEY'
  },
  {
    id: 'gemini-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    isLocal: false,
    model: process.env.GEMINI_LITE_MODEL || 'gemini-2.5-flash-lite-preview-09-2025',
    supportsVision: true,
    supportsLive: false,
    apiKeyEnv: 'GEMINI_API_KEY'
  },
  {
    id: 'ollama-qwen2.5vl-3b',
    label: 'Ollama Qwen2.5-VL 3B',
    provider: 'ollama',
    isLocal: true,
    runtime: 'ollama',
    model: process.env.OLLAMA_VLM_MODEL || 'qwen2.5vl:3b',
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    supportsVision: true,
    supportsLive: false
  },
  {
    id: 'ollama-gemma3-4b',
    label: 'Ollama Gemma 3 4B',
    provider: 'ollama',
    isLocal: true,
    runtime: 'ollama',
    model: process.env.OLLAMA_GEMMA_VLM_MODEL || 'gemma3:4b',
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    supportsVision: true,
    supportsLive: false
  },
  {
    id: 'ollama-moondream',
    label: 'Ollama Moondream 1.8B',
    provider: 'ollama',
    isLocal: true,
    runtime: 'ollama',
    model: process.env.OLLAMA_MOONDREAM_MODEL || 'moondream:1.8b',
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    supportsVision: true,
    supportsLive: false
  },
  {
    id: 'openai-compat-local',
    label: 'OpenAI-Compatible Local VLM',
    provider: 'openai_compatible',
    isLocal: true,
    runtime: 'openai_compatible',
    model: process.env.OPENAI_COMPAT_MODEL || 'qwen2.5-vl-3b-instruct',
    baseUrl: DEFAULT_OPENAI_COMPAT_BASE_URL,
    apiKey: process.env.OPENAI_COMPAT_API_KEY || 'lmstudio',
    supportsVision: true,
    supportsLive: false
  }
];

export const DEFAULT_MODEL_ID = process.env.DEFAULT_VLM_ID || 'gemini-flash';

export const getModelById = (modelId) => {
  if (!modelId) {
    return MODEL_REGISTRY.find((m) => m.id === DEFAULT_MODEL_ID) || MODEL_REGISTRY[0];
  }
  return MODEL_REGISTRY.find((m) => m.id === modelId) || MODEL_REGISTRY[0];
};

export const getPublicModels = () =>
  MODEL_REGISTRY.map(({ id, label, provider, model, supportsVision, supportsLive, isLocal, runtime, baseUrl }) => ({
    id,
    label,
    provider,
    model,
    supportsVision,
    supportsLive,
    isLocal: Boolean(isLocal),
    runtime: runtime || null,
    baseUrl: baseUrl || null
  }));
