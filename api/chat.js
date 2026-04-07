export default async function handler(req, res) {
  // CORS — permite qualquer origem
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages é obrigatório' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt || 'Você é um assistente de gestão empresarial.' }]
          },
          contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }))
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini error:', data);
      return res.status(500).json({ error: 'Erro na API do Gemini', details: data });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
    return res.status(200).json({ response: text });

  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
}
