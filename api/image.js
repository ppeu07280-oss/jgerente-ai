// api/image.js — Proxy para OpenAI GPT Image 1
const OPENAI_KEY = process.env.OPENAI_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(200).end();
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try{
    const { prompt, size, quality } = req.body;
    if(!prompt) return res.status(400).json({ error: 'prompt required' });
    if(!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_KEY not configured' });

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENAI_KEY
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: prompt,
        n: 1,
        size: size || '1024x1024',
        quality: quality || 'medium'
      })
    });

    const data = await response.json();
    console.log('OpenAI response status:', response.status);
    console.log('OpenAI response keys:', Object.keys(data));

    if(!response.ok){
      return res.status(response.status).json({ error: data.error || 'OpenAI error', details: data });
    }

    // gpt-image-1 returns b64_json - convert to data URL for browser
    if(data.data && data.data[0] && data.data[0].b64_json){
      data.data[0].url = 'data:image/png;base64,' + data.data[0].b64_json;
    }

    return res.status(200).json(data);

  }catch(e){
    console.error('Image proxy error:', e);
    return res.status(500).json({ error: e.message });
  }
};
