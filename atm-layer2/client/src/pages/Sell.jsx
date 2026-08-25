import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useTransaction } from "../context/TransactionContext";

function Sell() {
  const navigate = useNavigate();
  const { transaction, updateTransaction, addTransactionLog } = useTransaction();
  const usdAmount = Number(transaction.amount || 100);
  const btcRequired = useMemo(() => usdAmount / 64500, [usdAmount]);
  const sellAddress = "bc1qkioskpayout3x7n2h4y9f6u8v0d2z7e";

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(sellAddress);
      addTransactionLog({
        type: "SELL",
        message: "Sell wallet address copied.",
        details: sellAddress,
      });
    } catch (error) {
      addTransactionLog({
        type: "SELL",
        message: "Clipboard unavailable; customer must copy address manually.",
      });
    }
  };

  const handleCancel = () => {
    updateTransaction({ status: "CANCELLED" });
    navigate("/transaction");
  };

  const printSellReceipt = () => {
    updateTransaction({ status: "AWAITING_DEPOSIT_CONFIRMATION", walletAddress: sellAddress });
    addTransactionLog({
      type: "SELL",
      message: "Deposit QR prepared on receipt for sell transaction.",
      details: sellAddress,
    });
    navigate("/receipt");
  };

  return (
    <div className="kiosk-screen">
      <div className="kiosk-frame sell-screen">
        <header className="kiosk-header destination-header">
          <span className="kiosk-title">SOVEREIGN KIOSK</span>
          <button type="button" className="kiosk-language">English</button>
        </header>

        <main className="kiosk-main sell-main">
          <div className="progress-track" aria-hidden="true">
            <span className="active" />
            <span className="active current" />
            <span />
          </div>

          <section className="sell-intro">
            <h1>Send Bitcoin</h1>
            <p>Send exactly the BTC amount shown to receive your cash payout.</p>
          </section>

          <div className="sell-status">
            <strong>Status</strong>
            <span>Waiting for network confirmation...</span>
          </div>

          <section className="sell-quote-card">
            <p className="quote-label">Cash to dispense</p>
            <strong className="quote-usd">KSH {usdAmount.toFixed(2)}</strong>
            <p className="quote-label">Exact amount required</p>
            <strong className="quote-btc">{btcRequired.toFixed(5)} BTC</strong>
            <button type="button" className="kiosk-secondary-button" onClick={handleCopyAddress}>
              Copy deposit address
            </button>
            <button type="button" className="kiosk-primary-button" onClick={printSellReceipt}>
              Print QR on receipt
            </button>
          </section>
        </main>

        <footer className="kiosk-footer">
          <button type="button" className="danger" onClick={handleCancel}>Cancel Transaction</button>
          <button type="button">Customer Support</button>
        </footer>
      </div>
    </div>
  );
}

export default Sell;
