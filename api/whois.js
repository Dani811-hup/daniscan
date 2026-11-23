export default async function handler(req, res) {
  const { domain } = req.query;

  if (!domain) {
    return res.status(400).json({ error: "Domain parameter is required." });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  const tld = cleanDomain.split(".").pop();

  // Direct fast RDAP servers for common TLDs
  let rdapUrl = `https://rdap.org{encodeURIComponent(cleanDomain)}`;
  if (tld === "com" || tld === "net") {
    rdapUrl = `https://verisign.com{tld}/v1/domain/${encodeURIComponent(cleanDomain)}`;
  } else if (tld === "org") {
    rdapUrl = `https://publicinterestregistry.org{encodeURIComponent(cleanDomain)}`;
  }

  try {
    const response = await fetch(rdapUrl, {
      headers: {
        "Accept": "application/rdap+json, application/json",
        "User-Agent": "DaniScan-NetworkDiagnostic/1.0"
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: "Domain is not registered or not found." });
      }
      return res.status(response.status).json({ error: `Registry returned HTTP ${response.status}` });
    }

    const data = await response.json();

    // Events (Created, Updated, Expiry dates) nikalein
    const events = data.events || [];
    const createdEvent = events.find(e => e.eventAction === "registration");
    const expiryEvent = events.find(e => e.eventAction === "expiration");
    const updatedEvent = events.find(e => e.eventAction === "last changed");

    // Registrar ka naam nikalein
    let registrar = "Unknown";
    const registrarEntity = (data.entities || []).find(e => (e.roles || []).includes("registrar"));
    if (registrarEntity && registrarEntity.vcardArray && Array.isArray(registrarEntity.vcardArray[1])) {
      const fnField = registrarEntity.vcardArray[1].find(item => item[0] === "fn");
      if (fnField && fnField[3]) {
        registrar = fnField[3];
      }
    }

    // Name Servers nikalein
    const nameServers = (data.nameservers || []).map(ns => ns.ldhName).filter(Boolean);

    // Domain Status nikalein
    const statuses = data.status || [];

    return res.status(200).json({
      domain: data.ldhName || cleanDomain.toUpperCase(),
      registrar,
      createdDate: createdEvent ? createdEvent.eventDate.split("T")[0] : "N/A",
      expiryDate: expiryEvent ? expiryEvent.eventDate.split("T")[0] : "N/A",
      updatedDate: updatedEvent ? updatedEvent.eventDate.split("T")[0] : "N/A",
      statuses,
      nameServers
    });

  } catch (error) {
    return res.status(500).json({
      error: "Connection failed: " + error.message
    });
  }
}
