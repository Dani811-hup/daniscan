const dns = require("node:dns").promises;
const net = require("node:net");

function isPublicIPv4(ip) {
  if (net.isIP(ip) !== 4) return false;

  const [a, b] = ip.split(".").map(Number);

  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 203 && b === 0 && ip.split(".")[2] === "113")
  );
}

function checkPort(ip, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: ip, port });
    let finished = false;

    function done(status) {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve({ port, status });
    }

    socket.setTimeout(2500);
    socket.once("connect", () => done("Open"));
    socket.once("timeout", () => done("No response"));
    socket.once("error", (err) => {
      done(err.code === "ECONNREFUSED" ? "Closed" : "No response");
    });
  });
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const target = String(req.query.target || "").trim().toLowerCase();

  const valid = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(target);

  if (!valid) {
    return res.status(400).json({ error: "Invalid domain" });
  }

  try {
    const records = await dns.resolve4(target);
    const ip = records.find(isPublicIPv4);

    if (!ip) {
      return res.status(400).json({ error: "No allowed public IPv4 found" });
    }

    const results = await Promise.all([
      checkPort(ip, 80),
      checkPort(ip, 443),
      checkPort(ip, 21),
      checkPort(ip, 22),
      checkPort(ip, 25),
      checkPort(ip, 8080)
    ]);

    res.json({
      target,
      ip,
      results
    });

  } catch (error) {
    res.status(502).json({
      error: "Port check failed",
      details: error.code || error.message
    });
  }
};
