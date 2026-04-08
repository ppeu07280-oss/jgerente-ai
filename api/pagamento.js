// api/pagamento.js — Mercado Pago Assinaturas
const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_PUBLIC_KEY = 'APP_USR-f0ac8ff5-9831-47b2-ba1d-e093b47665a5';

const PLANOS = {
  essencial:     { nome: 'JgerenteAI Essencial',     valor: 97  },
  profissional:  { nome: 'JgerenteAI Profissional',  valor: 197 },
  empresarial:   { nome: 'JgerenteAI Empresarial',   valor: 397 },
  social:        { nome: 'Social Mídia Add-on',       valor: 97  }
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.body || req.query;

  // ── CRIAR ASSINATURA ──
  if(action === 'criar' && req.method === 'POST'){
    try{
      const { plano, email, nome, company_id } = req.body;
      const p = PLANOS[plano];
      if(!p) return res.status(400).json({ error: 'Plano inválido' });

      const response = await fetch('https://api.mercadopago.com/preapproval_plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + MP_TOKEN
        },
        body: JSON.stringify({
          reason: p.nome,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: p.valor,
            currency_id: 'BRL'
          },
          back_url: 'https://ppeu07280-oss.github.io/jgerente-ai/jgerente-app.html',
          payment_methods_allowed: {
            payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }]
          }
        })
      });

      const plan = await response.json();
      console.log('MP Plan:', response.status, plan.id);

      if(!plan.id) return res.status(500).json({ error: 'Erro ao criar plano', details: plan });

      // Criar assinatura para o cliente
      const subRes = await fetch('https://api.mercadopago.com/preapproval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + MP_TOKEN
        },
        body: JSON.stringify({
          preapproval_plan_id: plan.id,
          reason: p.nome,
          payer_email: email,
          back_url: 'https://ppeu07280-oss.github.io/jgerente-ai/jgerente-app.html?pago=1&company_id='+company_id,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: p.valor,
            currency_id: 'BRL',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 365*24*60*60*1000).toISOString()
          }
        })
      });

      const sub = await subRes.json();
      console.log('MP Sub:', subRes.status, sub.id, sub.init_point);

      if(sub.init_point){
        return res.status(200).json({ url: sub.init_point, id: sub.id });
      }
      return res.status(500).json({ error: 'Sem link de pagamento', details: sub });

    }catch(e){
      console.error('MP error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── WEBHOOK ──
  if(req.method === 'POST' && !action){
    try{
      const { type, data } = req.body;
      console.log('MP Webhook:', type, data);
      // Aqui processaria a confirmação de pagamento
      return res.status(200).json({ ok: true });
    }catch(e){
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Ação inválida' });
};
