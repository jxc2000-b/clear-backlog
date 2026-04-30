import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { //this registers a serviceWorker after load
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
  // service worker has access to full site "/", empty catch prevents errors from breaking the app 
  // necessary for PWA recognition 
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
