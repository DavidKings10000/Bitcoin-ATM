const HARDWARE_URL = "http://localhost:5000/api";

async function getHardwareStatus() {
  const response = await fetch(`${HARDWARE_URL}/status`);

  if (!response.ok) {
    throw new Error("Hardware simulator unavailable");
  }

  return response.json();
}

async function enableHardware() {
  const response = await fetch(`${HARDWARE_URL}/enable`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to enable hardware");
  }

  return response.json();
}

async function disableHardware() {
  const response = await fetch(`${HARDWARE_URL}/disable`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to disable hardware");
  }

  return response.json();
}

async function acceptCash() {
  const response = await fetch(`${HARDWARE_URL}/accept`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to enable cash acceptance");
  }

  return response.json();
}

module.exports = {
  getHardwareStatus,
  enableHardware,
  disableHardware,
  acceptCash,
};
