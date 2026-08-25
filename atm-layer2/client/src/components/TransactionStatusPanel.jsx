import { useTransaction } from "../context/TransactionContext";

function TransactionStatusPanel() {
  const { transaction } = useTransaction();

  const isFailure = [
    "CANCELLED",
    "TIMEOUT",
    "HARDWARE_ERROR",
    "NETWORK_ERROR",
    "PAYMENT_ERROR",
  ].includes(transaction.status);

  return (
    <aside className="status-panel">
      <h2>Transaction Status</h2>

      <div className={`status-pill ${isFailure ? "status-failure" : "status-ok"}`}>
        {transaction.status}
      </div>

      <dl className="status-list">
        <div>
          <dt>Type</dt>
          <dd>{transaction.type}</dd>
        </div>
        <div>
          <dt>Wallet</dt>
          <dd>{transaction.walletAddress || "Not set"}</dd>
        </div>
        <div>
          <dt>Cash</dt>
          <dd>${Number(transaction.cashInserted || transaction.amount || 0).toFixed(2)}</dd>
        </div>
        <div>
          <dt>Hardware</dt>
          <dd>{transaction.hardwareStatus}</dd>
        </div>
        <div>
          <dt>Cloud</dt>
          <dd>{transaction.cloudStatus}</dd>
        </div>
      </dl>

      {transaction.quote ? (
        <div className="status-quote">
          <strong>BTC Quote</strong>
          <span>{Number(transaction.quote.btcAmount || 0).toFixed(8)} BTC</span>
          <small>@ ${Number(transaction.quote.price || 0).toFixed(2)}/BTC</small>
        </div>
      ) : null}

      {transaction.lastError ? (
        <div className="status-error">
          <strong>Error</strong>
          <span>{transaction.lastError.code}</span>
          <small>{transaction.lastError.message}</small>
        </div>
      ) : null}
    </aside>
  );
}

export default TransactionStatusPanel;
