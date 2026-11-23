import dns from "dns/promises";

export default async function handler(req, res) {
  const { domain } = req.query;

  if (!domain) {
    return res.status(400).json({ error: "Domain parameter is required." });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();

  try {
    // 1. SPF Record Check (Root domain TXT records)
    let spfRecord = null;
    try {
      const txtRecords = await dns.resolveTxt(cleanDomain);
      const flatTxt = txtRecords.map(chunks => chunks.join(""));
      spfRecord = flatTxt.find(record => record.toLowerCase().startsWith("v=spf1")) || null;
    } catch {
      spfRecord = null;
    }

    // 2. DMARC Record Check (_://domain.com TXT records)
    let dmarcRecord = null;
    try {
      const dmarcRecords = await dns.resolveTxt(`_dmarc.${cleanDomain}`);
      const flatDmarc = dmarcRecords.map(chunks => chunks.join(""));
      dmarcRecord = flatDmarc.find(record => record.toLowerCase().startsWith("v=dmarc1")) || null;
    } catch {
      dmarcRecord = null;
    }

    // Security Risk Assessment
    let spoofingRisk = "HIGH RISK (Vulnerable to Fake Emails)";
    if (spfRecord && dmarcRecord) {
      spoofingRisk = "LOW RISK (Protected against Spoofing)";
    } else if (spfRecord || dmarcRecord) {
      spoofingRisk = "MEDIUM RISK (Partial Protection)";
    }

    return res.status(200).json({
      domain: cleanDomain,
      spf: spfRecord,
      dmarc: dmarcRecord,
      riskLevel: spoofingRisk
    });

  } catch (error) {
    return res.status(500).json({
      error: "Email security check failed: " + error.message
    });
  }
}
