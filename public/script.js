
const targetInput = document.getElementById("target");
const pingBtn = document.getElementById("pingBtn");
const portBtn = document.getElementById("nmapBtn");
const dnsBtn = document.getElementById("dnsBtn");
const result = document.getElementById("result");
const authorization = document.getElementById("authorization");

// Existing authorization modal from index.html
const modal = document.getElementById("permissionModal");
const confirmBox = document.getElementById("permissionConfirm");
const continueBtn = document.getElementById("permissionContinue");
const cancelBtn = document.getElementById("permissionCancel");

function showResult(message) {
  if (result) result.textContent = message;
}

// AUTHORIZATION MODAL

let pendingAction = null;

function askPermission(action) {
  pendingAction = action;

  modal.style.display = "flex";
  confirmBox.checked = false;
  continueBtn.disabled = true;
}

confirmBox.addEventListener("change", function () {
  continueBtn.disabled = !confirmBox.checked;
});

continueBtn.addEventListener("click", function () {
  if (!confirmBox.checked || !pendingAction) return;

  const action = pendingAction;
  pendingAction = null;

  modal.style.display = "none";
  authorization.checked = true;

  action();
});

cancelBtn.addEventListener("click", function () {
  modal.style.display = "none";
  confirmBox.checked = false;
  continueBtn.disabled = true;
  pendingAction = null;
});

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

async function getAPIData(url) {
  const response = await fetch(url);

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid server response. Please try again.");
  }

  if (!response.ok) {
    throw new Error(data.details || data.error || "Server request failed.");
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

// BUTTON EVENTS

pingBtn.addEventListener("click", function () {
  askPermission(runPing);
});

portBtn.addEventListener("click", function () {
  askPermission(runPorts);
});

dnsBtn.addEventListener("click", function () {
  askPermission(runDNS);
});

// INITIAL MESSAGE

showResult("Waiting for diagnostic request...");
