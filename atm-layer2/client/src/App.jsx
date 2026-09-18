import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import HALDashboard from "./components/HALDashboard";
import HardwareEventStream from "./components/HardwareEventStream";
import TransactionStatusPanel from "./components/TransactionStatusPanel";
import { TransactionProvider } from "./context/TransactionContext";
import AdminDashboard from "./pages/AdminDashboard";
import Amount from "./pages/Amount";
import Bitcoin from "./pages/Bitcoin";
import Confirmation from "./pages/Confirmation";
import Maintenance from "./pages/Maintenance";
import OperatorLogin from "./pages/OperatorLogin";
import Processing from "./pages/Processing";
import Receipt from "./pages/Receipt";
import Sell from "./pages/Sell";
import Sleep from "./pages/Sleep";
import Transaction from "./pages/Transaction";
import Welcome from "./pages/Welcome";

function AppLayout() {
  const location = useLocation();
  const isKioskRoute = new Set([
    "/",
    "/welcome",
    "/transaction",
    "/bitcoin",
    "/sell",
    "/amount",
    "/confirmation",
    "/processing",
    "/receipt",
  ]).has(location.pathname);

  return (
    <div className={`app-shell${isKioskRoute ? " kiosk-mode" : ""}`}>
      <div className="app-routes">
        <Routes>
          <Route path="/" element={<Sleep />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/transaction" element={<Transaction />} />
          <Route path="/bitcoin" element={<Bitcoin />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/amount" element={<Amount />} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/processing" element={<Processing />} />
          <Route path="/receipt" element={<Receipt />} />
          <Route path="/admin-login" element={<OperatorLogin targetRoute="/admin" />} />
          <Route path="/maintenance-login" element={<OperatorLogin targetRoute="/maintenance" />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/hal" element={<HALDashboard />} />
          <Route path="/maintenance" element={<Maintenance />} />
        </Routes>
      </div>
      {!isKioskRoute ? (
        <div className="side-panels">
          <TransactionStatusPanel />
          <HardwareEventStream />
        </div>
      ) : null}
    </div>
  );
}

function App() {
  return (
    <TransactionProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </TransactionProvider>
  );
}

export default App;
