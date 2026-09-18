const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
require("dotenv").config();

const hardwareService = require("./services/hardwareService");
const { createHardwareManager } = require("./services/hardwareManager");
const { getBtcPrice, createQuote, settleTransaction } = require("./services/cloudBridge");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
const PORT = process.env.PORT || 3000;

const atmState = {
  layer: "Layer 2",
  status: "READY",
  hardware: {
    connection: "disconnected",
    enabled: false,
    status: "discovering",
    cashInserted: 0,
  },
  transaction: {
    id: null,
    type: "BUY",
    walletAddress: "",
    amount: 0,
    status: "IDLE",
    cashInserted: 0,
    hardwareStatus: "IDLE",
    cloudStatus: "READY",
    quote: null,
    lastError: null,
  },
  lastError: null,
};

const hardwareEventLog = [];

const failureStates = new Set([
  "CANCELLED",
  "TIMEOUT",
  "HARDWARE_ERROR",
  "NETWORK_ERROR",
  "PAYMENT_ERROR",
]);

const emitTransactionState = () => {
  io.emit("transaction:state", {
    status: atmState.status,
    transaction: atmState.transaction,
  });
};

const applyFailure = (code, message) => {
  atmState.status = code;
  atmState.transaction.status = code;
  atmState.lastError = { code, message };
  atmState.transaction.lastError = { code, message };
  emitTransactionState();
};

const applyHardwareEvent = (event) => {
  if (!event || !event.type) {
    return;
  }

  switch (event.type) {
    case "DEVICE_CONNECTED":
      atmState.hardware.connection = "connected";
      atmState.hardware.enabled = true;
      atmState.hardware.status = "idle";
      atmState.transaction.hardwareStatus = "CONNECTED";
      break;
    case "DEVICE_DISCONNECTED":
      atmState.hardware.connection = "disconnected";
      atmState.hardware.enabled = false;
      atmState.hardware.status = "offline";
      atmState.transaction.hardwareStatus = "DISCONNECTED";
      applyFailure("HARDWARE_ERROR", "Device disconnected from Layer 1");
      break;
    case "NOTE_DETECTED":
      atmState.hardware.status = "NOTE_DETECTED";
      atmState.transaction.status = "NOTE_DETECTED";
      atmState.transaction.hardwareStatus = "NOTE_DETECTED";
      break;
    case "NOTE_ACCEPTED": {
      const value = Number(event.data?.value || 0);
      atmState.hardware.status = "accepting";
      atmState.hardware.cashInserted = value;
      atmState.transaction.amount = value;
      atmState.transaction.cashInserted = value;
      atmState.transaction.status = "CASH_SECURED";
      atmState.transaction.hardwareStatus = "NOTE_ACCEPTED";
      atmState.status = "BUSY";
      break;
    }
    case "NOTE_STACKED":
      atmState.hardware.status = "stacked";
      atmState.transaction.status = "STACKING";
      atmState.transaction.hardwareStatus = "NOTE_STACKED";
      break;
    default:
      break;
  }
};

const recordHardwareEvent = (event) => {
  const payload = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  hardwareEventLog.unshift(payload);
  if (hardwareEventLog.length > 20) {
    hardwareEventLog.length = 20;
  }

  return payload;
};

const emitHardwareEvent = (event) => {
  const payload = recordHardwareEvent(event);

  applyHardwareEvent(payload);
  hardwareManager.handleHardwareEvent(payload);

  io.emit("hardware:event", payload);
  emitHardwareStatus();
  emitTransactionState();
};

const emitHardwareStatus = () => {
  io.emit("hardware:status", {
    ...atmState.hardware,
    lifecycle: hardwareManager.getState(),
  });
};

const hardwareManager = createHardwareManager({
  onStateChange: (lifecycle) => {
    atmState.hardware = {
      ...atmState.hardware,
      connection: lifecycle.connection,
      enabled: lifecycle.enabled,
      lifecycleState: lifecycle.state,
      device: lifecycle.device,
      endpoint: lifecycle.endpoint,
      port: lifecycle.port,
      ready: lifecycle.ready,
      lastSeen: lifecycle.lastSeen,
      lastError: lifecycle.lastError,
    };
    emitHardwareStatus();
  },
  onEvent: (event) => {
    emitHardwareEvent(event);
  },
});

io.on("connection", (socket) => {
  socket.emit("hardware:stream", hardwareEventLog);

  socket.on("hardware:register", (deviceInfo) => {
    const payload = {
      type: "DEVICE_CONNECTED",
      timestamp: new Date().toISOString(),
      data: {
        device: deviceInfo?.device || "NV200",
        status: deviceInfo?.status || "connected",
      },
    };

    emitHardwareEvent(payload);
  });

  socket.on("hardware:event", (event) => {
    if (!event || !event.type) {
      return;
    }

    emitHardwareEvent(event);
  });
});

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "BTC ATM Layer 2",
    layer: "Layer 2",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/atm/status", (req, res) => {
  res.json({
    status: atmState.status,
    hardware: atmState.hardware,
    layer: atmState.layer,
    transaction: atmState.transaction,
  });
});

app.get("/api/atm/transaction-state", (req, res) => {
  res.json({
    layer: atmState.layer,
    transaction: atmState.transaction,
  });
});

app.get("/api/atm/hardware-events", (req, res) => {
  res.json({
    events: hardwareEventLog,
    last: hardwareEventLog[0] || null,
  });
});

app.post("/api/transaction/start", (req, res) => {
  const { type = "BUY", walletAddress = "", amount = 0 } = req.body || {};

  atmState.transaction = {
    id: `ATM-001-TX-${Date.now()}`,
    type,
    walletAddress,
    amount,
    status: "AWAITING_CASH",
    cashInserted: 0,
    hardwareStatus: "CONNECTED",
    cloudStatus: "READY",
    quote: null,
    lastError: null,
  };

  atmState.status = "BUSY";
  atmState.lastError = null;

  emitHardwareEvent({
    type: "DEVICE_CONNECTED",
    data: { device: "NV200", status: "connected" },
  });

  res.json({
    success: true,
    transaction: atmState.transaction,
  });
});

app.post("/api/transaction/confirm", async (req, res) => {
  const amount = Number(req.body?.amount || atmState.transaction.amount || 0);
  const walletAddress = req.body?.walletAddress || atmState.transaction.walletAddress || "";

  atmState.transaction.status = "PROCESSING_PAYMENT";
  atmState.transaction.hardwareStatus = "PROCESSING";
  atmState.status = "PROCESSING";
  atmState.transaction.cloudStatus = "REQUESTING_QUOTE";

  try {
    const quote = await createQuote({
      amountUsd: amount,
      type: atmState.transaction.type,
      walletAddress,
    });

    atmState.transaction.quote = quote;
    atmState.transaction.cloudStatus = "QUOTE_READY";
    atmState.transaction.status = "AWAITING_CONFIRMATION";
    atmState.status = "READY";
    emitTransactionState();

    res.json({
      success: true,
      transaction: atmState.transaction,
      quote,
    });
  } catch (error) {
    const failure = { code: "PAYMENT_ERROR", message: error.message };
    atmState.lastError = failure;
    atmState.transaction.lastError = failure;
    atmState.transaction.cloudStatus = "ERROR";
    atmState.transaction.status = "PAYMENT_ERROR";
    atmState.status = "PAYMENT_ERROR";
    emitTransactionState();

    res.status(502).json({
      success: false,
      error: failure,
    });
  }
});

app.post("/api/transaction/complete", async (req, res) => {
  try {
    const settlement = await settleTransaction({
      transactionId: atmState.transaction.id,
      walletAddress: atmState.transaction.walletAddress,
      amountUsd: Number(atmState.transaction.amount || 0),
      btcAmount: atmState.transaction.quote?.btcAmount || 0,
    });

    atmState.transaction.status = "COMPLETED";
    atmState.transaction.cloudStatus = "SETTLED";
    atmState.status = "READY";
    atmState.lastError = null;
    atmState.transaction.lastError = null;

    emitHardwareEvent({
      type: "NOTE_STACKED",
      data: { value: Number(atmState.transaction.amount || 0), currency: "USD" },
    });

    res.json({
      success: true,
      transaction: atmState.transaction,
      settlement,
    });
  } catch (error) {
    applyFailure("NETWORK_ERROR", error.message);
    res.status(502).json({
      success: false,
      error: { code: "NETWORK_ERROR", message: error.message },
    });
  }
});

app.post("/api/transaction/failure", (req, res) => {
  const { code = "TIMEOUT", message = "Transaction failed" } = req.body || {};

  applyFailure(code, message);

  res.json({
    success: false,
    error: { code, message },
  });
});

app.post("/api/transaction/cancel", (req, res) => {
  const { reason = "Cancelled by user" } = req.body || {};
  applyFailure("CANCELLED", reason);

  res.json({
    success: false,
    error: { code: "CANCELLED", message: reason },
  });
});

app.get("/api/cloud/health", async (req, res) => {
  const price = await getBtcPrice();

  res.json({
    layer: "Layer 2",
    cloud: price,
  });
});

app.get("/api/cloud/price", async (req, res) => {
  const price = await getBtcPrice();
  res.json(price);
});

app.post("/api/cloud/quote", async (req, res) => {
  try {
    const quote = await createQuote(req.body || {});
    atmState.transaction.quote = quote;
    atmState.transaction.cloudStatus = "QUOTE_READY";
    emitTransactionState();
    res.json({
      layer: "Layer 2",
      quote,
    });
  } catch (error) {
    applyFailure("NETWORK_ERROR", error.message);
    res.status(502).json({
      success: false,
      error: { code: "NETWORK_ERROR", message: error.message },
    });
  }
});

app.post("/api/cloud/settle", async (req, res) => {
  try {
    const result = await settleTransaction(req.body || {});
    atmState.transaction.cloudStatus = "SETTLED";
    atmState.transaction.status = "COMPLETED";
    emitTransactionState();
    res.json(result);
  } catch (error) {
    applyFailure("PAYMENT_ERROR", error.message);
    res.status(502).json({
      success: false,
      error: { code: "PAYMENT_ERROR", message: error.message },
    });
  }
});

app.get("/api/hardware/status", async (req, res) => {
  try {
    const status = await hardwareService.getHardwareStatus();

    res.json({
      layer: "Layer 2",
      hardware: status,
      lifecycle: hardwareManager.getState(),
    });
  } catch (error) {
    res.status(503).json({
      layer: "Layer 2",
      hardware: {
        ...atmState.hardware,
        connection: "disconnected",
        ready: false,
      },
      lifecycle: hardwareManager.getState(),
      error: error.message,
    });
  }
});

app.post("/api/hardware/enable", async (req, res) => {
  try {
    const result = await hardwareService.enableHardware();

    res.json({
      layer: "Layer 2",
      hardware: result,
    });
  } catch (error) {
    res.status(503).json({
      error: error.message,
    });
  }
});

app.post("/api/hardware/disable", async (req, res) => {
  try {
    const result = await hardwareService.disableHardware();

    res.json({
      layer: "Layer 2",
      hardware: result,
    });
  } catch (error) {
    res.status(503).json({
      error: error.message,
    });
  }
});

app.post("/api/hardware/accept", async (req, res) => {
  try {
    const result = await hardwareService.acceptCash();

    res.json({
      layer: "Layer 2",
      hardware: result,
    });
  } catch (error) {
    res.status(503).json({
      error: error.message,
    });
  }
});

io.on("connection", (socket) => {
  socket.emit("hardware:status", {
    ...atmState.hardware,
    lifecycle: hardwareManager.getState(),
  });

  socket.on("hardware:register", (payload = {}) => {
    const { device = "NV200" } = payload;
    atmState.hardware.connection = "connected";
    atmState.hardware.enabled = true;

    emitHardwareEvent({
      type: "DEVICE_CONNECTED",
      data: { device, status: "connected" },
    });
  });

  socket.on("hardware:event", (event) => {
    if (!event || !event.type) return;
    emitHardwareEvent(event);

    if (event.type === "NOTE_ACCEPTED") {
      const value = Number(event.data?.value || 0);
      atmState.hardware.cashInserted = value;
      atmState.hardware.status = "accepting";
    }

    if (event.type === "NOTE_REJECTED") {
      applyFailure("HARDWARE_ERROR", "Note rejected by hardware");
    }
  });
});

server.listen(PORT, () => {
  console.log(`Layer 2 server running on http://localhost:${PORT}`);
  hardwareManager.start();
});
