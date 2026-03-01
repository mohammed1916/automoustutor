const toGeminiParts = (parts = []) =>
  parts.map((part) => {
    if (part.inlineData) {
      return {
        inline_data: {
          mime_type: part.inlineData.mimeType,
          data: part.inlineData.data
        }
      };
    }
    return { text: part.text || '' };
  });

const toGeminiContents = (contents = []) =>
  contents.map((item) => ({
    role: item.role === 'model' ? 'model' : 'user',
    parts: toGeminiParts(item.parts || [])
  }));

export const geminiGenerate = async ({
  modelConfig,
  systemInstruction,
  contents,
  temperature = 0.2,
  responseMimeType
}) => {
  const apiKey = process.env[modelConfig.apiKeyEnv || 'GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error(`Missing API key env var: ${modelConfig.apiKeyEnv || 'GEMINI_API_KEY'}`);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelConfig.model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature,
        ...(responseMimeType ? { responseMimeType } : {})
      },
      contents: toGeminiContents(contents)
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text)
      .filter(Boolean)
      .join('\n') || '';

  return { text, raw: data };
};
