// api/chat.js — Gemini chat + Image generation
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, systemPrompt, generateImage, imagePrompt } = req.body;

  // IMAGE GENERATION — Nano Banana (gemini-2.5-flash-image)
  if (generateImage && imagePrompt) {
    try {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=' + GEMINI_API_KEY;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: imagePrompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
        })
      });
      const data = await response.json();
      console.log('Nano Banana status:', response.status, JSON.stringify(data).slice(0, 400));

      if (data.candidates && data.candidates[0]) {
        const parts = data.candidates[0].content.parts;
        for (const part of parts) {
          if (part.inlineData) {
            return res.status(200).json({
              imageUrl: 'data:' + part.inlineData.mimeType + ';base64,' + part.inlineData.data
            });
          }
        }
      }
      return res.status(500).json({ error: 'Sem imagem', details: data });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // CHAT MODE
  try {
    const contents = [];
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
      contents.push({ role: 'model', parts: [{ text: 'Entendido!' }] });
    }
    for (const msg of (messages || [])) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }) }
    );
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Erro ao processar.';
    return res.status(200).json({ response: text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
