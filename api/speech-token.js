export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || 'southeastasia';

  if (!key) {
    res.status(500).json({ error: 'Speech service not configured' });
    return;
  }

  try {
    const tokenRes = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Length': '0',
        },
      }
    );

    if (!tokenRes.ok) {
      res.status(502).json({ error: 'Failed to get speech token' });
      return;
    }

    const token = await tokenRes.text();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ token, region });
  } catch (e) {
    res.status(502).json({ error: 'Token service unavailable' });
  }
}
