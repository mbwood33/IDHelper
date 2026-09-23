import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

/**
 * Mount the single React application under StrictMode so unsafe render-time
 * side effects are exposed during development. `root` is guaranteed by the
 * checked-in index.html application shell.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Production registers offline caching. Development removes a previous worker
// so cached production assets cannot mask current Vite output during testing.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("./sw.js");
} else if ("serviceWorker" in navigator) {
  // A worker registered by an earlier production preview can otherwise keep
  // serving an old application shell while `npm run dev` is active.
  void navigator.serviceWorker.getRegistration().then((registration) => registration?.unregister());
}
