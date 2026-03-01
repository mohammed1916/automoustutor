import { getModelById, getPublicModels } from '../config/modelRegistry.js';
import { createJob, getJob, updateJob } from './jobStore.js';
import { getOllamaModelStatus, setupOllamaModel } from './ollamaManager.js';
import { getOpenAICompatModelStatus, setupOpenAICompatModel } from './openAiCompatManager.js';

const getStatusForModel = async (model) => {
  if (!model.isLocal) {
    return { available: true, ready: true, installed: true, message: 'Remote provider.' };
  }
  if (model.runtime === 'ollama') {
    return getOllamaModelStatus(model);
  }
  if (model.runtime === 'openai_compatible') {
    return getOpenAICompatModelStatus(model);
  }
  return { available: false, ready: false, installed: false, message: 'Unsupported local runtime.' };
};

export const getLocalModelStatuses = async () => {
  const models = getPublicModels().filter((m) => m.isLocal);
  const statuses = await Promise.all(
    models.map(async (m) => ({
      modelId: m.id,
      ...m,
      status: await getStatusForModel(getModelById(m.id))
    }))
  );
  return statuses;
};

export const startLocalModelSetup = async (modelId) => {
  const model = getModelById(modelId);
  if (!model?.isLocal) {
    throw new Error('Model is not a local runtime model.');
  }

  const job = createJob('local_model_setup', { modelId: model.id });
  updateJob(job.id, { status: 'running', progress: 5, message: `Preparing setup for ${model.label}...` });

  (async () => {
    try {
      if (model.runtime === 'ollama') {
        await setupOllamaModel(model, job);
        return;
      }
      if (model.runtime === 'openai_compatible') {
        await setupOpenAICompatModel(model, job, updateJob);
        return;
      }
      updateJob(job.id, {
        status: 'failed',
        progress: 0,
        message: 'Unsupported runtime.',
        error: `Runtime ${model.runtime} is not supported.`
      });
    } catch (error) {
      updateJob(job.id, {
        status: 'failed',
        progress: 0,
        message: 'Setup failed.',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })();

  return job;
};

export const getSetupJob = (jobId) => getJob(jobId);
