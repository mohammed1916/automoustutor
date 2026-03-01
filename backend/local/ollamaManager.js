import { spawn } from 'node:child_process';
import { appendJobLog, updateJob } from './jobStore.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseBaseUrl = (baseUrl) => {
  try {
    return new URL(baseUrl || 'http://127.0.0.1:11434');
  } catch {
    return new URL('http://127.0.0.1:11434');
  }
};

const checkOllamaBinary = async () =>
  new Promise((resolve) => {
    const child = spawn('ollama', ['--version']);
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });

const fetchTags = async (baseUrl) => {
  const url = new URL('/api/tags', parseBaseUrl(baseUrl));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Ollama tags request failed (${response.status})`);
  return response.json();
};

const ensureOllamaRunning = async (baseUrl) => {
  try {
    await fetchTags(baseUrl);
    return true;
  } catch {
    // Try to start serve in background.
    const detached = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    });
    detached.unref();

    for (let i = 0; i < 12; i++) {
      await sleep(500);
      try {
        await fetchTags(baseUrl);
        return true;
      } catch {
        // Keep waiting.
      }
    }
    return false;
  }
};

const pullModel = async (baseUrl, modelName, jobId) =>
  new Promise((resolve, reject) => {
    const child = spawn('ollama', ['pull', modelName], {
      env: { ...process.env, OLLAMA_HOST: parseBaseUrl(baseUrl).host }
    });

    child.stdout.on('data', (data) => {
      const text = String(data).trim();
      if (!text) return;
      appendJobLog(jobId, text);
      updateJob(jobId, { status: 'running', message: `Downloading ${modelName}...`, progress: 55 });
    });

    child.stderr.on('data', (data) => {
      const text = String(data).trim();
      if (!text) return;
      appendJobLog(jobId, text);
    });

    child.on('error', (error) => reject(error));
    child.on('exit', (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(`ollama pull exited with code ${code}`));
    });
  });

export const getOllamaModelStatus = async (modelConfig) => {
  const binaryInstalled = await checkOllamaBinary();
  if (!binaryInstalled) {
    return {
      available: false,
      ready: false,
      installed: false,
      message: 'Ollama CLI not found. Install Ollama first.'
    };
  }

  const reachable = await ensureOllamaRunning(modelConfig.baseUrl);
  if (!reachable) {
    return {
      available: false,
      ready: false,
      installed: false,
      message: 'Ollama is installed but not reachable on local endpoint.'
    };
  }

  const tags = await fetchTags(modelConfig.baseUrl);
  const names = (tags?.models || []).map((m) => m.name);
  const installed = names.includes(modelConfig.model);
  return {
    available: true,
    ready: installed,
    installed,
    message: installed ? 'Installed and ready.' : 'Not downloaded yet.'
  };
};

export const setupOllamaModel = async (modelConfig, job) => {
  updateJob(job.id, { status: 'running', progress: 10, message: 'Checking Ollama runtime...' });

  const binaryInstalled = await checkOllamaBinary();
  if (!binaryInstalled) {
    updateJob(job.id, {
      status: 'failed',
      progress: 0,
      message: 'Ollama is not installed.',
      error: 'Ollama CLI not found. Install from https://ollama.com/download'
    });
    return;
  }

  const reachable = await ensureOllamaRunning(modelConfig.baseUrl);
  if (!reachable) {
    updateJob(job.id, {
      status: 'failed',
      progress: 0,
      message: 'Could not start/connect to Ollama.',
      error: 'Unable to reach Ollama API.'
    });
    return;
  }

  updateJob(job.id, { progress: 35, message: 'Connected to Ollama runtime.' });
  await pullModel(modelConfig.baseUrl, modelConfig.model, job.id);

  updateJob(job.id, {
    status: 'completed',
    progress: 100,
    message: `Model ${modelConfig.model} is ready.`,
    result: { model: modelConfig.model, runtime: 'ollama' }
  });
};
