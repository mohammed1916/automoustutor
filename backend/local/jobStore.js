const JOBS = new Map();

export const createJob = (type, payload = {}) => {
  const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const job = {
    id,
    type,
    status: 'queued',
    progress: 0,
    message: 'Queued',
    logs: [],
    payload,
    createdAt: now,
    updatedAt: now,
    result: null,
    error: null
  };
  JOBS.set(id, job);
  return job;
};

export const updateJob = (id, partial) => {
  const current = JOBS.get(id);
  if (!current) return null;
  const next = {
    ...current,
    ...partial,
    logs: partial.logs ? partial.logs : current.logs,
    updatedAt: Date.now()
  };
  JOBS.set(id, next);
  return next;
};

export const appendJobLog = (id, line) => {
  const current = JOBS.get(id);
  if (!current) return null;
  const logs = [...current.logs, line].slice(-80);
  return updateJob(id, { logs });
};

export const getJob = (id) => JOBS.get(id) || null;
