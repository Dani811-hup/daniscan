const dns = require("node:dns").promises;
const net = require("node:net");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const target = String(req.query.target || "").toLowerCase();

  const validDomain =
    target.length <= 253 &&
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(target);

  if (!validDomain || net.isIP(target)) {
    return res.status(400).json({
      error: "Enter a valid domain name."
    });
  }

  async function lookup(method) {
    try {
      return await dns[method](target);
    } catch (error) {
      if (["ENODATA", "ENOTFOUND", "ESERVFAIL"].includes(error.code)) {
        return [];
      }
      throw error;
    }
  }

  try {
    const [A, AAAA, MX, NS] = await Promise.all([
      lookup("resolve4"),
      lookup("resolve6"),
      lookup("resolveMx"),
      lookup("resolveNs")
    ]);

    return res.status(200).json({
      target,
      records: { A, AAAA, MX, NS }
    });
  } catch {
    return res.status(502).json({
      error: "DNS lookup failed. Please try again."
    });
  }
};
