import http from 'node:http';
import { analyzeCurriculumIntent } from './services/routingService.js';
import { generateAgentReply } from './services/agentService.js';
import { DEFAULT_MODEL_ID, getModelById, getPublicModels } from './config/modelRegistry.js';
import { getLocalModelStatuses, getSetupJob, startLocalModelSetup } from './local/runtimeManager.js';
import { notFound, parseJsonBody, sendJson, setCorsHeaders } from './utils/http.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      return notFound(res);
    }
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;

    if (req.method === 'OPTIONS') {
      setCorsHeaders(res);
      res.writeHead(204);
      return res.end();
    }

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, defaultModelId: DEFAULT_MODEL_ID });
    }

    if (req.method === 'GET' && pathname === '/api/models') {
      return sendJson(res, 200, { models: getPublicModels(), defaultModelId: DEFAULT_MODEL_ID });
    }

    if (req.method === 'GET' && pathname === '/api/local/models/status') {
      const models = await getLocalModelStatuses();
      return sendJson(res, 200, { models });
    }

    if (req.method === 'POST' && pathname === '/api/local/models/setup') {
      const body = await parseJsonBody(req);
      if (!body?.modelId) {
        return sendJson(res, 400, { error: 'modelId is required' });
      }
      const job = await startLocalModelSetup(body.modelId);
      return sendJson(res, 202, { job });
    }

    if (req.method === 'GET' && pathname.startsWith('/api/local/jobs/')) {
      const jobId = pathname.split('/').pop();
      const job = getSetupJob(jobId);
      if (!job) return sendJson(res, 404, { error: 'Job not found' });
      return sendJson(res, 200, { job });
    }

    if (req.method === 'POST' && pathname === '/api/agent/chat') {
      const body = await parseJsonBody(req);
      const modelConfig = getModelById(body.modelId);
      const result = await generateAgentReply({
        userMessage: body.userMessage,
        currentState: body.currentState,
        chatHistory: body.chatHistory || [],
        attachmentBase64: body.attachmentBase64,
        curriculum: body.curriculum || [],
        modelConfig
      });
      return sendJson(res, 200, result);
    }

    if (req.method === 'POST' && pathname === '/api/agent/route') {
      const body = await parseJsonBody(req);
      const modelConfig = getModelById(body.modelId);
      const result = await analyzeCurriculumIntent({
        userMessage: body.userMessage,
        currentCurriculum: body.currentCurriculum || [],
        attachmentBase64: body.attachmentBase64,
        modelConfig
      });
      return sendJson(res, 200, result);
    }

    return notFound(res);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`VLM backend listening on http://${HOST}:${PORT}`);
});
