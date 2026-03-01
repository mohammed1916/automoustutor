<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/13iB8yPmXKpqeZFQeHrDECJWZTJIzMwLS

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Create `.env.local` (frontend + backend config):
   ```bash
   GEMINI_API_KEY=your_key_here
   # Optional defaults:
   # DEFAULT_VLM_ID=gemini-flash
   # OLLAMA_BASE_URL=http://127.0.0.1:11434
   # OLLAMA_VLM_MODEL=qwen2.5vl:3b
   # OPENAI_COMPAT_BASE_URL=http://127.0.0.1:1234/v1
   # OPENAI_COMPAT_MODEL=qwen2.5-vl-3b-instruct
   ```
3. Start backend API:
   `npm run dev:backend`
4. Start frontend (new terminal):
   `npm run dev`
5. Open `http://localhost:3000`.

## Model Selection (UI + Backend)

- UI model selector lives in the course top bar (`Model` dropdown).
- `Local Setup` button opens a dedicated local model manager modal.
- Selection is persisted in local storage.
- Every agent + routing request uses the selected model.
- Backend routes:
  - `GET /api/models`
  - `POST /api/agent/chat`
  - `POST /api/agent/route`
  - `GET /api/local/models/status`
  - `POST /api/local/models/setup`
  - `GET /api/local/jobs/:jobId`

## Backend Modularity

```
backend/
  config/modelRegistry.js
  local/
    runtimeManager.js
    ollamaManager.js
    openAiCompatManager.js
    jobStore.js
  providers/
    geminiProvider.js
    openaiCompatibleProvider.js
    providerFactory.js
  services/
    agentService.js
    routingService.js
  utils/http.js
  server.js
```

- Add/edit models in `backend/config/modelRegistry.js`.
- Provider-specific logic stays isolated in `backend/providers/*`.
- Higher-level prompt + parsing pipeline stays in `backend/services/*`.
- Local runtime setup is isolated in `backend/local/*` (modular by runtime).

## Local Auto Setup Flow

1. Open `Local Setup` in UI.
2. Click `Auto Setup` on a local model (for example `Ollama Qwen2.5-VL 3B`).
3. Backend automatically:
   - checks local runtime availability,
   - starts runtime if possible (`ollama serve`),
   - downloads the selected model (`ollama pull ...`),
   - returns job progress for polling.
4. Once status is `Ready`, select that model from the main model dropdown.

Notes:
- Auto download/setup is fully supported for Ollama models.
- For generic OpenAI-compatible local runtimes, auto download cannot be guaranteed universally, so setup remains manual.

## Lightweight VLMs to run locally

Good first options (small/efficient):
- `moondream:1.8b`
- `qwen2.5vl:3b`
- `gemma3:4b`
- `llava` 7B class models

### Example: Ollama pipeline
1. Install and run [Ollama](https://ollama.com/).
2. Pull a model:
   - `ollama pull qwen2.5vl:3b`
   - or `ollama pull moondream:1.8b`
3. Set `.env.local`:
   - `DEFAULT_VLM_ID=ollama-qwen2.5vl-3b`
4. Start backend + frontend.
5. Pick the same model from UI dropdown.

### Example: OpenAI-compatible local servers

Use LM Studio / vLLM exposing `/v1/chat/completions`, then set:
- `DEFAULT_VLM_ID=openai-compat-local`
- `OPENAI_COMPAT_BASE_URL=http://127.0.0.1:1234/v1`
- `OPENAI_COMPAT_MODEL=qwen2.5-vl-3b-instruct`

## References used for model/pipeline choices

- Ollama vision capability: https://docs.ollama.com/capabilities/vision
- Ollama OpenAI compatibility: https://docs.ollama.com/openai
- Ollama library (Qwen2.5-VL): https://ollama.com/library/qwen2.5vl
- Ollama library (Moondream): https://ollama.com/library/moondream
- Ollama library (Gemma 3): https://ollama.com/library/gemma3
- Ollama library (LLaVA): https://ollama.com/library/llava
- Hugging Face SmolVLM: https://huggingface.co/blog/smolvlm
- vLLM multimodal docs: https://docs.vllm.ai/en/latest/features/multimodal_inputs.html
