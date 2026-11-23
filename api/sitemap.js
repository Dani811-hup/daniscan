export default async function handler(req, res) {
  const { domain } = req.query;

  if (!domain) {
    return res.status(400).json({ error: "Domain parameter is required." });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  let sitemapUrl = `https://${cleanDomain}/sitemap.xml`;

  try {
    let response = await fetch(sitemapUrl);

    // Agar /sitemap.xml na mile to robots.txt se Sitemap link dhoondein
    if (!response.ok) {
      const robotsRes = await fetch(`https://${cleanDomain}/robots.txt`);
      if (robotsRes.ok) {
        const robotsText = await robotsRes.text();
        const match = robotsText.match(/Sitemap:\s*(https?:\/\/[^\s]+)/i);
        if (match && match[1]) {
          sitemapUrl = match[1].trim();
          response = await fetch(sitemapUrl);
        }
      }
    }

    if (!response.ok) {
      return res.status(200).json({
        exists: false,
        message: `Sitemap not found (HTTP ${response.status})`
      });
    }

    const xmlText = await response.text();
    const isXml = xmlText.includes("<urlset") || xmlText.includes("<sitemapindex");

    if (!isXml) {
      return res.status(200).json({
        exists: false,
        message: "File found, but it is not a valid XML sitemap."
      });
    }

    // Sitemap mein maujood URLs (<loc>) ginein
    const urls = [...xmlText.matchAll(/<loc>(.*?)<\/loc>/gi)].map(m => m[1]);

    return res.status(200).json({
      exists: true,
      url: sitemapUrl,
      totalUrls: urls.length,
      sampleUrls: urls.slice(0, 15) // Pehle 15 links dikhane ke liye
    });

  } catch (error) {
    return res.status(500).json({
      error: "Could not reach target website."
    });
  }
}
