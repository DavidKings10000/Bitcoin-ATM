import { useNavigate } from "react-router-dom";

import { useTransaction } from "../context/TransactionContext";

function Confirmation() {
  const navigate = useNavigate();
  const { transaction, updateTransaction } = useTransaction();
  const btcAmount = Number(transaction.amount || 0) / 60000;

  const handleConfirm = () => {
    updateTransaction({ status: "PROCESSING_PAYMENT" });
    navigate("/processing");
  };

  return (
    <div className="kiosk-screen">
      <div className="kiosk-frame confirm-screen">
        <header className="kiosk-header destination-header">
          <span className="kiosk-title">BITVAULT</span>
          <button type="button" className="kiosk-language">English</button>
        </header>

        <main className="kiosk-main confirm-main">
          <h1>Confirm Transaction</h1>

          <div className="summary-box dark">
            <p><strong>Type:</strong> {transaction.type}</p>
            <p><strong>Wallet:</strong> {transaction.walletAddress}</p>
            <p><strong>Amount:</strong> ${Number(transaction.amount || 0).toFixed(2)}</p>
            <p><strong>Estimated BTC:</strong> {btcAmount.toFixed(8)} BTC</p>
          </div>

          <button type="button" className="kiosk-primary-button" onClick={handleConfirm}>Confirm</button>
          <button type="button" className="kiosk-secondary-button" onClick={() => navigate("/amount")}>Back</button>
        </main>

        <footer className="kiosk-footer">
          <button type="button">Support</button>
          <button type="button" className="danger" onClick={() => navigate("/transaction")}>Cancel</button>
        </footer>
      </div>
    </div>
  );
}

export default Confirmation;
