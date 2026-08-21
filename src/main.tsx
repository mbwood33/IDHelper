import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("./sw.js");
} else if ("serviceWorker" in navigator) {
  // A worker registered by an earlier production preview can otherwise keep
  // serving an old application shell while `npm run dev` is active.
  void navigator.serviceWorker.getRegistration().then((registration) => registration?.unregister());
}
