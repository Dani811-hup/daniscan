const dns = require("node:dns").promises;
const https = require("node:https");
const net = require("node:net");

function isPublicIPv4(ip) {
  if (net.isIP(ip) !== 4) return false;

  const [a, b] = ip.split(".").map(Number);

  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function checkWebsite(host, ip) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      servername: host,
      method: "HEAD",
      path: "/",
      timeout: 8000,
      family: 4,
      lookup: (_host, _options, callback) => {
        callback(null, ip, 4);
      }
    }, (response) => {
      const status = response.statusCode;
      response.resume();
      resolve(status);
    });

    req.on("timeout", () => req.destroy(new Error("Timeout")));
    req.on("error", reject);
    req.end();
  });
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let target = String(req.query.target || "").trim().toLowerCase();

  if (target.startsWith("https://")) target = target.slice(8);
  else if (target.startsWith("http://")) target = target.slice(7);

  if (target.startsWith("www.")) target = target.slice(4);

  target = target.split("/")[0].split(":")[0];

  const valid = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(target);

  if (!valid) {
    return res.status(400).json({ error: "Invalid domain", received: target });
  }

  try {
    const records = await dns.resolve4(target);
    const ip = records.find(isPublicIPv4);

    if (!ip) {
      return res.status(400).json({ error: "No public IPv4 found" });
    }

    const httpStatus = await checkWebsite(target, ip);

    return res.status(200).json({
      status: "Reachable",
      target,
      ip,
      httpStatus
    });
  } catch (error) {
    console.error("PING ERROR:", error.code, error.message);

    return res.status(502).json({
      error: "Connection failed",
      details: error.code || error.message
    });
  }
};
