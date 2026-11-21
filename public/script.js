
// SSL / TLS CERTIFICATE CHECK

async function runSSL() {
  const target = getTarget();
  if (!target) return;

  showResult("Checking SSL certificate... Please wait.");

  try {
    const response = await fetch("/api/ssl", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ target })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "SSL check failed");
    }

    const r = data.result;

    showResult(
      `SSL / TLS CERTIFICATE CHECK

Domain: ${r.domain}
Status: ${r.status}
HTTPS: ${r.https ? "Connected" : "Not connected"}
Certificate Valid: ${r.certificateValid}
Hostname Match: ${r.hostnameMatch}

Issuer: ${r.issuer}
Subject: ${r.subject}

Valid From: ${r.validFrom}
Expiry Date: ${r.validTo}
Days Remaining: ${r.daysRemaining}

Expired: ${r.expired}

Daily Requests Remaining: ${data.remaining}`
    );

  } catch (error) {
    showResult("SSL Check failed: " + error.message);
  }
}
