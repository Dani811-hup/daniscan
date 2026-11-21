
const tls = require("node:tls");
const dns = require("node:dns").promises;
const net = require("node:net");
const { Redis } = require("@upstash/redis");
const { Ratelimit } = require("@upstash/ratelimit");

const redis = Redis.fromEnv();

const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(5, "1 d"),
  prefix: "daniscan:ssl"
});

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : "";

    if (!ip || net.isIP(ip) === 0) {
      return res.status(400).json({
        success: false,
        error: "Unable to identify client IP"
      });
    }

    const { success, remaining, reset } =
      await limiter.limit(ip);

    res.setHeader("X-RateLimit-Limit", "5");
    res.setHeader("X-RateLimit-Remaining", String(remaining));

    if (!success) {
      return res.status(429).json({
        success: false,
        error: "Daily limit reached. Maximum 5 SSL checks per IP per day.",
        remaining: 0,
        reset
      });
    }

    const target = req.body?.target;

    if (typeof target !== "string" || !target.trim()) {
      return res.status(400).json({
        success: false,
        error: "Enter a domain"
      });
    }

    let url;

    try {
      url = new URL(
        target.includes("://") ? target : `https://${target}`
      );
    } catch {
      return res.status(400).json({
        success: false,
        error: "Invalid domain"
      });
    }

    const host = url.hostname.toLowerCase();

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !host ||
      host === "localhost" ||
      net.isIP(host)
    ) {
      return res.status(400).json({
        success: false,
        error: "Only public HTTPS domains on port 443 are allowed"
      });
    }

    const records = await dns.resolve4(host);

    if (!records.length) {
      throw new Error("Domain has no IPv4 address");
    }

    const blocked = [
      /^0\./,
      /^10\./,
      /^127\./,
      /^169\.254\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^192\.0\.2\./,
      /^198\.18\./,
      /^198\.19\./,
      /^198\.51\.100\./,
      /^203\.0\.113\./,
      /^(22[4-9]|23\d|24\d|25[0-5])\./
    ];

    if (records.some(ip => blocked.some(re => re.test(ip)))) {
      throw new Error("Private or reserved IP blocked");
    }

    const result = await new Promise((resolve, reject) => {
      const socket = tls.connect({
        host: records[0],
        port: 443,
        servername: host,
        rejectUnauthorized: false,
        timeout: 10000
      });

      socket.once("secureConnect", () => {
        const cert = socket.getPeerCertificate();
        const hostnameError = tls.checkServerIdentity(host, cert);

        if (!cert || !cert.valid_to) {
          socket.destroy();
          return reject(new Error("Certificate unavailable"));
        }

        const now = Date.now();
        const expiry = new Date(cert.valid_to);
        const issued = new Date(cert.valid_from);
        const days = Math.ceil(
          (expiry.getTime() - now) / 86400000
        );

        const valid =
          socket.authorized &&
          !hostnameError &&
          now >= issued.getTime() &&
          now <= expiry.getTime();

        const data = {
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
        };

        socket.destroy();
        resolve(data);
      });

      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("Connection timed out"));
      });

      socket.once("error", err => {
        socket.destroy();
        reject(new Error(err.message));
      });
    });

    return res.status(200).json({
      success: true,
      remaining,
      result
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "SSL check failed"
    });
  }
};
