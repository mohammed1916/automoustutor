export const getOpenAICompatModelStatus = async () => ({
  available: false,
  ready: false,
  installed: false,
  message: 'Auto-download is not supported for generic OpenAI-compatible runtimes.'
});

export const setupOpenAICompatModel = async (modelConfig, job, updateJob) => {
  updateJob(job.id, {
    status: 'failed',
    progress: 0,
    message: 'Auto-setup unavailable.',
    error: `Set up your OpenAI-compatible runtime manually and load model "${modelConfig.model}".`
  });
};
