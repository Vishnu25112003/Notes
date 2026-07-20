// 'gemini-flash-latest' resolved to gemini-2.0-flash, which Google shut down
// on 2026-06-01 — use a pinned, supported model instead.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const PROMPT = `You are looking at an image exported from a handwritten/drawn notes canvas.
Find any question, math expression, or problem in the image and solve it.

Rules:
- If it is a math expression like "2 + 2 =" or "3 x 4", return only the final result in "answer" (e.g. "4", "12").
- For any other question (science, general knowledge, word problems), give a short, direct final answer in "answer".
- Put a fuller explanation or working steps in "solution". Keep it concise.
- If the image has no readable question, set answer to "" and explain briefly in "solution".`;

export async function solveDrawing(req, res, next) {
  try {
    const { pngBase64 } = req.body;
    if (!pngBase64) {
      return res.status(400).json({ error: 'pngBase64 is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

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

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error('Gemini API error:', resp.status, detail);
      let upstreamMessage = '';
      try {
        upstreamMessage = JSON.parse(detail)?.error?.message || '';
      } catch { /* non-JSON error body */ }
      if (resp.status === 429) {
        return res.status(502).json({ error: 'The solver hit its usage limit. Please try again in a minute.' });
      }
      return res.status(502).json({
        error: `The solver service returned an error (${resp.status}${upstreamMessage ? `: ${upstreamMessage}` : ''}). Please try again.`,
      });
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: 'The solver returned an empty response. Please try again.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { answer: text.trim(), solution: '' };
    }

    res.json({ answer: parsed.answer || '', solution: parsed.solution || '' });
  } catch (err) {
    next(err);
  }
}
