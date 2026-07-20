// Solver provider: Groq (OpenAI-compatible API).

// Groq vision-capable models — try in order, skip any that 404 (Groq retires
// models regularly; the Llama 4 vision models are already gone).
const GROQ_MODELS = [
  process.env.GROQ_MODEL,
  'qwen/qwen3.6-27b',
].filter(Boolean);

// If every hardcoded model has been retired, ask Groq which active models can
// take image input and use the first one, so retirements no longer break us.
async function discoverGroqVisionModel(apiKey) {
  const resp = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!resp.ok) return null;
  const { data } = await resp.json();
  const model = (data || []).find(
    (m) => m.active && (m.input_modalities || []).includes('image')
  );
  return model?.id || null;
}

const PROMPT = `You are looking at an image exported from a handwritten/drawn notes canvas.
Find any question, math expression, or problem in the image and solve it.

Rules:
- If it is a math expression — possibly ending in "=" or "=?" like "2 + 2 =", "5 x 3 =?" or just "3 x 4" — return only the final result in "answer" (e.g. "4", "15", "12"). The answer is drawn onto the canvas right after the "=" sign, so it must contain the result only, never restate the question.
- For any other question (science, general knowledge, word problems), give a short, direct final answer in "answer".
- Put a fuller explanation or working steps in "solution". Keep it concise.
- If the image has no readable question, set answer to "" and explain briefly in "solution".
- Respond with a JSON object of the form {"answer": string, "solution": string}.`;

class SolverError extends Error {
  constructor(userMessage, status = 502) {
    super(userMessage);
    this.userMessage = userMessage;
    this.status = status;
  }
}

function parseAnswer(text) {
  try {
    const parsed = JSON.parse(text);
    return { answer: parsed.answer || '', solution: parsed.solution || '' };
  } catch {
    return { answer: text.trim(), solution: '' };
  }
}

async function solveWithGroq(pngBase64) {
  const apiKey = process.env.GROQ_API_KEY;

  const baseBody = {
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${pngBase64}` } },
        ],
      },
    ],
  };

  const callModel = (model) =>
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ ...baseBody, model }),
    });

  let resp;
  for (const model of GROQ_MODELS) {
    resp = await callModel(model);
    if (resp.status !== 404) break;
    console.error(`Groq model ${model} unavailable (404), trying next`);
  }

  if (resp.status === 404) {
    const discovered = await discoverGroqVisionModel(apiKey);
    if (discovered) {
      console.error(`All configured Groq models retired; discovered ${discovered}`);
      resp = await callModel(discovered);
    }
  }

  if (!resp.ok) {
    const detail = await resp.text();
    console.error('Groq API error:', resp.status, detail);
    let upstreamMessage = '';
    try {
      upstreamMessage = JSON.parse(detail)?.error?.message || '';
    } catch { /* non-JSON error body */ }
    if (resp.status === 429) {
      throw new SolverError('The solver hit its usage limit. Please try again in a minute.');
    }
    throw new SolverError(
      `The solver service returned an error (${resp.status}${upstreamMessage ? `: ${upstreamMessage}` : ''}). Please try again.`
    );
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new SolverError('The solver returned an empty response. Please try again.');
  }
  return parseAnswer(text);
}

export async function solveDrawing(req, res, next) {
  try {
    const { pngBase64 } = req.body;
    if (!pngBase64) {
      return res.status(400).json({ error: 'pngBase64 is required' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is not configured on the server' });
    }

    try {
      return res.json(await solveWithGroq(pngBase64));
    } catch (err) {
      if (!(err instanceof SolverError)) throw err;
      return res.status(err.status).json({ error: err.userMessage });
    }
  } catch (err) {
    next(err);
  }
}
