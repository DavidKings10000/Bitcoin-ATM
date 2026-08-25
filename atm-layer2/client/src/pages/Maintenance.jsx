import { useNavigate } from "react-router-dom";

import { useTransaction } from "../context/TransactionContext";

function Maintenance() {
  const navigate = useNavigate();
  const { transaction, addTransactionLog } = useTransaction();

  const handleResume = () => {
    addTransactionLog({
      type: "ADMIN",
      message: "Operator resumed kiosk service from maintenance mode.",
    });
    navigate("/");
  };

  const issueTitle = transaction.lastError ? transaction.lastError.code : "Service status";
  const issueMessage = transaction.lastError
    ? transaction.lastError.message
    : "All customer-facing services are available and ready for the next transaction.";

  return (
    <div className="atm-screen">
      <div className="maintenance-panel">
        <p className="eyebrow">Operator view</p>
        <h1>Maintenance / Unavailable</h1>

        <div className="maintenance-state">
          <span className="status-pill status-failure">SERVICE ALERT</span>
          <h2>{issueTitle}</h2>
          <p>{issueMessage}</p>
        </div>

        <div className="maintenance-grid">
          <div className="maintenance-card">
            <strong>Hardware</strong>
            <span>{transaction.hardwareStatus}</span>
          </div>
          <div className="maintenance-card">
            <strong>Cloud</strong>
            <span>{transaction.cloudStatus}</span>
          </div>
          <div className="maintenance-card">
            <strong>Session</strong>
            <span>{transaction.status}</span>
          </div>
        </div>

        <ul className="maintenance-actions">
          <li>Inspect the hardware bay and confirm the NV200 is responsive.</li>
          <li>Verify the Layer 2 controller and BTC pricing bridge are healthy.</li>
          <li>Clear stale customer sessions before re-enabling the kiosk.</li>
        </ul>

        <div className="admin-actions">
          <button type="button" onClick={handleResume}>RESUME KIOSK</button>
          <button type="button" className="secondary-button" onClick={() => navigate("/admin")}>ADMIN CONSOLE</button>
        </div>
      </div>
    </div>
  );
}

export default Maintenance;
