// api/pagamento.js — Mercado Pago Checkout
const MP_TOKEN = process.env.MP_ACCESS_TOKEN;

const PLANOS = {
  essencial:    { nome: 'JgerenteAI Essencial',    valor: 97  },
  profissional: { nome: 'JgerenteAI Profissional', valor: 197 },
  empresarial:  { nome: 'JgerenteAI Empresarial',  valor: 397 }
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(200).end();
  if(req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try{
    const { action, plano, email, nome, company_id } = req.body;
    if(action !== 'criar') return res.status(400).json({ error: 'Ação inválida' });

    const p = PLANOS[plano];
    if(!p) return res.status(400).json({ error: 'Plano inválido: '+plano });
    if(!MP_TOKEN) return res.status(500).json({ error: 'MP_ACCESS_TOKEN não configurado' });

    // Criar preferência de pagamento (Checkout Pro)
    const body = {
      items: [{
        title: p.nome,
        description: 'Assinatura mensal '+p.nome,
        quantity: 1,
        unit_price: p.valor,
        currency_id: 'BRL'
      }],
      payer: { email: email || 'cliente@jgerenteai.com' },
      back_urls: {
        success: 'https://ppeu07280-oss.github.io/jgerente-ai/jgerente-app.html?pago=1&company_id='+company_id,
        failure: 'https://ppeu07280-oss.github.io/jgerente-ai/jgerente-app.html?pago=0',
        pending: 'https://ppeu07280-oss.github.io/jgerente-ai/jgerente-app.html?pago=pending'
      },
      auto_return: 'approved',
      external_reference: company_id,
      statement_descriptor: 'JgerenteAI'
    };

    console.log('Creating preference:', JSON.stringify(body));

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + MP_TOKEN
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    console.log('MP response:', response.status, data.id, data.init_point);

    if(!response.ok){
      return res.status(response.status).json({ error: 'Erro MP', details: data });
    }

    if(data.init_point){
      return res.status(200).json({ url: data.init_point, id: data.id });
    }

    return res.status(500).json({ error: 'Sem link', details: data });

  }catch(e){
    console.error('Pagamento error:', e);
    return res.status(500).json({ error: e.message });
  }
};
