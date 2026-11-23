export default async function handler(req, res) {
  const { domain } = req.query;

  if (!domain) {
    return res.status(400).json({ error: "Domain parameter is required." });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  try {
    const response = await fetch(`https://${cleanDomain}/robots.txt`);

    if (!response.ok) {
      return res.status(200).json({
        exists: false,
        message: `Not Found (HTTP ${response.status})`
      });
    }

    const text = await response.text();
    return res.status(200).json({
      exists: true,
      content: text
    });

  } catch (error) {
    return res.status(500).json({
      error: "Could not reach target website."
    });
  }
}
