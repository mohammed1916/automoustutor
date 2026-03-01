const isImageMime = (mime = '') => mime.toLowerCase().startsWith('image/');

const toDataUrl = (mimeType, data) => `data:${mimeType};base64,${data}`;

const toOpenAIPart = (part) => {
  if (part.inlineData) {
    const { mimeType, data } = part.inlineData;
    if (isImageMime(mimeType)) {
      return {
        type: 'image_url',
        image_url: { url: toDataUrl(mimeType, data) }
      };
    }
    return {
      type: 'text',
      text: `[Attachment omitted: unsupported mime type "${mimeType}" for VLM endpoint]`
    };
  }
  return { type: 'text', text: part.text || '' };
};

const toOpenAIMessages = (systemInstruction, contents = []) => {
  const messages = [{ role: 'system', content: systemInstruction }];
  for (const item of contents) {
    messages.push({
      role: item.role === 'model' ? 'assistant' : 'user',
      content: (item.parts || []).map(toOpenAIPart)
    });
  }
  return messages;
};

const extractText = (messageContent) => {
  if (typeof messageContent === 'string') return messageContent;
  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
};

export const openaiCompatibleGenerate = async ({
  modelConfig,
  systemInstruction,
  contents,
  temperature = 0.2,
  responseMimeType
}) => {
  const baseUrl = (modelConfig.baseUrl || '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('Missing baseUrl for OpenAI-compatible provider');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${modelConfig.apiKey || 'local'}`
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: toOpenAIMessages(systemInstruction, contents),
      temperature,
      ...(responseMimeType === 'application/json'
        ? { response_format: { type: 'json_object' } }
        : {})
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI-compatible API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text = extractText(data?.choices?.[0]?.message?.content);
  return { text, raw: data };
};
