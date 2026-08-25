import { useState } from "react";
import { useNavigate } from "react-router-dom";

const OPERATOR_CREDENTIALS = {
  username: "operator",
  password: "btcadmin2026",
};

function OperatorLogin({ targetRoute }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (username === OPERATOR_CREDENTIALS.username && password === OPERATOR_CREDENTIALS.password) {
      setError("");
      navigate(targetRoute);
      return;
    }

    setError("Invalid operator credentials. Access denied.");
  };

  return (
    <div className="atm-screen">
      <div className="operator-login-panel">
        <p className="eyebrow">Restricted access</p>
        <h1>Operator login</h1>

        <form onSubmit={handleSubmit} className="operator-form">
          <label>
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error ? <p className="wallet-error">{error}</p> : null}

          <div className="admin-actions operator-actions">
            <button type="submit">LOGIN</button>
            <button type="button" className="secondary-button" onClick={() => navigate("/")}>
              BACK TO ATM
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OperatorLogin;
