// api/chat.js — Gemini chat + FAL.AI Image generation
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FAL_KEY = '925a87d1-6a7b-495e-b569-2bea6333132a:02c196077d9cb12b1cafdce67f499527';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, systemPrompt, generateImage, imagePrompt, aspectRatio } = req.body;

  // IMAGE GENERATION
  if (generateImage && imagePrompt) {
    try {
      const sizeMap = { '1:1': 'square_hd', '3:4': 'portrait_4_3', '4:3': 'landscape_4_3' };
      const imageSize = sizeMap[aspectRatio] || 'square_hd';
      const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Key ' + FAL_KEY },
        body: JSON.stringify({ prompt: imagePrompt, image_size: imageSize, num_images: 1, num_inference_steps: 4 })
      });
      const data = await response.json();
      if (data.images && data.images[0] && data.images[0].url) {
        return res.status(200).json({ imageUrl: data.images[0].url });
      }
      return res.status(500).json({ error: 'Sem imagem', details: data });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // CHAT MODE — tenta modelos em sequência
  const models = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-2.0-flash'
  ];

  const contents = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Entendido!' }] });
  }
  const recent = (messages || []).slice(-8);
  for (const msg of recent) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(msg.content || '') }]
      });
    }
  }

  for (const model of models) {
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + GEMINI_API_KEY,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }) }
      );
      const data = await response.json();
      console.log('Model:', model, 'Status:', response.status);

      if (response.status === 429) continue; // tenta próximo modelo

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return res.status(200).json({ response: text });
    } catch (e) {
      console.log('Model failed:', model, e.message);
    }
  }

  return res.status(200).json({ response: 'Serviço temporariamente indisponível. Tente em alguns minutos.' });
};
