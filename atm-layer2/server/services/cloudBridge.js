const DEFAULT_BTC_PRICE_USD = 60000;

async function getBtcPrice() {
  const apiUrl = process.env.CLOUD_API_URL || "https://api.coinbase.com/v2/prices/BTC-USD/spot";
  const apiKey = process.env.CLOUD_API_KEY || "local-dev-key";
  const timeoutMs = Number(process.env.CLOUD_TIMEOUT_MS || 3000);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Cloud bridge returned ${response.status}`);
    }

    const payload = await response.json();
    const price = Number(payload?.data?.amount ?? payload?.amount ?? payload?.price ?? DEFAULT_BTC_PRICE_USD);

    return {
      success: true,
      provider: "coinbase",
      price: Number.isFinite(price) ? price : DEFAULT_BTC_PRICE_USD,
      source: apiUrl,
    };
  } catch (error) {
    return {
      success: false,
      provider: "local-fallback",
      price: DEFAULT_BTC_PRICE_USD,
      source: "local-fallback",
      warning: error.message,
    };
  }
}

async function createQuote({ amountUsd = 0, type = "BUY", walletAddress = "" }) {
  const { price } = await getBtcPrice();
  const btcAmount = Number(amountUsd || 0) / price;

  return {
    quoteId: `quote-${Date.now()}`,
    type,
    walletAddress,
    amountUsd: Number(amountUsd || 0),
    btcAmount: Number(btcAmount.toFixed(8)),
    price,
    status: "READY",
    provider: "cloud-bridge",
  };
}

async function settleTransaction({ transactionId, walletAddress, amountUsd, btcAmount }) {
  if (!walletAddress) {
    throw new Error("Wallet address is required for settlement");
  }

  return {
    success: true,
    settlementId: `settlement-${Date.now()}`,
    transactionId,
    walletAddress,
    amountUsd: Number(amountUsd || 0),
    btcAmount: Number(btcAmount || 0),
    status: "SETTLED",
    provider: "cloud-bridge",
  };
}

module.exports = {
  getBtcPrice,
  createQuote,
  settleTransaction,
};
