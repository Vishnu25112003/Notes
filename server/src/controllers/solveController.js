// Primary provider: Groq (OpenAI-compatible API). The Gemini code below is
// kept as an automatic fallback until Groq is proven stable, then it can go.

// Groq vision-capable models — try in order, skip any that 404 (Groq retires
// models the same way Google does; the Llama 4 vision models are already gone).
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

// Google keeps retiring models (2.0-flash in June 2026, 2.5-flash for new
// users in July 2026), so try candidates in order and skip any that 404.
const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
].filter(Boolean);

const PROMPT = `You are looking at an image exported from a handwritten/drawn notes canvas.
Find any question, math expression, or problem in the image and solve it.

Rules:
- If it is a math expression like "2 + 2 =" or "3 x 4", return only the final result in "answer" (e.g. "4", "12").
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

async function solveWithGemini(pngBase64) {
  const apiKey = process.env.GEMINI_API_KEY;

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: 'image/png', data: pngBase64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          answer: { type: 'string' },
          solution: { type: 'string' },
        },
        required: ['answer', 'solution'],
      },
    },
  };

  let resp;
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (resp.status !== 404) break;
    console.error(`Gemini model ${model} unavailable (404), trying next`);
  }

  if (!resp.ok) {
    const detail = await resp.text();
    console.error('Gemini API error:', resp.status, detail);
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
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
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

    const hasGroq = Boolean(process.env.GROQ_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    if (!hasGroq && !hasGemini) {
      return res.status(500).json({ error: 'No solver API key is configured on the server' });
    }

    let lastError;
    if (hasGroq) {
      try {
        return res.json(await solveWithGroq(pngBase64));
      } catch (err) {
        if (!(err instanceof SolverError)) throw err;
        lastError = err;
        console.error('Groq solver failed, falling back to Gemini:', err.userMessage);
      }
    }

    if (hasGemini) {
      try {
        return res.json(await solveWithGemini(pngBase64));
      } catch (err) {
        if (!(err instanceof SolverError)) throw err;
        lastError = err;
      }
    }

    return res.status(lastError.status).json({ error: lastError.userMessage });
  } catch (err) {
    next(err);
  }
}
