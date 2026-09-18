const DEFAULT_DISCOVERY_PORTS = [5000, 5001, 5002];
const POLL_INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 1500;
const MAX_RECONNECT_DELAY_MS = 30000;

const DEVICE_STATES = Object.freeze({
  DISCOVERING: "DISCOVERING",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  READY: "READY",
  DISCONNECTED: "DISCONNECTED",
  ERROR: "ERROR",
  RECONNECTING: "RECONNECTING",
});

const parsePorts = (value) => {
  const ports = String(value || "")
    .split(",")
    .map((port) => Number(port.trim()))
    .filter((port) => Number.isInteger(port) && port > 0 && port < 65536);

  return ports.length ? ports : DEFAULT_DISCOVERY_PORTS;
};

const createHardwareManager = ({ onStateChange = () => {}, onEvent = () => {} } = {}) => {
  const discoveryPorts = parsePorts(process.env.HARDWARE_DISCOVERY_PORTS);
  let state = {
    device: null,
    state: DEVICE_STATES.DISCOVERING,
    connection: "disconnected",
    ready: false,
    enabled: false,
    status: "discovering",
    endpoint: null,
    port: null,
    protocol: null,
    capabilities: [],
    lastSeen: null,
    lastError: null,
    reconnectAttempt: 0,
    nextRetryAt: null,
  };
  let activeBaseUrl = null;
  let pollTimer = null;
  let reconnectTimer = null;
  let stopped = false;
  let probing = false;

  const publishState = (patch, force = false) => {
    const nextState = { ...state, ...patch };
    const changed = force || JSON.stringify(nextState) !== JSON.stringify(state);
    state = nextState;
    if (changed) {
      onStateChange({ ...state });
    }
  };

  const request = async (baseUrl, path = "/status") => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Hardware endpoint returned ${response.status}`);
      }
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  };

  const normalizeStatus = (status, endpoint) => {
    const ready = status.ready !== undefined
      ? Boolean(status.ready)
      : Boolean(status.connected && status.enabled && status.status !== "disabled");

    return {
      device: status.device || status.model || "Unknown hardware",
      state: ready ? DEVICE_STATES.READY : DEVICE_STATES.CONNECTED,
      connection: status.connection === "connected" ? "connected" : "disconnected",
      ready,
      enabled: Boolean(status.enabled),
      status: status.status || (ready ? "ready" : "not-ready"),
      endpoint,
      port: Number(new URL(endpoint).port),
      protocol: status.protocol || "HTTP status + Socket.IO events",
      capabilities: Array.isArray(status.capabilities) ? status.capabilities : [],
      lastSeen: new Date().toISOString(),
      lastError: null,
      reconnectAttempt: 0,
      nextRetryAt: null,
    };
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) {
      return;
    }

    const reconnectAttempt = state.reconnectAttempt + 1;
    const delay = Math.min(1000 * (2 ** Math.min(reconnectAttempt - 1, 5)), MAX_RECONNECT_DELAY_MS);
    const nextRetryAt = new Date(Date.now() + delay).toISOString();

    publishState({
      state: DEVICE_STATES.RECONNECTING,
      connection: "disconnected",
      ready: false,
      lastError: state.lastError || "Hardware endpoint unavailable.",
      reconnectAttempt,
      nextRetryAt,
    });

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      discoverAndConnect();
    }, delay);
  };

  const markUnavailable = (message) => {
    activeBaseUrl = null;
    publishState({
      state: activeBaseUrl ? DEVICE_STATES.ERROR : DEVICE_STATES.DISCONNECTED,
      connection: "disconnected",
      ready: false,
      enabled: false,
      status: "offline",
      lastError: message,
      lastSeen: state.lastSeen,
    });
    scheduleReconnect();
  };

  const healthCheck = async () => {
    if (stopped || !activeBaseUrl || probing) {
      return;
    }

    probing = true;
    try {
      const status = await request(activeBaseUrl);
      const next = normalizeStatus(status, activeBaseUrl);
      publishState(next);
      if (next.connection !== "connected") {
        markUnavailable("Hardware reported a disconnected state.");
      }
    } catch (error) {
      markUnavailable(error.name === "AbortError" ? "Hardware health check timed out." : error.message);
    } finally {
      probing = false;
    }
  };

  const discoverAndConnect = async () => {
    if (stopped || probing || activeBaseUrl) {
      return;
    }

    probing = true;
    publishState({ state: DEVICE_STATES.DISCOVERING, status: "discovering", lastError: null });

    for (const port of discoveryPorts) {
      const endpoint = `http://localhost:${port}/api`;
      try {
        const status = await request(endpoint);
        publishState({ state: DEVICE_STATES.CONNECTING, status: "connecting" });
        activeBaseUrl = endpoint;
        const next = normalizeStatus(status, endpoint);
        publishState(next, true);
        onEvent({
          type: "DEVICE_IDENTIFIED",
          data: {
            device: next.device,
            endpoint: next.endpoint,
            port: next.port,
            protocol: next.protocol,
            capabilities: next.capabilities,
          },
        });
        probing = false;
        return;
      } catch (error) {
        // Continue probing the next known local hardware endpoint.
      }
    }

    probing = false;
    markUnavailable("No compatible hardware endpoint was discovered.");
  };

  const handleHardwareEvent = (event) => {
    if (!event || !event.type) {
      return;
    }

    if (event.type === "DEVICE_CONNECTED") {
      publishState({
        state: DEVICE_STATES.CONNECTED,
        connection: "connected",
        ready: false,
        enabled: true,
        status: "connected",
        device: event.data?.device || state.device,
        lastSeen: new Date().toISOString(),
        lastError: null,
        reconnectAttempt: 0,
        nextRetryAt: null,
      });
      return;
    }

    if (event.type === "DEVICE_DISCONNECTED") {
      const message = event.data?.message || "Hardware disconnected unexpectedly.";
      activeBaseUrl = null;
      markUnavailable(message);
    }
  };

  const start = () => {
    stopped = false;
    discoverAndConnect();
    pollTimer = setInterval(() => {
      if (activeBaseUrl) {
        healthCheck();
      } else {
        discoverAndConnect();
      }
    }, POLL_INTERVAL_MS);
  };

  const stop = () => {
    stopped = true;
    clearInterval(pollTimer);
    clearTimeout(reconnectTimer);
    pollTimer = null;
    reconnectTimer = null;
  };

  const getState = () => ({ ...state });

  return {
    start,
    stop,
    getState,
    handleHardwareEvent,
    rediscover: discoverAndConnect,
  };
};

module.exports = {
  DEVICE_STATES,
  createHardwareManager,
};
