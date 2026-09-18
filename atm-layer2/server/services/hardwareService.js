const HARDWARE_URL = process.env.HARDWARE_URL || "http://localhost:5000/api";

async function requestHardware(path, options = {}) {
  const response = await fetch(`${HARDWARE_URL}${path}`, options);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Hardware endpoint returned ${response.status}`);
  }

  return response.json();
}

async function getHardwareStatus() {
  return requestHardware("/status");
}

async function detectHardware(operation) {
  const status = await getHardwareStatus();
  const device = String(status.device || status.model || "").toUpperCase();
  const capabilities = Array.isArray(status.capabilities) ? status.capabilities : [];
  const components = Array.isArray(status.components) ? status.components : [];
  const capability = operation === "payout" ? "cash-out" : "cash-in";

  if (device !== "NV200") {
    throw new Error(`Expected NV200, detected ${status.device || status.model || "unknown hardware"}`);
  }

  if (status.connection !== "connected" || status.ready === false || status.enabled === false) {
    throw new Error("NV200 is detected but not ready for cash operations");
  }

  if (!capabilities.includes(capability)) {
    throw new Error(`NV200 does not report the ${capability} capability`);
  }

  if (operation === "payout" && !components.some((component) => /smart payout/i.test(component))) {
    throw new Error("NV200 SMART Payout module was not detected");
  }

  return status;
}

async function enableHardware() {
  return requestHardware("/enable", {
    method: "POST",
  });
}

async function disableHardware() {
  return requestHardware("/disable", {
    method: "POST",
  });
}

async function acceptCash() {
  await detectHardware("accept");
  return requestHardware("/accept", {
    method: "POST",
  });
}

async function payoutCash({ amount, currency = "KES" }) {
  await detectHardware("payout");
  return requestHardware("/payout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency }),
  });
}

module.exports = {
  getHardwareStatus,
  detectHardware,
  enableHardware,
  disableHardware,
  acceptCash,
  payoutCash,
};
