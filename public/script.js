const targetInput = document.getElementById("target");
const pingBtn = document.getElementById("pingBtn");
const portBtn = document.getElementById("nmapBtn");
const dnsBtn = document.getElementById("dnsBtn");
const sslBtn = document.getElementById("sslBtn");
const result = document.getElementById("result");
const authorization = document.getElementById("authorization");

// AUTHORIZATION MODAL
const modal = document.getElementById("permissionModal");
const confirmBox = document.getElementById("permissionConfirm");
const continueBtn = document.getElementById("permissionContinue");
const cancelBtn = document.getElementById("permissionCancel");

function showResult(message) {
  if (result) result.textContent = message;
}

let pendingAction = null;

function askPermission(action) {
  if (!modal || !confirmBox || !continueBtn) {
    showResult("Permission modal is missing from index.html");
    return;
  }

  pendingAction = action;
  modal.style.display = "flex";
  confirmBox.checked = false;
  continueBtn.disabled = true;
}

if (confirmBox) {
  confirmBox.addEventListener("change", function () {
    continueBtn.disabled = !confirmBox.checked;
  });
}

if (continueBtn) {
  continueBtn.addEventListener("click", function () {
    if (!confirmBox.checked || !pendingAction) return;

    const action = pendingAction;
    pendingAction = null;

    modal.style.display = "none";

    if (authorization) authorization.checked = true;

    action();
  });
}

if (cancelBtn) {
  cancelBtn.addEventListener("click", function () {
    modal.style.display = "none";
    confirmBox.checked = false;
    continueBtn.disabled = true;
    pendingAction = null;
  });
}

// TARGET VALIDATION

function getTarget() {
  const target = targetInput.value.trim().toLowerCase();

  const pattern =
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

  if (!pattern.test(target)) {
    showResult("Enter a valid domain, for example: example.com");
    return null;
  }

  return target;
}

// API RESPONSE HANDLER

async function getAPIData(url, options = {}) {
  const response = await fetch(url, options);

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid server response. HTTP " + response.status);
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.details ||
      "Server request failed."
    );
  }

  return data;
}

// PING CHECK

async function runPing() {
  const target = getTarget();
  if (!target) return;

  showResult("Checking website... Please wait.");

  try {
    const start = performance.now();

    const data = await getAPIData(
      `/api/ping?target=${encodeURIComponent(target)}`
    );

    showResult(
      `PING CHECK

Target: ${data.target}
Status: ${data.status}
IP: ${data.ip}
HTTP Status: ${data.httpStatus}
Response Time: ${Math.round(performance.now() - start)} ms`
    );

  } catch (error) {
    showResult("Ping failed: " + error.message);
  }
}

// DNS LOOKUP

async function runDNS() {
  const target = getTarget();
  if (!target) return;

  showResult("Looking up DNS records... Please wait.");

  try {
    const data = await getAPIData(
      `/api/dns?target=${encodeURIComponent(target)}`
    );

    const r = data.records || {};

    showResult(
      `DNS LOOKUP

Domain: ${data.target}

A RECORD:
${(r.A || []).join("\n") || "None"}

AAAA RECORD:
${(r.AAAA || []).join("\n") || "None"}

MX RECORD:
${(r.MX || []).map(x =>
  x.exchange + " (Priority " + x.priority + ")"
).join("\n") || "None"}

NS RECORD:
${(r.NS || []).join("\n") || "None"}`
    );

  } catch (error) {
    showResult("DNS failed: " + error.message);
  }
}

// PORT CHECK

async function runPorts() {
  const target = getTarget();
  if (!target) return;

  showResult("Checking supported ports... Please wait.");

  try {
    const data = await getAPIData(
      `/api/ports?target=${encodeURIComponent(target)}`
    );

    const lines = (data.results || []).map(x =>
      "Port " + x.port + ": " + x.status
    ).join("\n");

    showResult(
      `PORT CHECK

Target: ${data.target}
IP: ${data.ip}

${lines || "No port results returned."}`
    );

  } catch (error) {
    showResult("Port check failed: " + error.message);
  }
}

// SSL / TLS CHECK

async function runSSL() {
  const target = getTarget();
  if (!target) return;

  showResult("Checking SSL certificate... Please wait.");

  try {
    const data = await getAPIData("/api/ssl", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ target })
    });

    const r = data.result;

    if (!r) {
      throw new Error("SSL result missing from server.");
    }

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

// BUTTON EVENTS

if (pingBtn) {
  pingBtn.addEventListener("click", () => {
    askPermission(runPing);
  });
}

if (portBtn) {
  portBtn.addEventListener("click", () => {
    askPermission(runPorts);
  });
}

if (dnsBtn) {
  dnsBtn.addEventListener("click", () => {
    askPermission(runDNS);
  });
}

if (sslBtn) {
  sslBtn.addEventListener("click", () => {
    askPermission(runSSL);
  });
}
async function checkSecurityHeaders() {
  // 1. Apne domain input box aur terminal box ki exact ID yahan likhein
  const domain = document.getElementById('domainInput').value.trim(); 
  const terminal = document.getElementById('terminalOutput'); 

  if (!domain) {
    terminal.innerText = '[ ERROR ] Please enter a target domain first!';
    return;
  }

  terminal.innerText = `[ SYSTEM ] Checking Security Headers for ${domain}...\n[ STATUS ] Scanning...`;

  try {
    const res = await fetch(`/api/headers?domain=${encodeURIComponent(domain)}`);
    const data = await res.json();

    if (data.error) {
      terminal.innerText = `[ ERROR ] ${data.error}`;
      return;
    }

    let text = `[ TARGET ] ${data.target}\n`;
    text += `[ SECURITY SCORE ] ${data.score}\n`;
    text += `────────────────────────────────────\n`;

    data.results.forEach(item => {
      const sign = item.status === 'PASS' ? '[ PASS ]' : '[ MISSING ]';
      text += `${sign} ${item.name}\n`;
    });

    terminal.innerText = text;
  } catch (err) {
    terminal.innerText = '[ ERROR ] Connection failed. Try again.';
  }
}


