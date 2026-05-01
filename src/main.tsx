import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// vite-plugin-pwa registers the SW itself (injectRegister: 'auto'); this just
// observes the result so we can see which script URL got activated
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready
    .then((reg) =>
      console.log("[sw] active script:", reg.active?.scriptURL, "scope:", reg.scope),
    )
    .catch((err) => console.error("[sw] ready failed:", err));
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("#root not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
