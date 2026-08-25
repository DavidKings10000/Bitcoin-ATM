function BitcoinAtmLogo({ compact = false }) {
  return (
    <img
      src="/bitcoin-atm-logo.png"
      alt="Bitcoin ATM logo"
      className={`btc-atm-logo${compact ? " compact" : ""}`}
    />
  );
}

export default BitcoinAtmLogo;
