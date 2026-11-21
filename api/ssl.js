const https = require("node:https");
const dns = require("node:dns").promises;
const net = require("node:net");
const tls = require("node:tls");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const target = body?.target;
    if (typeof target !== "string" || !target.trim()) {
      return res.status(400).json({ success: false, error: "Enter a domain" });
    }
    let url;
    try { url = new URL(target.includes("://") ? target : `https://${target}`); }
    catch { return res.status(400).json({ success: false, error: "Invalid domain" }); }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !host || host === "localhost" || net.isIP(host)) {
      return res.status(400).json({ success: false, error: "Only public HTTPS domains on port 443 are allowed" });
    }
    const records = await dns.resolve4(host);
    if (!records.length) throw new Error("Domain has no IPv4 address");
    const blocked = [/^0\./,/^10\./,/^127\./,/^169\.254\./,/^172\.(1[6-9]|2\d|3[01])\./,/^192\.168\./,/^192\.0\.2\./,/^198\.18\./,/^198\.19\./,/^198\.51\.100\./,/^203\.0\.113\./,/^(22[4-9]|23\d|24\d|25[0-5])\./];
    if (records.some(ip => blocked.some(re => re.test(ip)))) throw new Error("Private or reserved IP blocked");

    const result = await new Promise((resolve, reject) => {
      const request = https.get({
        hostname: host,
        port: 443,
        path: "/",
        method: "GET",
        rejectUnauthorized: false,
        timeout: 5000,
        headers: { "User-Agent": "DaniScan/1.0" }
      }, (response) => {
        const socket = response.socket;
        const cert = socket.getPeerCertificate();
        const hostnameError = tls.checkServerIdentity(host, cert);
        response.resume();
        response.on("end", () => {
          if (!cert || !cert.valid_to) return reject(new Error("Certificate unavailable"));
          const now = Date.now();
          const expiry = new Date(cert.valid_to);
          const issued = new Date(cert.valid_from);
          const days = Math.ceil((expiry.getTime() - now) / 86400000);
          const valid = socket.authorized && !hostnameError && now >= issued.getTime() && now <= expiry.getTime();
          resolve({
            domain: host,
            https: true,
            status: valid ? "VALID" : "INVALID",
            certificateValid: socket.authorized,
            hostnameMatch: !hostnameError,
            issuer: cert.issuer?.O || cert.issuer?.CN || "Unknown",
            subject: cert.subject?.CN || host,
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            daysRemaining: days,
            expired: now > expiry.getTime(),
            authorizationError: socket.authorizationError || null,
            hostnameError: hostnameError?.message || null
          });
        });
      });
      request.on("timeout", () => { request.destroy(new Error("Connection timed out")); });
      request.on("error", (err) => reject(new Error(err.message)));
      request.setTimeout(5000);
    });

    return res.status(200).json({ success: true, remaining: 5, result });
  } catch (error) {
    console.error("SSL ERROR:", error);
    return res.status(500).json({ success: false, error: error.message || "SSL check failed" });
  }
};
