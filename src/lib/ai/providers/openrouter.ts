// ============================================================
// ARCTIS AI Provider Layer — Server-side only
// Supports OpenRouter, Groq, Gemini
// Keys NEVER exposed to client
// ============================================================

export type AIProviderName = 'openrouter' | 'groq' | 'gemini';

export interface AIRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | AIContent[] }>;
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface AIContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProviderName;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  creditsUsed: number;
}

// ─── OpenRouter ─────────────────────────────────────────────
export async function callOpenRouter(req: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const msgs = req.systemPrompt
    ? [{ role: 'system' as const, content: req.systemPrompt }, ...req.messages]
    : req.messages;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'ARCTIS',
    },
    body: JSON.stringify({
      model: req.model,
      messages: msgs,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const usage = data.usage ?? {};

  return {
    content: data.choices?.[0]?.message?.content ?? '',
    model: req.model,
    provider: 'openrouter',
    usage: {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
    },
    creditsUsed: Math.ceil((usage.total_tokens ?? 0) / 1000),
  };
}

// ─── Streaming OpenRouter ───────────────────────────────────
export async function streamOpenRouter(
  req: AIRequest,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<AIResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const msgs = req.systemPrompt
    ? [{ role: 'system' as const, content: req.systemPrompt }, ...req.messages]
    : req.messages;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'ARCTIS',
    },
    body: JSON.stringify({
      model: req.model,
      messages: msgs,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) throw new Error(`OpenRouter stream ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let full = '';
  let promptTokens = 0;
  let completionTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          onChunk(delta);
        }
        if (parsed.usage) {
          promptTokens = parsed.usage.prompt_tokens ?? 0;
          completionTokens = parsed.usage.completion_tokens ?? 0;
        }
      } catch { /* skip malformed */ }
    }
  }

  return {
    content: full,
    model: req.model,
    provider: 'openrouter',
    usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
    creditsUsed: Math.ceil((promptTokens + completionTokens) / 1000),
  };
}
