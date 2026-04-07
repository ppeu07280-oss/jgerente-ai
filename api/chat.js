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

    // Tenta os modelos em ordem até funcionar
    const models = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-pro',
    ];

    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: systemPrompt || 'Você é um assistente de gestão empresarial brasileiro.' }]
              },
              contents: messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
              }))
            })
          }
        );

        const data = await response.json();

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const text = data.candidates[0].content.parts[0].text;
          console.log(`Sucesso com modelo: ${model}`);
          return res.status(200).json({ response: text, model });
        }

        lastError = data;
        console.error(`Falha com ${model}:`, JSON.stringify(data));

      } catch (e) {
        lastError = e.message;
        console.error(`Erro com ${model}:`, e.message);
      }
    }

    return res.status(500).json({ error: 'Todos os modelos falharam', details: lastError });

  } catch (e) {
    console.error('Handler error:', e.message);
    return res.status(500).json({ error: 'Erro interno: ' + e.message });
  }
}
