// api/fal.js — Proxy para FAL.AI (evita CORS)
const FAL_KEY = process.env.FAL_KEY || '925a87d1-6a7b-495e-b569-2bea6333132a:02c196077d9cb12b1cafdce67f499527';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { endpoint, payload } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

    const falUrl = 'https://fal.run/' + endpoint;

    const response = await fetch(falUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Key ' + FAL_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (e) {
    console.error('FAL proxy error:', e);
    return res.status(500).json({ error: e.message });
  }
};
