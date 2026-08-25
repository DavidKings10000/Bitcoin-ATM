import { useEffect, useState } from "react";
import { io } from "socket.io-client";

import { useTransaction } from "../context/TransactionContext";

const EVENT_LIMIT = 6;

function HardwareEventStream() {
  const { updateTransaction, setHardwareStatus } = useTransaction();
  const [events, setEvents] = useState([
    {
      type: "DEVICE_CONNECTED",
      timestamp: new Date().toISOString(),
      data: { device: "NV200", status: "connected" },
    },
  ]);

  useEffect(() => {
    const socket = io("http://localhost:3000", {
      transports: ["websocket"],
    });

    socket.on("hardware:stream", (history = []) => {
      if (Array.isArray(history) && history.length > 0) {
        setEvents(history.slice(0, EVENT_LIMIT));
      }
    });

    socket.on("hardware:event", (event) => {
      setEvents((current) => [event, ...current].slice(0, EVENT_LIMIT));

      if (event.type === "DEVICE_CONNECTED") {
        setHardwareStatus("CONNECTED");
        updateTransaction({
          hardwareStatus: "CONNECTED",
          status: "AWAITING_WALLET",
        });
      }

      if (event.type === "NOTE_DETECTED") {
        setHardwareStatus("NOTE_DETECTED");
        updateTransaction({
          hardwareStatus: "NOTE_DETECTED",
          status: "NOTE_DETECTED",
        });
      }

      if (event.type === "NOTE_ACCEPTED") {
        const noteValue = Number(event.data?.value || 0);
        updateTransaction({
          amount: String(noteValue),
          cashInserted: noteValue,
          status: "CASH_SECURED",
          hardwareStatus: "NOTE_ACCEPTED",
        });
      }

      if (event.type === "NOTE_STACKED") {
        setHardwareStatus("NOTE_STACKED");
        updateTransaction({
          hardwareStatus: "NOTE_STACKED",
          status: "STACKING",
        });
      }
    });

    socket.on("hardware:status", (status) => {
      setHardwareStatus(status.status || "READY");
      setEvents((current) => [
        {
          type: "DEVICE_CONNECTED",
          timestamp: new Date().toISOString(),
          data: status,
        },
        ...current,
      ].slice(0, EVENT_LIMIT));
    });

    return () => {
      socket.disconnect();
    };
  }, [setHardwareStatus, updateTransaction]);

  return (
    <div className="hardware-panel">
      <h2>Hardware Event Stream</h2>
      <ul>
        {events.map((event, index) => (
          <li key={`${event.type}-${index}`}>
            <strong>{event.type}</strong>
            <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
            <small>
              {event.data && Object.keys(event.data).length > 0
                ? JSON.stringify(event.data)
                : "no payload"}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default HardwareEventStream;
