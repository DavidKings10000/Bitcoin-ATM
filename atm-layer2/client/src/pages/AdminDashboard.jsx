import { useNavigate } from "react-router-dom";

import { useTransaction } from "../context/TransactionContext";

function AdminDashboard() {
  const navigate = useNavigate();
  const { transaction, transactionLog, addTransactionLog, resetTransaction } = useTransaction();

  const openMaintenance = () => {
    addTransactionLog({
      type: "ADMIN",
      message: "Operator opened maintenance mode.",
    });
    navigate("/maintenance");
  };

  const handleReset = () => {
    resetTransaction();
    addTransactionLog({
      type: "ADMIN",
      message: "Current transaction state was reset by the operator.",
    });
    navigate("/");
  };

  const openHAL = () => {
    addTransactionLog({
      type: "ADMIN",
      message: "Operator opened the ATM HAL dashboard.",
    });
    navigate("/hal");
  };

  const hardwareState = transaction.hardwareStatus === "CONNECTED" ? "Operational" : transaction.hardwareStatus;

  return (
    <div className="atm-screen">
      <div className="admin-dashboard">
        <div className="admin-header">
          <div>
            <p className="eyebrow">Operations</p>
            <h1>Kiosk Dashboard</h1>
          </div>
          <button type="button" className="secondary-button" onClick={() => navigate("/")}>
            RETURN TO ATM
          </button>
        </div>

        <div className="admin-summary">
          <div className="metric-card">
            <span>Current status</span>
            <strong>{transaction.status}</strong>
          </div>
          <div className="metric-card">
            <span>Hardware</span>
            <strong>{hardwareState}</strong>
          </div>
          <div className="metric-card">
            <span>Last log</span>
            <strong>{transactionLog[0]?.type || "SYSTEM"}</strong>
          </div>
          <div className="metric-card">
            <span>Wallet</span>
            <strong>{transaction.walletAddress ? "Set" : "Awaiting input"}</strong>
          </div>
        </div>

        <div className="admin-grid">
          <section className="admin-panel">
            <h2>Current transaction</h2>
            <dl className="status-list admin-list">
              <div>
                <dt>Type</dt>
                <dd>{transaction.type}</dd>
              </div>
              <div>
                <dt>Wallet</dt>
                <dd>{transaction.walletAddress || "Not set"}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>${Number(transaction.cashInserted || transaction.amount || 0).toFixed(2)}</dd>
              </div>
              <div>
                <dt>Cloud</dt>
                <dd>{transaction.cloudStatus}</dd>
              </div>
              <div>
                <dt>Error</dt>
                <dd>{transaction.lastError?.code || "None"}</dd>
              </div>
            </dl>
          </section>

          <section className="admin-panel">
            <h2>Service health</h2>
            <ul className="admin-health-list">
              <li>
                <span>Hardware</span>
                <strong>{transaction.hardwareStatus}</strong>
              </li>
              <li>
                <span>Cloud bridge</span>
                <strong>{transaction.cloudStatus}</strong>
              </li>
              <li>
                <span>Availability</span>
                <strong>{transaction.lastError ? "Degraded" : "Online"}</strong>
              </li>
            </ul>
          </section>
        </div>

        <section className="admin-panel admin-log-panel">
          <h2>Transaction log history</h2>
          <ul className="transaction-log">
            {transactionLog.map((entry) => (
              <li key={entry.id}>
                <div className="log-header">
                  <strong>{entry.type}</strong>
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                <p>{entry.message}</p>
                {entry.details ? <small>{entry.details}</small> : null}
              </li>
            ))}
          </ul>
        </section>

        <div className="admin-actions">
          <button type="button" onClick={openMaintenance}>MAINTENANCE</button>
          <button type="button" onClick={openHAL}>HAL DASHBOARD</button>
          <button type="button" className="secondary-button" onClick={handleReset}>RESET SESSION</button>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
