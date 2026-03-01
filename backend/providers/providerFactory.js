import { geminiGenerate } from './geminiProvider.js';
import { openaiCompatibleGenerate } from './openaiCompatibleProvider.js';

export const generateWithProvider = async (input) => {
  const provider = input?.modelConfig?.provider;

  if (provider === 'gemini') {
    return geminiGenerate(input);
  }

  if (provider === 'ollama' || provider === 'openai_compatible') {
    return openaiCompatibleGenerate(input);
  }

  throw new Error(`Unsupported provider: ${provider}`);
};
