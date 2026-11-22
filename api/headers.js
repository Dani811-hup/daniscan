export default async function handler(req, res) {
  let { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  const targetUrl = `https://${domain}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const headersToCheck = [
      { name: 'Strict-Transport-Security', key: 'strict-transport-security' },
      { name: 'Content-Security-Policy', key: 'content-security-policy' },
      { name: 'X-Frame-Options', key: 'x-frame-options' },
      { name: 'X-Content-Type-Options', key: 'x-content-type-options' },
      { name: 'Referrer-Policy', key: 'referrer-policy' },
      { name: 'Permissions-Policy', key: 'permissions-policy' },
    ];

    let passed = 0;
    const results = headersToCheck.map((h) => {
      const val = response.headers.get(h.key);
      if (val) passed++;
      return {
        name: h.name,
        status: val ? 'PASS' : 'MISSING',
        value: val || 'Not Set',
      };
    });

    return res.status(200).json({
      target: targetUrl,
      score: `${passed}/6`,
      results,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Target unreachable or SSL error' });
  }
}
