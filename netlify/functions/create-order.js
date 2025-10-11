// Netlify Function: POST /create-order
// Crea la orden en PayPal en el servidor (seguro).
// Usa credenciales desde variables de entorno de Netlify.

const PLANS = {
  basic:      { amount: '30.00', desc: 'ObraTitan Basic (mensual)' },
  pro:        { amount: '80.00', desc: 'ObraTitan Pro (mensual)' },
};

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret   = process.env.PAYPAL_CLIENT_SECRET;
  const base     = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    throw new Error(`Token error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return { token: data.access_token, base };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const licenseType = body?.plan?.licenseType;

    // Whitelist en servidor (no confiamos en amount del cliente)
    const plan = PLANS[licenseType];
    if (!plan) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Plan inválido' }) };
    }

    const { token, base } = await getAccessToken();

    const orderBody = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          description: plan.desc,
          amount: { currency_code: 'USD', value: plan.amount },
        },
      ],
    };

    const resp = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderBody),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: resp.status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: data }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ orderID: data.id }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'No se pudo crear la orden' }) };
  }
};
