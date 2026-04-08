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

    // Try Imagen 3 first, fallback to gemini-2.0-flash-exp
    const models = [
      'imagen-3.0-generate-001',
      'imagen-3.0-fast-generate-001'
    ];

    let lastError = null;

    for(const model of models){
      try{
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/'+model+':predict?key=' + GEMINI_KEY;
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
        console.log('Model:', model, 'Status:', response.status);

        if(response.ok && data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded){
          const b64 = data.predictions[0].bytesBase64Encoded;
          const mimeType = data.predictions[0].mimeType || 'image/png';
          return res.status(200).json({
            data: [{ url: 'data:'+mimeType+';base64,'+b64 }]
          });
        }
        lastError = data;
      }catch(modelErr){
        console.error('Model error:', model, modelErr.message);
        lastError = modelErr.message;
      }
    }

    // Fallback: use Gemini 2.0 Flash with image generation
    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + GEMINI_KEY;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Generate an image: ' + prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      })
    });
    const geminiData = await geminiRes.json();
    console.log('Gemini fallback status:', geminiRes.status);

    if(geminiData.candidates && geminiData.candidates[0]){
      const parts = geminiData.candidates[0].content.parts;
      for(const part of parts){
        if(part.inlineData){
          return res.status(200).json({
            data: [{ url: 'data:'+part.inlineData.mimeType+';base64,'+part.inlineData.data }]
          });
        }
      }
    }

    return res.status(500).json({ error: 'No image generated', details: lastError });

  }catch(e){
    console.error('Image proxy error:', e);
    return res.status(500).json({ error: e.message });
  }
};
