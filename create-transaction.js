const { createClient } = require('@supabase/supabase-js');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  const { data: { user }, error } = await sb.auth.getUser(jwt);
  if (error || !user) return res.status(401).json({ error: 'Belum login' });

  const amount = 10000; // harga Paket Pro, diatur di server supaya tidak bisa diubah pengguna
  const order_id = 'SIAP-' + Date.now() + '-' + user.id.slice(0, 6);
  const base = process.env.MIDTRANS_PRODUCTION === 'true' ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
  const r = await fetch(base + '/snap/v1/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(process.env.MIDTRANS_SERVER_KEY + ':').toString('base64') },
    body: JSON.stringify({
      transaction_details: { order_id, gross_amount: amount },
      customer_details: { email: user.email },
      item_details: [{ id: 'pro-1bln', price: amount, quantity: 1, name: 'Siap? Paket Pro 1 bulan' }]
    })
  });
  const d = await r.json();
  if (!r.ok) return res.status(502).json({ error: d });
  await sb.from('payments').insert({ order_id, user_id: user.id, amount, status: 'pending' });
  res.json({ token: d.token });
};
