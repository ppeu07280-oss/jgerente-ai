// api/image.js — Proxy para Google Imagen 3 via Gemini API
const GEMINI_KEY = process.env.GEMINI_API_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(200).end();
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try{
    const { prompt, aspectRatio } = req.body;
    if(!prompt) return res.status(400).json({ error: 'prompt required' });
    if(!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=' + GEMINI_KEY;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio || '1:1'
        }
      })
    });

    const data = await response.json();
    console.log('Imagen 3 status:', response.status, JSON.stringify(data).slice(0,200));

    if(!response.ok){
      return res.status(response.status).json({ error: data.error || 'Imagen error', details: data });
    }

    if(data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded){
      const b64 = data.predictions[0].bytesBase64Encoded;
      const mimeType = data.predictions[0].mimeType || 'image/png';
      return res.status(200).json({
        data: [{ url: 'data:'+mimeType+';base64,'+b64 }]
      });
    }

    return res.status(500).json({ error: 'No image in response', details: data });

  }catch(e){
    console.error('Image proxy error:', e);
    return res.status(500).json({ error: e.message });
  }
};
