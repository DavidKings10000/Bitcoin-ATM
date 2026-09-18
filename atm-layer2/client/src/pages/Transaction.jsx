import { useNavigate } from "react-router-dom";

import { useTransaction } from "../context/TransactionContext";

function Transaction() {
  const navigate = useNavigate();
  const { transaction, updateTransaction, addTransactionLog } = useTransaction();

  const selectTransaction = (type) => {
    const isBuy = type === "BUY";
    updateTransaction({
      type,
      status: isBuy ? "AWAITING_WALLET" : "WAITING_NETWORK_CONFIRMATION",
      amount: isBuy ? "" : "100",
    });
    addTransactionLog({
      type: "TRANSACTION",
      message: `${type} transaction started.`,
      details: isBuy
        ? "Awaiting wallet address and customer verification."
        : "Awaiting on-chain transfer before dispensing cash.",
    });
    navigate(isBuy ? "/bitcoin" : "/sell");
  };

  return (
    <div className="kiosk-screen">
      <div className="kiosk-frame">
        <header className="kiosk-header">
          <span className="kiosk-brand">₿</span>
          <button type="button" className="kiosk-language">English</button>
        </header>

        <main className="kiosk-main transaction-main">
          <button type="button" className="transaction-card buy" onClick={() => selectTransaction("BUY")}>
            <span className="transaction-icon">↓</span>
            <strong>BUY BITCOIN</strong>
            <p>Instantly purchase BTC with cash</p>
          </button>

          <button type="button" className="transaction-card sell" onClick={() => selectTransaction("SELL")}>
            <span className="transaction-icon secondary">↑</span>
            <strong>SELL BITCOIN</strong>
            <p>Withdraw cash from your BTC wallet</p>
          </button>

          <section className="transaction-code-section" aria-labelledby="promo-code-heading">
            <div>
              <strong id="promo-code-heading">PROMO CODE</strong>
              <span>Apply a promotional offer to your transaction.</span>
            </div>
            <input
              className="kiosk-input"
              type="text"
              value={transaction.promoCode}
              onChange={(event) => updateTransaction({ promoCode: event.target.value.toUpperCase() })}
              placeholder="ENTER PROMO CODE"
              aria-label="Promo code"
              autoComplete="off"
            />
          </section>

          <section className="transaction-code-section" aria-labelledby="voucher-heading">
            <div>
              <strong id="voucher-heading">REDEEM VOUCHER</strong>
              <span>Use a voucher code for your cash purchase.</span>
            </div>
            <input
              className="kiosk-input"
              type="text"
              value={transaction.voucherCode}
              onChange={(event) => updateTransaction({ voucherCode: event.target.value.toUpperCase() })}
              placeholder="ENTER VOUCHER CODE"
              aria-label="Redeem voucher code"
              autoComplete="off"
            />
          </section>
        </main>

        <footer className="kiosk-footer">
          <button type="button" onClick={() => navigate("/welcome")}>Emergency Cancel</button>
          <button type="button">Support</button>
        </footer>
      </div>
    </div>
  );
}

export default Transaction;
