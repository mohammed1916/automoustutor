import { ModelInfo } from '../types';

const MODEL_STORAGE_KEY = 'math_agent_model_id';

export const getStoredModelId = () => localStorage.getItem(MODEL_STORAGE_KEY);

export const setStoredModelId = (modelId: string) => {
  localStorage.setItem(MODEL_STORAGE_KEY, modelId);
};

export const fetchModels = async (): Promise<{ models: ModelInfo[]; defaultModelId: string }> => {
  const response = await fetch('/api/models');
  if (!response.ok) {
    throw new Error(`Failed to fetch models (${response.status})`);
  }
  return response.json();
};
