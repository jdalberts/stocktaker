const ALLOWED_ORIGINS = [
  'https://stocktaker-kivl.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

function resolveOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return null;
}

module.exports = async function handler(req, res) {
  const origin = resolveOrigin(req);

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    if (!origin) return res.status(403).end();
    return res.status(200).end();
  }

  if (!origin) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { apiKey, image, mime } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'No API key provided' });
    }

    if (!image || !mime) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    console.log('Calling Anthropic API, image size:', image.length, 'chars');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mime, data: image },
              },
              {
                type: 'text',
                text: 'Extract ONLY these fields from this product label. Respond ONLY with valid JSON and nothing else:\n{"productName":"full brand and product name","expiryDate":"best before or expiry date exactly as shown on label","lotNumber":"batch number or lot number"}\nIf a field is not visible use "". Look for: batch no, lot no, best before, used best before, exp, expiry.',
              },
            ],
          },
        ],
      }),
    });

    console.log('Anthropic response status:', response.status);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Scan API error:', err);
    return res.status(500).json({ error: err.message || 'Proxy error' });
  }
};
