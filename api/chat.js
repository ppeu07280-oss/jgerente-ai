// api/chat.js — Gemini chat + Image generation
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, systemPrompt, generateImage, imagePrompt, aspectRatio } = req.body;

  // IMAGE GENERATION MODE
  if (generateImage && imagePrompt) {
    try {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=' + GEMINI_API_KEY;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: imagePrompt }],
          parameters: { sampleCount: 1, aspectRatio: aspectRatio || '1:1' }
        })
      });
      const data = await response.json();
      console.log('Imagen status:', response.status, JSON.stringify(data).slice(0, 300));

      if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
        const b64 = data.predictions[0].bytesBase64Encoded;
        const mimeType = data.predictions[0].mimeType || 'image/png';
        return res.status(200).json({ imageUrl: 'data:' + mimeType + ';base64,' + b64 });
      }
      return res.status(500).json({ error: 'No image', details: data });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // CHAT MODE
  try {
    const contents = [];
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
      contents.push({ role: 'model', parts: [{ text: 'Entendido! Estou pronto para ajudar.' }] });
    }
    for (const msg of (messages || [])) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Erro ao processar resposta.';
    return res.status(200).json({ response: text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
