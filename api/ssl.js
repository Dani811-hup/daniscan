// Rate Limit: 1 IP = 5 Requests Per Day
let limits = {};

export default async function handler(req, res) {
  const domain = req.query.domain;
  if (!domain) {
    return res.status(400).json({ error: "Domain is required" });
  }

  // Get User IP Address
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const today = new Date().toISOString().slice(0, 10); // Current Date YYYY-MM-DD
  const key = ip + "-" + today;

  if (!limits[key]) {
    limits[key] = 0;
  }

  limits[key]++;

  if (limits[key] > 5) {
    return res.status(429).send("Limit Reached! You have used this tool 5 times today. Please try again tomorrow. - DaniScan");
  }

  try {
    const response = await fetch(`https://api.hackertarget.com/sslcert/?q=${domain}`);
    const data = await response.text();
    res.status(200).send(data + `\n\n--- Remaining: ${5 - limits[key]} / 5 ---`);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
