import { useNavigate } from "react-router-dom";

import { useTransaction } from "../context/TransactionContext";

function Amount() {
  const navigate = useNavigate();
  const { transaction, updateTransaction, addTransactionLog } = useTransaction();

  const amount = Number(transaction.amount || 0);
  const btcRate = 64200;
  const networkFee = 250;
  const transactionFeeRate = 0.01;
  const feeAmount = amount * transactionFeeRate + networkFee;
  const btcEstimate = amount > feeAmount ? (amount - feeAmount) / btcRate : 0;
  const minimumCash = 500;

  const continueFlow = () => {
    if (amount < minimumCash) {
      return;
    }

    addTransactionLog({
      type: "AMOUNT",
      message: "Cash amount entered by customer.",
      details: `KES ${amount.toFixed(2)}`,
    });
    updateTransaction({ status: "AWAITING_CONFIRMATION" });
    navigate("/confirmation");
  };

  return (
    <div className="kiosk-screen">
      <div className="kiosk-frame cash-screen">
        <header className="kiosk-header destination-header">
          <span className="kiosk-title">BITVAULT</span>
          <button type="button" className="kiosk-language">English</button>
        </header>

        <main className="kiosk-main cash-main">
          <div className="progress-track" aria-hidden="true">
            <span className="active" />
            <span className="active current" />
            <span />
          </div>

          <h1>Insert Cash</h1>
          <p>Please insert bills into the slot below. Accepted denominations: KES 500, KES 1,000.</p>

          <section className="cash-slot-card">
            <span className="cash-slot-icon">💵</span>
            <strong>Waiting for cash...</strong>
            <div className="cash-slot-progress" aria-hidden="true" />
          </section>

          <section className="cash-summary">
            <label htmlFor="cash-amount">Cash Inserted</label>
            <input
              id="cash-amount"
              type="number"
              value={transaction.amount}
              onChange={(event) => updateTransaction({ amount: event.target.value, status: "AWAITING_CASH" })}
              placeholder="0.00"
              min="0"
              className="cash-input"
            />

            <div className="cash-row">
              <span>Current Rate</span>
              <strong>1 BTC = KES {btcRate.toLocaleString()}</strong>
            </div>
            <div className="cash-row">
              <span>Transaction Fee</span>
              <strong>{(transactionFeeRate * 100).toFixed(1)}%</strong>
            </div>
            <div className="cash-row">
              <span>Network Fee</span>
              <strong>KES {networkFee.toFixed(2)}</strong>
            </div>
            <div className="cash-btc">
              <span>BTC to receive</span>
              <strong>{btcEstimate.toFixed(8)}</strong>
            </div>
          </section>

          <button type="button" className="kiosk-primary-button" onClick={continueFlow} disabled={amount < minimumCash}>
            Finish &amp; Send
          </button>
          <small className="cash-note">Insert at least KES {minimumCash.toLocaleString()} to continue</small>
        </main>

        <footer className="kiosk-footer">
          <button type="button" onClick={() => navigate("/bitcoin")}>Support</button>
          <button type="button" className="danger" onClick={() => navigate("/transaction")}>Emergency Cancel</button>
        </footer>
      </div>
    </div>
  );
}

export default Amount;
