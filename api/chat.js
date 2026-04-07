module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, systemPrompt } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages é obrigatório' });
    }

    // Injeta system prompt como primeira mensagem do usuário
    const systemMsg = systemPrompt || 'Você é um assistente de gestão empresarial brasileiro. Responda sempre em português.';
    
    const contents = [
      { role: 'user', parts: [{ text: `[INSTRUÇÕES DO SISTEMA]: ${systemMsg}` }] },
      { role: 'model', parts: [{ text: 'Entendido! Estou pronto para ajudar.' }] },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    ];

    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro'];

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
          }
        );

        const data = await response.json();

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const text = data.candidates[0].content.parts[0].text;
          console.log(`✅ Sucesso com: ${model}`);
          return res.status(200).json({ response: text });
        }

        console.error(`❌ Falha ${model}:`, data?.error?.message || JSON.stringify(data));

      } catch (e) {
        console.error(`❌ Erro ${model}:`, e.message);
      }
    }

    return res.status(500).json({ error: 'Todos os modelos falharam. Verifique a chave da API.' });

  } catch (e) {
    console.error('Handler error:', e.message);
    return res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
}
