// api/chat.js — Claude (Anthropic) chat + Ideogram image generation
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const GROQ_KEY = process.env.GROQ_KEY;
const IDEOGRAM_KEY = process.env.IDEOGRAM_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, systemPrompt, generateImage, userMessage, referenceImageB64, referenceMimeType } = req.body;

  // ── IMAGE GENERATION ──
  if (generateImage) {
    try {
      // Groq cria o prompt técnico em inglês
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{
            role: 'system',
            content: 'You are an expert AI image prompt engineer for Ideogram AI. Create ONE detailed English prompt for professional product/food photography for social media. Be very specific about the subject, colors, lighting, background, style. Add "no text overlay, no words, clean image" at the end. If user mentions Brazilian products (açaí, coxinha, brigadeiro, etc), describe them in detail. Return ONLY the prompt.'
          }, {
            role: 'user',
            content: userMessage || 'professional product photo for Instagram'
          }],
          max_tokens: 250,
          temperature: 0.3
        })
      });
      const groqData = await groqRes.json();
      const engineeredPrompt = groqData.choices?.[0]?.message?.content?.trim() || userMessage;
      console.log('Prompt:', engineeredPrompt.slice(0, 120));

      // Ideogram gera a imagem
      const ideogramBody = {
        image_request: {
          prompt: engineeredPrompt,
          aspect_ratio: 'ASPECT_1_1',
          model: 'V_2',
          magic_prompt_option: 'OFF',
          style_type: 'REALISTIC'
        }
      };

      // Se tem imagem de referência usa remix
      if (referenceImageB64) {
        const remixRes = await fetch('https://api.ideogram.ai/remix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Api-Key': IDEOGRAM_KEY },
          body: JSON.stringify({
            image_request: { ...ideogramBody.image_request, image_weight: 60 },
            image_file: referenceImageB64
          })
        });
        const remixData = await remixRes.json();
        console.log('Remix status:', remixRes.status);
        if (remixData.data?.[0]?.url) {
          return res.status(200).json({ imageUrl: remixData.data[0].url, prompt: engineeredPrompt });
        }
      }

      // Geração normal
      const imgRes = await fetch('https://api.ideogram.ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Api-Key': IDEOGRAM_KEY },
        body: JSON.stringify(ideogramBody)
      });
      const imgData = await imgRes.json();
      console.log('Ideogram status:', imgRes.status);

      if (imgData.data?.[0]?.url) {
        return res.status(200).json({ imageUrl: imgData.data[0].url, prompt: engineeredPrompt });
      }
      return res.status(500).json({ error: 'Sem imagem', details: imgData });

    } catch (e) {
      console.error('Image error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── CHAT via Claude (Anthropic) ──
  try {
    const msgs = (messages || []).slice(-10)
      .filter(function(m){ return m.role === 'user' || m.role === 'assistant'; })
      .map(function(m){ return { role: m.role, content: String(m.content || '') }; });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt || 'Você é um assistente de gestão empresarial brasileiro. Responda sempre em português.',
        messages: msgs.length > 0 ? msgs : [{ role: 'user', content: 'Olá' }]
      })
    });

    const data = await response.json();
    console.log('Claude status:', response.status);

    const text = data.content?.[0]?.text || 'Erro ao processar.';
    return res.status(200).json({ response: text });

  } catch (e) {
    console.error('Chat error:', e);
    // Fallback para Groq se Claude falhar
    try {
      const msgs2 = (messages || []).slice(-10)
        .filter(function(m){ return m.role === 'user' || m.role === 'assistant'; });
      const r2 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: systemPrompt ? [{role:'system',content:systemPrompt},...msgs2] : msgs2, max_tokens: 1024 })
      });
      const d2 = await r2.json();
      return res.status(200).json({ response: d2.choices?.[0]?.message?.content || 'Erro.' });
    } catch(e2) {
      return res.status(200).json({ response: 'Erro ao conectar. Tente novamente.' });
    }
  }
};
