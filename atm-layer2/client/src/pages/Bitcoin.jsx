import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { useNavigate } from "react-router-dom";

import { useTransaction } from "../context/TransactionContext";

const BTC_ADDRESS_PATTERNS = [
  /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/,
  /^3[1-9A-HJ-NP-Za-km-z]{25,34}$/,
  /^bc1[0-9A-Za-z]{11,71}$/,
];

const isValidBitcoinAddress = (value) => {
  const trimmed = value.trim();
  return Boolean(trimmed) && BTC_ADDRESS_PATTERNS.some((pattern) => pattern.test(trimmed));
};

function Bitcoin() {
  const navigate = useNavigate();
  const { transaction, updateTransaction, addTransactionLog } = useTransaction();
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [walletError, setWalletError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

  const stopCamera = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const handleWalletAddressChange = (event) => {
    const nextValue = event.target.value;
    if (nextValue.trim() && !isValidBitcoinAddress(nextValue)) {
      setWalletError("Enter a valid BTC wallet address.");
    } else {
      setWalletError("");
    }
    updateTransaction({ walletAddress: nextValue, status: "AWAITING_CASH" });
  };

  const handleScanResult = (walletAddress) => {
    const cleanAddress = walletAddress.trim();
    if (!cleanAddress || !isValidBitcoinAddress(cleanAddress)) {
      setWalletError("The scanned QR code did not contain a valid Bitcoin wallet address.");
      return;
    }
    updateTransaction({ walletAddress: cleanAddress, status: "AWAITING_CASH" });
    addTransactionLog({
      type: "WALLET",
      message: "Wallet address captured from QR scan.",
      details: cleanAddress,
    });
    stopCamera();
    setScanError("QR code scanned successfully.");
    setWalletError("");
  };

  useEffect(() => {
    if (!isScanning) {
      return undefined;
    }

    const scanFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        return;
      }

      if (video.readyState >= 2) {
        const context = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          handleScanResult(code.data);
          return;
        }
      }

      animationRef.current = requestAnimationFrame(scanFrame);
    };

    animationRef.current = requestAnimationFrame(scanFrame);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isScanning]);

  useEffect(() => () => stopCamera(), []);

  const startScanner = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanError("Camera scan not available. Enter wallet manually.");
      return;
    }
    try {
      setIsScanning(true);
      setScanError("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      setIsScanning(false);
      setScanError("Unable to access camera. Enter wallet manually.");
    }
  };

  const continueToAmount = () => {
    if (!transaction.walletAddress.trim() || !isValidBitcoinAddress(transaction.walletAddress)) {
      setWalletError("Enter a valid BTC wallet address before continuing.");
      return;
    }

    addTransactionLog({
      type: "WALLET",
      message: "Wallet address accepted for the transaction.",
      details: transaction.walletAddress,
    });
    navigate("/amount");
  };

  return (
    <div className="kiosk-screen">
      <div className="kiosk-frame destination-screen">
        <header className="kiosk-header destination-header">
          <span className="kiosk-title">SOVEREIGN KIOSK</span>
          <button type="button" className="kiosk-language">English</button>
        </header>

        <main className="kiosk-main destination-main">
          <div className="progress-track" aria-hidden="true">
            <span className="active" />
            <span className="active current" />
            <span />
            <span />
          </div>

          <h1>Select Destination</h1>
          <p>Scan your wallet QR code or enter your address manually.</p>

          <button type="button" className="scanner-tile" onClick={isScanning ? stopCamera : startScanner}>
            <div className="scanner-frame alt">
              {isScanning ? (
                <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />
              ) : (
                <span className="scanner-placeholder">⌖</span>
              )}
              <div className="scanner-overlay alt" aria-hidden="true" />
            </div>
            <strong>{isScanning ? "Tap to stop scanner" : "Hold QR Code to Scanner"}</strong>
          </button>

          <canvas ref={canvasRef} className="scanner-canvas" />

          <input
            type="text"
            value={transaction.walletAddress}
            onChange={handleWalletAddressChange}
            placeholder="bc1q... wallet address"
            aria-invalid={Boolean(walletError)}
            className="kiosk-input"
          />
          {scanError ? <p className="kiosk-message ok">{scanError}</p> : null}
          {walletError ? <p className="kiosk-message error">{walletError}</p> : null}

          <button type="button" className="kiosk-primary-button" onClick={continueToAmount}>
            Continue
          </button>
        </main>

        <footer className="kiosk-footer">
          <button type="button" onClick={() => navigate("/transaction")}>Cancel Transaction</button>
          <button type="button">Customer Support</button>
        </footer>
      </div>
    </div>
  );
}

export default Bitcoin;
