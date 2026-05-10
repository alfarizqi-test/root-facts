/**
 * Root Facts — Application Entry Point
 * Bootstraps the app, registers the service worker, and renders the home page.
 */

import "../styles/styles.css";
import App from "./pages/app.js";

// Register the Service Worker for PWA / offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("✅ Service Worker registered:", registration.scope);
      })
      .catch((error) => {
        console.warn("⚠️ Service Worker registration failed:", error);
      });
  });
}

// PWA install prompt handler
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Show an install button if one exists in the UI
  const installBtn = document.getElementById("btn-install");
  if (installBtn) {
    installBtn.classList.remove("hidden");
    installBtn.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        console.log("Install prompt result:", result.outcome);
        deferredPrompt = null;
        installBtn.classList.add("hidden");
      }
    });
  }
});

// Bootstrap the application
document.addEventListener("DOMContentLoaded", async () => {
  const app = new App({
    container: document.querySelector("#main-content"),
  });

  await app.renderPage();

  // Initialize lucide icons if loaded via CDN
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
});
