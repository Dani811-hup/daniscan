export default async function handler(req, res) {
  const { domain } = req.query;

  if (!domain) {
    return res.status(400).json({ error: "Domain parameter is required." });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();

  try {
    // RDAP API (Free & Official WHOIS replacement)
    const response = await fetch(`https://rdap.org{encodeURIComponent(cleanDomain)}`);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: "Domain not found or TLD not supported by RDAP." });
      }
      return res.status(response.status).json({ error: `WHOIS lookup failed (HTTP ${response.status})` });
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
    if (registrarEntity && registrarEntity.vcardArray && registrarEntity.vcardArray) {
      const fnField = registrarEntity.vcardArray.find(item => item === "fn");
      if (fnField && fnField) {
        registrar = fnField;
      }
    }

    // Name Servers nikalein
    const nameServers = (data.nameservers || []).map(ns => ns.ldhName).filter(Boolean);

    // Domain Status nikalein
    const statuses = data.status || [];

    return res.status(200).json({
      domain: data.ldhName || cleanDomain.toUpperCase(),
      registrar,
      createdDate: createdEvent ? createdEvent.eventDate.split("T") : "N/A",
      expiryDate: expiryEvent ? expiryEvent.eventDate.split("T") : "N/A",
      updatedDate: updatedEvent ? updatedEvent.eventDate.split("T") : "N/A",
      statuses,
      nameServers
    });

  } catch (error) {
    return res.status(500).json({
      error: "Could not fetch WHOIS details. Please try again."
    });
  }
}
