import { LocalModelStatus, SetupJob } from '../types';

export const fetchLocalModelStatuses = async (): Promise<LocalModelStatus[]> => {
  const response = await fetch('/api/local/models/status');
  if (!response.ok) {
    throw new Error(`Failed to fetch local model statuses (${response.status})`);
  }
  const data = await response.json();
  return data.models || [];
};

export const setupLocalModel = async (modelId: string): Promise<SetupJob> => {
  const response = await fetch('/api/local/models/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId })
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Failed to start setup (${response.status}): ${txt}`);
  }
  const data = await response.json();
  return data.job;
};

export const fetchSetupJob = async (jobId: string): Promise<SetupJob> => {
  const response = await fetch(`/api/local/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch setup job (${response.status})`);
  }
  const data = await response.json();
  return data.job;
};
