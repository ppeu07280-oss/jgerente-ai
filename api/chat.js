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

    const systemMsg = systemPrompt || 'Você é um assistente de gestão empresarial brasileiro. Responda sempre em português.';

    const contents = [
      { role: 'user', parts: [{ text: `[SISTEMA]: ${systemMsg}` }] },
      { role: 'model', parts: [{ text: 'Entendido! Pronto para ajudar.' }] },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    ];

    // Modelos em ordem de prioridade
    const attempts = [
      { version: 'v1beta', model: 'gemini-3-flash-preview' },
      { version: 'v1beta', model: 'gemini-2.0-flash' },
      { version: 'v1beta', model: 'gemini-2.0-flash-lite' },
      { version: 'v1beta', model: 'gemini-1.5-flash' },
      { version: 'v1', model: 'gemini-2.0-flash' },
      { version: 'v1', model: 'gemini-1.5-flash' },
    ];

    for (const { version, model } of attempts) {
      try {
        const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
        console.log(`Tentando: ${url}`);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        });

        const data = await response.json();

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const text = data.candidates[0].content.parts[0].text;
          console.log(`✅ Sucesso: ${version}/${model}`);
          return res.status(200).json({ response: text });
        }

        console.error(`❌ ${version}/${model}:`, data?.error?.message);

      } catch (e) {
        console.error(`❌ ${version}/${model} erro:`, e.message);
      }
    }

    // Lista modelos disponíveis para debug
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
      );
      const listData = await listRes.json();
      const modelNames = listData.models?.map(m => m.name) || [];
      console.log('Modelos disponíveis:', modelNames.join(', '));
      return res.status(500).json({ 
        error: 'Todos os modelos falharam',
        modelos_disponiveis: modelNames
      });
    } catch(e) {
      return res.status(500).json({ error: 'Falha total. Chave inválida.' });
    }

  } catch (e) {
    console.error('Handler error:', e.message);
    return res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
}
