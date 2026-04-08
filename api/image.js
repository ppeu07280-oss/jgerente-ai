// api/image.js — Proxy para OpenAI GPT Image 1.5
const OPENAI_KEY = process.env.OPENAI_KEY || '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';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(200).end();
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try{
    const { prompt, size, quality } = req.body;
    if(!prompt) return res.status(400).json({ error: 'prompt required' });

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
        quality: quality || 'high'
      })
    });

    const data = await response.json();
    return res.status(200).json(data);

  }catch(e){
    console.error('Image proxy error:', e);
    return res.status(500).json({ error: e.message });
  }
};
