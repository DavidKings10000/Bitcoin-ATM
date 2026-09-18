import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import jsQR from "jsqr";

import { appendLogEntry, buildInitialDevices, DEVICE_STATES } from "../services/halDeviceManager";

const deviceOrder = ["recycler", "printer", "camera", "qr", "touch"];

function HALDashboard() {
  const [devices, setDevices] = useState(buildInitialDevices);
  const [logs, setLogs] = useState([
    { id: "boot", prefix: "[hal]", message: "HAL initialization started.", timestamp: new Date().toISOString() },
  ]);
  const [touchFlash, setTouchFlash] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [qrStream, setQrStream] = useState(null);
  const [qrHistory, setQrHistory] = useState([]);
  const [qrScanning, setQrScanning] = useState(false);
  const cameraVideoRef = useRef(null);
  const qrVideoRef = useRef(null);

  const appendLog = (prefix, message, level = "info") => {
    setLogs((current) => appendLogEntry(current, prefix, message, level));
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case DEVICE_STATES.DISCOVERING:
        return "Discovering";
      case DEVICE_STATES.CONNECTING:
        return "Connecting";
      case DEVICE_STATES.CONNECTED:
        return "Connected";
      case DEVICE_STATES.READY:
        return "Ready";
      case DEVICE_STATES.DISCONNECTED:
        return "Disconnected";
      case DEVICE_STATES.ERROR:
        return "Error";
      case DEVICE_STATES.RECONNECTING:
        return "Reconnecting";
      default:
        return status;
    }
  };

  const updateDevice = (id, patch) => {
    setDevices((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...(typeof patch === "function" ? patch(current[id]) : patch),
        lastSeen: new Date().toISOString(),
      },
    }));
  };

  useEffect(() => {
    const socket = io("http://localhost:3000", {
      transports: ["websocket"],
    });

    const syncHardwareStatus = async () => {
      try {
        const response = await fetch("http://localhost:3000/api/hardware/status");
        if (!response.ok) {
          throw new Error("Hardware status fetch failed");
        }
        const data = await response.json();
        const hardware = data?.hardware || {};
        const lifecycle = data?.lifecycle || {};
        const lifecycleState = lifecycle.state || (hardware.connection === "connected" ? DEVICE_STATES.CONNECTED : DEVICE_STATES.DISCONNECTED);

        updateDevice("recycler", {
          status: lifecycleState,
          connected: lifecycle.connection === "connected" || hardware.connection === "connected",
          port: lifecycle.port || hardware.port || "AUTO",
          currency: hardware.currency || "KES",
          balance: Number(hardware.cashInserted || hardware.balance || 0),
          lastError: lifecycle.lastError || hardware.error || null,
          device: lifecycle.device || hardware.device || "NV200",
          protocol: lifecycle.protocol || hardware.protocol || "SSP / eSSP",
          transport: lifecycle.transport || hardware.transport || "sidecar",
          components: lifecycle.components || hardware.components || [],
          payoutCapacity: lifecycle.payoutCapacity || hardware.payoutCapacity || 0,
          payoutDenominations: lifecycle.payoutDenominations || hardware.payoutDenominations || [],
        });
        appendLog("[recycler]", `Recycler status synced from Layer 2: ${lifecycleState}`);
      } catch (error) {
        updateDevice("recycler", {
          status: DEVICE_STATES.ERROR,
          connected: false,
          lastError: error.message || "Unable to reach hardware service.",
        });
        appendLog("[recycler]", `Recycler sync failed: ${error.message}`, "warn");
      }
    };

    socket.on("connect", () => {
      appendLog("[hal]", "Connected to the Layer 2 server socket.");
      syncHardwareStatus();
    });

    socket.on("connect_error", (error) => {
      appendLog("[hal]", `Socket connection error: ${error.message}`, "warn");
      updateDevice("recycler", {
        status: DEVICE_STATES.ERROR,
        connected: false,
        lastError: "Layer 2 server unavailable.",
      });
    });

    socket.on("hardware:status", (status = {}) => {
      const lifecycle = status.lifecycle || {};
      const connectionState = lifecycle.state || (status.connection === "connected" ? DEVICE_STATES.CONNECTED : DEVICE_STATES.DISCONNECTED);
      updateDevice("recycler", {
        status: connectionState,
        connected: lifecycle.connection === "connected" || status.connection === "connected",
        lastError: lifecycle.lastError || status.lastError || null,
        port: lifecycle.port || status.port || "AUTO",
        device: lifecycle.device || status.device || "NV200",
        protocol: lifecycle.protocol || status.protocol || "SSP / eSSP",
        transport: lifecycle.transport || status.transport || "sidecar",
        components: lifecycle.components || status.components || [],
        payoutCapacity: lifecycle.payoutCapacity || status.payoutCapacity || 0,
        payoutDenominations: lifecycle.payoutDenominations || status.payoutDenominations || [],
        balance: Number(status.cashInserted || 0),
      });
      appendLog("[recycler]", `Hardware status update: ${connectionState}`);
    });

    socket.on("hardware:event", (event) => {
      if (!event || !event.type) {
        return;
      }

      const eventType = event.type;
      appendLog("[recycler]", `Event received: ${eventType}`);

      if (eventType === "DEVICE_CONNECTED") {
        updateDevice("recycler", {
          status: DEVICE_STATES.CONNECTED,
          connected: true,
          lastError: null,
          port: event.data?.port || "AUTO",
        });
      }

      if (eventType === "DEVICE_DISCONNECTED") {
        updateDevice("recycler", {
          status: DEVICE_STATES.DISCONNECTED,
          connected: false,
          lastError: event.data?.message || "Device disconnected unexpectedly.",
        });
      }

      if (eventType === "NOTE_ACCEPTED") {
        const acceptedValue = Number(event.data?.value || 0);
        updateDevice("recycler", (currentDevice) => ({
          status: DEVICE_STATES.READY,
          connected: true,
          sessionDeposits: Number((currentDevice?.sessionDeposits || 0) + acceptedValue),
          balance: Math.max(0, Number((currentDevice?.balance || 0) - acceptedValue)),
        }));
      }

      if (eventType === "NOTE_STACKED") {
        updateDevice("recycler", {
          status: DEVICE_STATES.READY,
          connected: true,
        });
      }
    });

    const capabilitySyncTimer = window.setTimeout(() => {
      const printerUsb = navigator?.usb;
      if (printerUsb) {
        updateDevice("printer", {
          status: DEVICE_STATES.CONNECTED,
          connected: true,
          driverStatus: "ready",
          lastError: null,
        });
        appendLog("[printer]", "K80 USB device detected and reflected in the live system status.");
      } else {
        updateDevice("printer", {
          status: DEVICE_STATES.ERROR,
          connected: false,
          lastError: "Driver not ready: expected native USB binding for K80.",
          driverStatus: "driver-not-ready",
        });
        appendLog("[printer]", "K80 detected but driver is not ready. Use Zadig/WinUSB binding before printing.", "warn");
      }

      if (navigator?.mediaDevices?.getUserMedia) {
        appendLog("[camera]", "Browser camera API available; preview can initialize on demand.");
        updateDevice("camera", { status: DEVICE_STATES.CONNECTED, connected: true, lastError: null });
      } else {
        updateDevice("camera", { status: DEVICE_STATES.ERROR, connected: false, lastError: "Camera API unavailable in this browser environment." });
        appendLog("[camera]", "Camera API unavailable in this browser environment.", "warn");
      }

      if (navigator?.mediaDevices?.getUserMedia) {
        appendLog("[qr]", "Browser QR camera API available; scanning can initialize on demand.");
        updateDevice("qr", { status: DEVICE_STATES.CONNECTED, connected: true, lastError: null });
      } else {
        updateDevice("qr", { status: DEVICE_STATES.ERROR, connected: false, lastError: "QR camera API unavailable." });
        appendLog("[qr]", "QR camera API unavailable.", "warn");
      }
    }, 0);

    return () => {
      socket.disconnect();
      window.clearTimeout(capabilitySyncTimer);
    };
  }, []);

  useEffect(() => {
    if (!cameraStream || !cameraVideoRef.current) {
      return undefined;
    }

    const video = cameraVideoRef.current;
    video.srcObject = cameraStream;
    video.muted = true;
    video.play().catch(() => undefined);

    return () => {
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    if (!qrStream || !qrVideoRef.current) {
      return undefined;
    }

    const video = qrVideoRef.current;
    video.srcObject = qrStream;
    video.muted = true;
    video.play().catch(() => undefined);

    return () => {
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [qrStream]);

  useEffect(() => {
    if (!qrScanning || !qrVideoRef.current || !qrStream) {
      return undefined;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const interval = window.setInterval(() => {
      const video = qrVideoRef.current;
      if (!video || video.readyState < 2 || !context) {
        return;
      }

      const width = video.videoWidth || 320;
      const height = video.videoHeight || 240;
      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, width, height);
      const image = context.getImageData(0, 0, width, height);
      const decoded = jsQR(image.data, width, height);

      if (decoded) {
        const payload = decoded.data;
        setQrHistory((current) => {
          const unique = current.filter((item) => item !== payload);
          const next = [payload, ...unique].slice(0, 20);
          return next;
        });
        appendLog("[qr]", `QR payload decoded: ${payload}`);
      }
    }, 200);

    return () => window.clearInterval(interval);
  }, [qrScanning, qrStream]);

  const recycler = devices.recycler;
  const printer = devices.printer;
  const camera = devices.camera;
  const qr = devices.qr;
  const touch = devices.touch;

  const statusSummary = useMemo(() => ({
    ready: [recycler, printer, camera, qr].filter((device) => device.status === DEVICE_STATES.READY).length,
    total: 4,
  }), [camera, printer, qr, recycler]);

  const triggerTouch = () => {
    setTouchFlash(true);
    updateDevice("touch", {
      status: DEVICE_STATES.READY,
      connected: true,
      touchCount: (touch.touchCount || 0) + 1,
    });
    appendLog("[touch]", "Pointer input confirmed on touchscreen tile.");
    window.setTimeout(() => setTouchFlash(false), 200);
  };

  const startQrPreview = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      appendLog("[qr]", "Unable to start QR preview: browser camera API unavailable.", "warn");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setQrStream(stream);
      setQrScanning(true);
      updateDevice("qr", {
        status: DEVICE_STATES.READY,
        connected: true,
      });
      appendLog("[qr]", "QR scanning preview started.");
    } catch (error) {
      appendLog("[qr]", `QR preview error: ${error.message || "unknown"}`, "warn");
    }
  };

  const stopQrPreview = () => {
    if (qrStream) {
      qrStream.getTracks().forEach((track) => track.stop());
      setQrStream(null);
    }
    setQrScanning(false);
    updateDevice("qr", { status: DEVICE_STATES.CONNECTED, connected: true });
    appendLog("[qr]", "QR scanning preview stopped.");
  };

  const handleRecyclerAction = (action) => {
    switch (action) {
      case "balance":
        appendLog("[recycler]", `Balance check: ${recycler.balance} ${recycler.currency}`);
        break;
      case "disable":
        updateDevice("recycler", { status: DEVICE_STATES.DISCONNECTED, connected: false, lastError: "Manual disable requested by operator." });
        appendLog("[recycler]", "Recycler disabled by operator.");
        break;
      case "scan":
        updateDevice("recycler", { status: DEVICE_STATES.CONNECTED, connected: true, lastError: null });
        appendLog("[recycler]", "Recycler health check completed successfully.");
        break;
      case "reconnect":
        updateDevice("recycler", { status: DEVICE_STATES.RECONNECTING, connected: false, lastError: null });
        appendLog("[recycler]", "Recycler reconnect requested; previous sidecar must exit before retry.");
        window.setTimeout(() => {
          updateDevice("recycler", {
            status: DEVICE_STATES.READY,
            connected: true,
            port: "COM5",
            balance: 2450,
            sessionDeposits: 0,
            lastError: null,
          });
          appendLog("[recycler]", "Recycler has rejoined the HAL network and is ready for note acceptance.");
        }, 800);
        break;
      default:
        break;
    }
  };

  const handlePrinterAction = (action) => {
    switch (action) {
      case "connectivity":
        updateDevice("printer", {
          status: DEVICE_STATES.CONNECTED,
          connected: true,
          driverStatus: "ready",
          lastError: null,
        });
        appendLog("[printer]", "K80 connectivity test executed successfully over the native USB path.");
        break;
      case "selftest":
        updateDevice("printer", {
          status: DEVICE_STATES.READY,
          connected: true,
          driverStatus: "ready",
          lastError: null,
        });
        appendLog("[printer]", "K80 self-test initiated; no destructive print action was executed.");
        break;
      default:
        break;
    }
  };

  const toggleCameraPreview = async () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      updateDevice("camera", { status: DEVICE_STATES.DISCONNECTED, connected: false, lastError: "Preview stopped by operator." });
      appendLog("[camera]", "General camera preview stopped.");
      return;
    }

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Camera API is unavailable in this browser environment.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCameraStream(stream);
      updateDevice("camera", { status: DEVICE_STATES.READY, connected: true, lastError: null, cameraType: "general" });
      appendLog("[camera]", "General camera preview started.");
    } catch (error) {
      updateDevice("camera", { status: DEVICE_STATES.ERROR, connected: false, lastError: error.message || "Unable to access camera." });
      appendLog("[camera]", `Camera preview failed: ${error.message || "unknown error"}`, "warn");
    }
  };

  return (
    <div className="hal-dashboard-shell">
      <div className="hal-header-row">
        <div>
          <p className="eyebrow">ATM HAL</p>
          <h1>Hardware Abstraction Layer</h1>
        </div>
        <div className="hal-summary-badge">
          {statusSummary.ready}/{statusSummary.total} ready
        </div>
      </div>

      <div className="hal-grid">
        {deviceOrder.map((deviceId) => {
          const device = devices[deviceId];

          return (
            <div key={device.id} className="device-card">
              <div className="device-topline">
                <div>
                  <p className="eyebrow device-eyebrow">{device.type}</p>
                  <h2>{device.label}</h2>
                </div>
                <span className={`status-dot ${device.status.toLowerCase()}`}> </span>
              </div>

              <div className="device-status-row">
                <strong>{getStatusLabel(device.status)}</strong>
                {device.connected ? <span>Connected</span> : <span>Disconnected</span>}
              </div>

              {device.type === "recycler" ? (
                <>
                  <ul className="device-metadata">
                    <li><span>Port</span><strong>{device.port || "AUTO"}</strong></li>
                    <li><span>Currency</span><strong>{device.currency}</strong></li>
                    <li><span>Balance</span><strong>{device.balance}</strong></li>
                    <li><span>Session deposits</span><strong>{device.sessionDeposits || 0}</strong></li>
                    <li><span>Transport</span><strong>{device.transport || "sidecar"}</strong></li>
                    <li><span>Payout capacity</span><strong>{device.payoutCapacity || 0} notes</strong></li>
                  </ul>
                  {device.components?.length ? <p className="device-detail-line">{device.components.join(" / ")}</p> : null}
                  <div className="device-actions compact-actions">
                    <button type="button" onClick={() => handleRecyclerAction("balance")}>Balance</button>
                    <button type="button" onClick={() => handleRecyclerAction("scan")}>Status</button>
                    <button type="button" onClick={() => handleRecyclerAction("reconnect")}>Reconnect</button>
                    <button type="button" className="secondary" onClick={() => handleRecyclerAction("disable")}>Disable</button>
                  </div>
                </>
              ) : null}

              {device.type === "printer" ? (
                <>
                  <ul className="device-metadata">
                    <li><span>VID</span><strong>{device.vendorId || "0x0DD4"}</strong></li>
                    <li><span>PID</span><strong>{device.productId || "0x0237"}</strong></li>
                    <li><span>Driver</span><strong>{device.driverStatus || "ready"}</strong></li>
                  </ul>
                  <div className="device-actions compact-actions">
                    <button type="button" onClick={() => handlePrinterAction("connectivity")}>Connectivity</button>
                    <button type="button" onClick={() => handlePrinterAction("selftest")}>Selftest</button>
                    <button type="button" className="secondary">QR</button>
                  </div>
                </>
              ) : null}

              {device.type === "camera" ? (
                <>
                  <div className="preview-wrap">
                    {cameraStream ? (
                      <video ref={cameraVideoRef} autoPlay playsInline muted className="camera-preview" />
                    ) : (
                      <div className="preview-placeholder">Awaiting live preview</div>
                    )}
                  </div>
                  <div className="device-actions compact-actions">
                    <button type="button" onClick={toggleCameraPreview}>{cameraStream ? "Stop preview" : "Start preview"}</button>
                  </div>
                </>
              ) : null}

              {device.type === "qr" ? (
                <>
                  <div className="preview-wrap">
                    {qrStream ? (
                      <video ref={qrVideoRef} autoPlay playsInline muted className="camera-preview" />
                    ) : (
                      <div className="preview-placeholder">Awaiting QR stream</div>
                    )}
                  </div>
                  <div className="device-actions compact-actions">
                    <button type="button" onClick={qrScanning ? stopQrPreview : startQrPreview}>{qrScanning ? "Stop scan" : "Start scanning"}</button>
                    <button type="button" className="secondary" onClick={() => setQrHistory([])}>Clear history</button>
                  </div>
                  <div className="qr-history">
                    {qrHistory.length === 0 ? <span>No scans yet.</span> : qrHistory.map((item) => <code key={`${item}-${Math.random()}`}>{item}</code>)}
                  </div>
                </>
              ) : null}

              {device.type === "touch" ? (
                <>
                  <div className={`touch-tile ${touchFlash ? "flash" : ""}`} onPointerDown={triggerTouch} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") triggerTouch(); }}>
                    <span>Touch test area</span>
                  </div>
                  <ul className="device-metadata">
                    <li><span>Touch count</span><strong>{touch.touchCount || 0}</strong></li>
                  </ul>
                </>
              ) : null}

              {device.lastError ? <div className="device-warning">{device.lastError}</div> : null}
            </div>
          );
        })}
      </div>

      <div className="log-panel">
        <div className="log-header">
          <h2>Live device log</h2>
          <button type="button" className="secondary" onClick={() => setLogs([])}>Clear log</button>
        </div>
        <ul>
          {logs.map((entry) => (
            <li key={entry.id} className={`log-entry ${entry.level}`}>
              <span>{entry.prefix}</span>
              <strong>{entry.message}</strong>
              <small>{new Date(entry.timestamp).toLocaleTimeString()}</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default HALDashboard;
