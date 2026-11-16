const targetInput = document.getElementById("target");
const pingBtn = document.getElementById("pingBtn");
const portBtn = document.getElementById("nmapBtn");
const dnsBtn = document.getElementById("dnsBtn");
const result = document.getElementById("result");
const authorization = document.getElementById("authorization");

function showResult(message) {
  result.textContent = message;
}

const style = document.createElement("style");
style.textContent = `
#permissionModal {
  display:none;
  position:fixed;
  inset:0;
  z-index:999999;
  background:rgba(0,0,0,.88);
  align-items:center;
  justify-content:center;
  padding:20px;
}
.permission-card {
  width:100%;
  max-width:420px;
  background:#101b30;
  border:1px solid #00d9ff;
  border-radius:18px;
  padding:24px;
  color:white;
}
.permission-card h2 {color:#ffc247}
.permission-card p {color:#b8c5d8;line-height:1.6}
.permission-card label {
  display:flex;
  gap:10px;
  align-items:center;
  margin:22px 0;
}
.permission-card button {
  width:100%;
  padding:14px;
  border:0;
  border-radius:10px;
  margin-top:10px;
  color:white;
  background:#087cdb;
  font-weight:bold;
}
.permission-card button:disabled {opacity:.4}
.permission-card .cancel {background:#35425a}
`;
document.head.appendChild(style);

const modal = document.createElement("div");
modal.id = "permissionModal";
modal.innerHTML = `
  <div class="permission-card">
    <h2>🛡 AUTHORIZATION REQUIRED</h2>
    <p>Only test domains you own or have explicit permission to assess.</p>
    <label>
      <input type="checkbox" id="permissionConfirm">
      I have permission to test this domain.
    </label>
    <button id="permissionContinue" disabled>CONTINUE</button>
    <button id="permissionCancel" class="cancel">CANCEL</button>
  </div>
`;
document.body.appendChild(modal);

const confirmBox = document.getElementById("permissionConfirm");
const continueBtn = document.getElementById("permissionContinue");

confirmBox.addEventListener("change", () => {
  continueBtn.disabled = !confirmBox.checked;
});

function askPermission(action) {
  modal.style.display = "flex";
  confirmBox.checked = false;
  continueBtn.disabled = true;

  continueBtn.onclick = () => {
    if (!confirmBox.checked) return;
    modal.style.display = "none";
    authorization.checked = true;
    action();
  };
}

document.getElementById("permissionCancel").onclick = () => {
  modal.style.display = "none";
};

function getTarget() {
  const target = targetInput.value.trim().toLowerCase();

  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(target)) {
    showResult("Enter a valid domain, for example: example.com");
    return null;
  }

  return target;
}

async function runPing() {
  const target = getTarget();
  if (!target) return;

  showResult("Checking website...");

  try {
    const start = performance.now();
    const response = await fetch(`/api/ping?target=${encodeURIComponent(target)}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.details || data.error);

    showResult(
      `PING CHECK\n\nTarget: ${data.target}\nStatus: ${data.status}\nIP: ${data.ip}\nHTTP Status: ${data.httpStatus}\nResponse Time: ${Math.round(performance.now() - start)} ms`
    );
  } catch (error) {
    showResult("Ping failed: " + error.message);
  }
}

async function runDNS() {
  const target = getTarget();
  if (!target) return;

  showResult("Looking up DNS records...");

  try {
    const response = await fetch(`/api/dns?target=${encodeURIComponent(target)}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.error);

    const r = data.records;

    showResult(
      `DNS LOOKUP\n\nDomain: ${data.target}\n\nA RECORD:\n${r.A.join("\n") || "None"}\n\nAAAA RECORD:\n${r.AAAA.join("\n") || "None"}\n\nMX RECORD:\n${r.MX.map(x => x.exchange + " (Priority " + x.priority + ")").join("\n") || "None"}\n\nNS RECORD:\n${r.NS.join("\n") || "None"}`
    );
  } catch (error) {
    showResult("DNS failed: " + error.message);
  }
}

async function runPorts() {
  const target = getTarget();
  if (!target) return;

  showResult("Checking web ports 80 and 443...");

  try {
    const response = await fetch(`/api/ports?target=${encodeURIComponent(target)}`);
    const data = await response.json();

    if (!response.ok) throw new Error(data.details || data.error);

    const lines = data.results.map(x =>
      "Port " + x.port + ": " + x.status
    ).join("\n");

    showResult(
      `PORT CHECK\n\nTarget: ${data.target}\nIP: ${data.ip}\n\n${lines}`
    );
  } catch (error) {
    showResult("Port check failed: " + error.message);
  }
}

pingBtn.addEventListener("click", () => askPermission(runPing));
portBtn.addEventListener("click", () => askPermission(runPorts));
dnsBtn.addEventListener("click", () => askPermission(runDNS));

showResult("Waiting for diagnostic request...");
