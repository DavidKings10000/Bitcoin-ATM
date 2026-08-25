import { useNavigate } from "react-router-dom";

import BitcoinAtmLogo from "../components/BitcoinAtmLogo";

function Sleep() {
  const navigate = useNavigate();

  return (
    <div
      className="sleep-screen"
      role="button"
      tabIndex={0}
      onClick={() => navigate("/welcome")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          navigate("/welcome");
        }
      }}
    >
      <div className="sleep-touch-area">
        <BitcoinAtmLogo />
      </div>
    </div>
  );
}

export default Sleep;
