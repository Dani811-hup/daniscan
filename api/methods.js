export default async function handler(req, res) {
  let { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  const targetUrl = `https://${domain}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      method: 'OPTIONS',
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const allowHeader =
      response.headers.get('allow') ||
      response.headers.get('access-control-allow-methods');

    let methods = [];
    if (allowHeader) {
      methods = allowHeader.split(',').map((m) => m.trim().toUpperCase());
    } else {
      methods = ['GET', 'HEAD (OPTIONS hidden by server)'];
    }

    // Check karein ke koi risky method (PUT, DELETE, TRACE) toh open nahi
    const risky = methods.filter((m) => ['PUT', 'DELETE', 'TRACE', 'CONNECT'].includes(m));

    return res.status(200).json({
      target: targetUrl,
      statusCode: response.status,
      methods,
      securityNote:
        risky.length > 0
          ? `Warning: Risky methods enabled (${risky.join(', ')})`
          : 'Safe: No dangerous HTTP methods exposed.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Target unreachable or request blocked.' });
  }
}
  
