import { useNavigate } from "react-router-dom";

import { useTransaction } from "../context/TransactionContext";

function Receipt() {
  const navigate = useNavigate();
  const { transaction, resetTransaction, addTransactionLog } = useTransaction();
  const amount = Number(transaction.amount || 0);
  const btcAmount = amount / 60000;
  const isSell = transaction.type === "SELL";
  const timestamp = new Date().toISOString();

  const finish = () => {
    resetTransaction();
    navigate("/");
  };

  const handleReceiptAction = (channel) => {
    addTransactionLog({
      type: "RECEIPT",
      message: `Customer requested ${channel} receipt.`,
      details: `TX-${timestamp}`,
    });
  };

  return (
    <div className="kiosk-screen">
      <div className="kiosk-frame receipt-screen">
        <header className="kiosk-header destination-header">
          <span className="kiosk-title">BITVAULT</span>
          <button type="button" className="kiosk-language">English</button>
        </header>

        <main className="kiosk-main receipt-main">
          <section className="receipt-card">
            <div className="receipt-success-icon" aria-hidden="true">✓</div>
            <p className="receipt-caption">
              {isSell ? "Sell deposit instructions" : "Transaction successful"}
            </p>
            <p className="receipt-amount">
              {isSell ? `Dispense amount: KSH ${amount.toFixed(2)}` : `Sent ${btcAmount.toFixed(3)} BTC to your wallet`}
            </p>

            {isSell ? (
              <div className="receipt-qr-block">
                <p>Scan this QR and send exactly {btcAmount.toFixed(5)} BTC.</p>
                <div className="sell-qr-placeholder" aria-hidden="true">
                  <div className="qr-grid" />
                </div>
                <small>{transaction.walletAddress || "bc1qkioskpayout3x7n2h4y9f6u8v0d2z7e"}</small>
              </div>
            ) : null}

            <div className="receipt-details">
              <div><span>Date</span><strong>{timestamp.slice(0, 10)}</strong></div>
              <div><span>Time</span><strong>{timestamp.slice(11, 19)} UTC</strong></div>
              <div><span>Network Fee</span><strong>0.000043 BTC</strong></div>
              <div><span>Transaction ID</span><strong>{`TX-${Date.now()}`}</strong></div>
            </div>

            <button type="button" className="kiosk-secondary-button" onClick={() => handleReceiptAction("print")}>
              Print Receipt
            </button>
            <button type="button" className="kiosk-secondary-button" onClick={() => handleReceiptAction("sms")}>
              Send SMS Receipt
            </button>
            <button type="button" className="kiosk-primary-button" onClick={finish}>
              Done
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Receipt;
