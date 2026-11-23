export default async function handler(req, res) {
  const { domain } = req.query;

  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  // Domain ko saaf karein (http/https hatayein)
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const targetUrl = `https://${cleanDomain}/robots.txt`;

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return res.status(404).json({ 
        exists: false, 
        message: 'robots.txt file nahi mili (404 Not Found)' 
      });
    }

    const text = await response.text();
    return res.status(200).json({ 
      exists: true, 
      content: text 
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Website se rabta nahi ho saka ya domain ghalat hai.' 
    });
  }
}
  
