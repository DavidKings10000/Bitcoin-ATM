import { createContext, useContext, useMemo, useState } from "react";

const TransactionContext = createContext(null);

const DEFAULT_TRANSACTION = {
  type: "BUY",
  walletAddress: "",
  amount: "",
  status: "IDLE",
  cashInserted: 0,
  hardwareStatus: "IDLE",
  cloudStatus: "READY",
  quote: null,
  lastError: null,
};

const DEFAULT_LOGS = [
  {
    id: "system-start",
    type: "SYSTEM",
    timestamp: new Date().toISOString(),
    message: "Kiosk online and ready for customer transactions.",
  },
];

export function TransactionProvider({ children }) {
  const [transaction, setTransaction] = useState(DEFAULT_TRANSACTION);
  const [transactionLog, setTransactionLog] = useState(DEFAULT_LOGS);

  const addTransactionLog = (entry) => {
    const logEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      type: entry?.type || "SYSTEM",
      message: entry?.message || "Status update",
      details: entry?.details || "",
    };

    setTransactionLog((current) => [logEntry, ...current].slice(0, 12));
  };

  const value = useMemo(
    () => ({
      transaction,
      transactionLog,
      addTransactionLog,
      updateTransaction: (updates) => {
        setTransaction((current) => ({ ...current, ...updates }));
      },
      setHardwareStatus: (status) => {
        setTransaction((current) => ({ ...current, hardwareStatus: status }));
      },
      setCloudStatus: (status) => {
        setTransaction((current) => ({ ...current, cloudStatus: status }));
      },
      setLastError: (error) => {
        setTransaction((current) => ({ ...current, lastError: error }));
      },
      resetTransaction: () => setTransaction(DEFAULT_TRANSACTION),
    }),
    [transaction, transactionLog]
  );

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  const context = useContext(TransactionContext);

  if (!context) {
    throw new Error("useTransaction must be used inside a TransactionProvider");
  }

  return context;
}
