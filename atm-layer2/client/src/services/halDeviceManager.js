export const DEVICE_STATES = Object.freeze({
  DISCOVERING: "DISCOVERING",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  READY: "READY",
  DISCONNECTED: "DISCONNECTED",
  ERROR: "ERROR",
  RECONNECTING: "RECONNECTING",
});

export const createDevice = ({ id, type, label, status = DEVICE_STATES.DISCOVERING, port = "", currency = "KES", balance = 0, sessionDeposits = 0, details = {} }) => ({
  id,
  type,
  label,
  status,
  connected: status === DEVICE_STATES.CONNECTED || status === DEVICE_STATES.READY,
  port,
  currency,
  balance,
  sessionDeposits,
  lastSeen: new Date().toISOString(),
  lastError: null,
  ...details,
});

export const buildInitialDevices = () => ({
  recycler: createDevice({
    id: "recycler",
    type: "recycler",
    label: "NV200 Recycler",
    status: DEVICE_STATES.DISCOVERING,
    port: "COM5",
    currency: "KES",
    balance: 2450,
    sessionDeposits: 0,
    details: { protocol: "SSP / eSSP", countryCode: "KE", realValueMultiplier: 1 },
  }),
  printer: createDevice({
    id: "printer",
    type: "printer",
    label: "K80 Printer",
    status: DEVICE_STATES.DISCOVERING,
    port: "USB: 0x0DD4 / 0x0237",
    currency: "N/A",
    balance: 0,
    details: { vendorId: "0x0DD4", productId: "0x0237", driverStatus: "checking" },
  }),
  camera: createDevice({
    id: "camera",
    type: "camera",
    label: "General Camera",
    status: DEVICE_STATES.DISCOVERING,
    details: { cameraType: "general" },
  }),
  qr: createDevice({
    id: "qr",
    type: "qr",
    label: "QR Scanner",
    status: DEVICE_STATES.DISCOVERING,
    details: { cameraType: "qr" },
  }),
  touch: createDevice({
    id: "touch",
    type: "touch",
    label: "Touchscreen",
    status: DEVICE_STATES.READY,
    connected: true,
    details: { touchCount: 0 },
  }),
});

export const appendLogEntry = (logs, prefix, message, level = "info") => {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    prefix,
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  return [entry, ...logs].slice(0, 60);
};
