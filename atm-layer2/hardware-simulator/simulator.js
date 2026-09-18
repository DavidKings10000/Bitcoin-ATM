const express = require("express");
const cors = require("cors");
const { io } = require("socket.io-client");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

let hardwareState = {
  connected: true,
  enabled: true,
  status: "idle",
  cashInserted: 0,
  cashboxNotes: 0,
  payoutNotes: 0,
  lastCommand: null,
};

const socket = io("http://localhost:3000", {
  transports: ["websocket"],
});

const emitHardwareEvent = (type, data = {}) => {
  if (!socket.connected) {
    return;
  }

  const payload = {
    type,
    timestamp: new Date().toISOString(),
    data,
  };

  hardwareState.lastCommand = type;
  socket.emit("hardware:event", payload);
};

socket.on("connect", () => {
  console.log("Hardware simulator connected to Layer 2 server");
  socket.emit("hardware:register", { device: "NV200", status: "connected" });

  emitHardwareEvent("DEVICE_CONNECTED", { device: "NV200", status: "connected" });

  const noteSequence = [500, 1000];

  noteSequence.forEach((value, index) => {
    setTimeout(() => {
      emitHardwareEvent("NOTE_DETECTED", { value, currency: "KES" });
      emitHardwareEvent("NOTE_ACCEPTED", { value, currency: "KES" });
      hardwareState.status = "accepting";
      hardwareState.cashInserted = value;
      hardwareState.cashboxNotes += 1;
      if (index === noteSequence.length - 1) {
        emitHardwareEvent("NOTE_STACKED", { value, currency: "KES" });
      }
    }, 1200 + index * 1500);
  });
});

socket.on("connect_error", (error) => {
  console.error("Hardware simulator connection error:", error.message);
});

socket.on("disconnect", () => {
  console.log("Hardware simulator disconnected from Layer 2 server");
});

app.get("/api/status", (req, res) => {
  const response = {
    device: "NV200",
    model: "NV200",
    protocol: "ITL SSP / eSSP sidecar",
    transport: "http-sidecar",
    components: ["NV200 validator", "cashbox", "SMART Payout"],
    capabilities: ["cash-in", "cash-out", "note-validation", "smart-payout"],
    connection: hardwareState.connected ? "connected" : "disconnected",
    enabled: hardwareState.enabled,
    ready: hardwareState.connected && hardwareState.enabled,
    status: hardwareState.status,
    cashInserted: hardwareState.cashInserted,
    cashboxNotes: hardwareState.cashboxNotes,
    payoutNotes: hardwareState.payoutNotes,
    payoutCapacity: 70,
    payoutDenominations: [500, 1000],
    lastCommand: hardwareState.lastCommand,
  };

  res.json(response);
});

app.post("/api/enable", (req, res) => {
  hardwareState.enabled = true;
  hardwareState.status = "idle";
  hardwareState.lastCommand = "enable";
  emitHardwareEvent("DEVICE_CONNECTED", { device: "NV200", status: "connected" });

  res.json({
    success: true,
    message: "NV200 enabled",
  });
});

app.post("/api/disable", (req, res) => {
  hardwareState.enabled = false;
  hardwareState.status = "disabled";
  hardwareState.lastCommand = "disable";
  emitHardwareEvent("DEVICE_DISCONNECTED", { device: "NV200", status: "disconnected" });

  res.json({
    success: true,
    message: "NV200 disabled",
  });
});

app.post("/api/accept", (req, res) => {
  if (!hardwareState.enabled) {
    return res.status(400).json({
      success: false,
      message: "NV200 is disabled",
    });
  }

  hardwareState.status = "accepting";
  hardwareState.lastCommand = "accept";
  const noteValue = [500, 1000][Math.floor(Math.random() * 2)];

  emitHardwareEvent("NOTE_DETECTED", { value: noteValue, currency: "KES" });
  emitHardwareEvent("NOTE_ACCEPTED", { value: noteValue, currency: "KES" });

  res.json({
    success: true,
    message: "NV200 is accepting notes",
    value: noteValue,
  });
});

app.post("/api/payout", (req, res) => {
  if (!hardwareState.enabled) {
    return res.status(400).json({ success: false, message: "SMART Payout is disabled" });
  }

  const amount = Number(req.body?.amount || 0);
  const currency = req.body?.currency || "KES";
  const denominations = [500, 1000];

  if (!Number.isInteger(amount) || amount < 500 || amount % 500 !== 0) {
    return res.status(400).json({ success: false, message: "SMART Payout accepts whole KES amounts in 500 KES increments" });
  }

  const noteCount = Math.ceil(amount / 1000);
  if (noteCount > 70) {
    return res.status(400).json({ success: false, message: "Payout exceeds SMART Payout capacity" });
  }

  hardwareState.status = "payout";
  hardwareState.lastCommand = "payout";
  hardwareState.payoutNotes += noteCount;
  emitHardwareEvent("PAYOUT_STARTED", { amount, currency, denominations });
  emitHardwareEvent("PAYOUT_COMPLETED", { amount, currency, noteCount, denominations });

  res.json({
    success: true,
    message: "SMART Payout dispensed notes",
    amount,
    currency,
    noteCount,
    denominations,
  });
});

app.post("/api/reset", (req, res) => {
  hardwareState = {
    connected: true,
    enabled: true,
    status: "idle",
    cashInserted: 0,
    cashboxNotes: 0,
    payoutNotes: 0,
    lastCommand: "reset",
  };

  emitHardwareEvent("DEVICE_CONNECTED", { device: "NV200", status: "connected" });

  res.json({
    success: true,
    message: "NV200 simulator reset",
  });
});

app.listen(PORT, () => {
  console.log(`NV200 simulator running on http://localhost:${PORT}`);
});
