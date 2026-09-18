import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import BitcoinAtmLogo from "../components/BitcoinAtmLogo";
import { useTransaction } from "../context/TransactionContext";

function Welcome() {
  const navigate = useNavigate();
  const { resetTransaction } = useTransaction();
  const idleTimerRef = useRef(null);

  useEffect(() => {
    const IDLE_TIMEOUT_MS = 60_000;

    const startIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = setTimeout(() => {
        navigate("/", { replace: true });
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ["pointerdown", "pointermove", "keydown", "touchstart"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, startIdleTimer));
    startIdleTimer();

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, startIdleTimer));
    };
  }, [navigate]);

  const handleStart = () => {
    resetTransaction();
    navigate("/transaction");
  };

  return (
    <div className="welcome-kiosk-screen">
      <div className="welcome-kiosk-frame">
        <header className="welcome-kiosk-topbar">
          <div className="topbar-btc">₿</div>
          <div className="topbar-price">
            <span>BTC:</span>
            <strong>KSh 10,456,732</strong>
          </div>
          <button type="button" className="topbar-language">
            English <span aria-hidden="true">🌐</span>
          </button>
        </header>

        <main className="welcome-kiosk-main">
          <div className="welcome-logo-ring">
            <div className="welcome-logo-disc">
              <BitcoinAtmLogo compact />
            </div>
          </div>

          <h1><i className="fas fa-coins">BANKLESS BITCOIN ATM</i></h1>
          <p>Tap to begin your secure transaction.</p>

          <button type="button" className="welcome-start-button" onClick={handleStart}>
            START
          </button>
        </main>

        <footer className="welcome-kiosk-footer">
          <button type="button">Español</button>
          <button type="button">Support</button>
        </footer>
      </div>
    </div>
  );
}

export default Welcome;
