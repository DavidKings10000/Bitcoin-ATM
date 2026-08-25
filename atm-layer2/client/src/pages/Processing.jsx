import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useTransaction } from "../context/TransactionContext";

function Processing() {
  const navigate = useNavigate();
  const { updateTransaction } = useTransaction();

  useEffect(() => {
    updateTransaction({ status: "PROCESSING_PAYMENT" });

    const timer = setTimeout(() => {
      updateTransaction({ status: "COMPLETED" });
      navigate("/receipt");
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate, updateTransaction]);

  return (
    <div className="kiosk-screen">
      <div className="kiosk-frame processing-screen">
        <header className="kiosk-header destination-header">
          <span className="kiosk-title">BITVAULT</span>
          <button type="button" className="kiosk-language">English</button>
        </header>
        <main className="kiosk-main processing-main">
          <div className="processing-spinner" aria-hidden="true" />
          <h1>Processing</h1>
          <p>Please wait while your transaction is confirmed and settled.</p>
        </main>
      </div>
    </div>
  );
}

export default Processing;
