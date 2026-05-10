/**
 * Home Page — MVP Presenter
 * Orchestrates the entire application lifecycle:
 *  - Model & camera initialization
 *  - Realtime detection loop with FPS limiting
 *  - AI fun fact generation
 *  - UI state management
 *
 * Follows MVP pattern: View (templates.js) ↔ Presenter (this) ↔ Services (model layer)
 */

import {
  generateCameraSection,
  generateInfoPanel,
  generateFooter,
} from "../../templates.js";

import CameraService from "../../services/camera.service.js";
import DetectionService from "../../services/detection.service.js";
import RootFactsService from "../../services/rootfacts.service.js";

import { APP_CONFIG, FPS_CONFIG } from "../../config.js";
import {
  isValidDetection,
  hideElement,
  showElement,
  setElementText,
  setElementOpacity,
  addFadeInAnimation,
  addScaleAnimation,
  getConfidenceTheme,
  logError,
  getCameraErrorMessage,
  createDelay,
} from "../../utils/index.js";

export default class HomePage {
  #presenter = null;

  // ──────────────────────────────────────
  // MVP — Model (application state)
  // ──────────────────────────────────────
  #state = {
    isScanning: false,
    isDetecting: false,
    isModelLoaded: false,
    isAiLoaded: false,
    isCameraActive: false,
    isGeneratingFact: false,
    currentLabel: null,
    currentConfidence: 0,
    currentFact: "",
    currentTone: "normal",
    currentFPS: FPS_CONFIG.default,
    lastDetectionTime: 0,
    detectionLoopId: null,
    backend: "loading",
  };

  // ──────────────────────────────────────
  // MVP — Services (Model layer)
  // ──────────────────────────────────────
  #cameraService = new CameraService();
  #detectionService = new DetectionService();
  #rootFactsService = new RootFactsService();

  // ──────────────────────────────────────
  // MVP — View references (cached DOM nodes)
  // ──────────────────────────────────────
  #view = {};

  // ────────────────────────────────────────────────
  // VIEW — Render the page HTML template
  // ────────────────────────────────────────────────
  async render() {
    return `
      <main class="main-content">
        ${generateCameraSection()}
        ${generateInfoPanel()}
      </main>
      ${generateFooter()}
    `;
  }

  // ────────────────────────────────────────────────
  // PRESENTER — After render, wire everything up
  // ────────────────────────────────────────────────
  async afterRender() {
    this._cacheViewElements();
    this._bindEvents();
    await this._initialize();
  }

  // ──────────────────────────────────────
  // Cache all DOM element references
  // ──────────────────────────────────────
  _cacheViewElements() {
    this.#view = {
      // Camera
      video: document.getElementById("media-video"),
      canvas: document.getElementById("media-canvas"),
      cameraOverlay: document.getElementById("camera-overlay"),
      cameraPlaceholder: document.getElementById("camera-placeholder"),
      cameraSelect: document.getElementById("camera-select"),
      btnToggle: document.getElementById("btn-toggle"),

      // Settings
      fpsSlider: document.getElementById("fps-slider"),
      fpsLabel: document.getElementById("fps-label"),
      toneSelect: document.getElementById("tone-select"),

      // Results
      stateIdle: document.getElementById("state-idle"),
      stateLoading: document.getElementById("state-loading"),
      stateResult: document.getElementById("state-result"),

      detectedName: document.getElementById("detected-name"),
      confidenceFill: document.getElementById("confidence-fill"),
      detectedConfidence: document.getElementById("detected-confidence"),

      funFactText: document.getElementById("fun-fact-text"),
      funFactLoading: document.getElementById("fun-fact-loading"),
      funFactContent: document.getElementById("fun-fact-content"),
      btnCopy: document.getElementById("btn-copy"),

      // Header
      statusDot: document.getElementById("status-dot"),
      statusText: document.getElementById("status-text"),
    };
  }

  // ──────────────────────────────────────
  // Bind user interaction events
  // ──────────────────────────────────────
  _bindEvents() {
    // Toggle scan button
    this.#view.btnToggle?.addEventListener("click", () => {
      this._toggleScanning();
    });

    // FPS slider
    this.#view.fpsSlider?.addEventListener("input", (e) => {
      const fps = parseInt(e.target.value, 10);
      this.#state.currentFPS = fps;
      this.#cameraService.setFPS(fps);
      setElementText(this.#view.fpsLabel, `${fps} FPS`);
    });

    // Tone / persona select
    this.#view.toneSelect?.addEventListener("change", (e) => {
      this.#state.currentTone = e.target.value;
      this.#rootFactsService.setTone(e.target.value);

      // If we already have a label, regenerate automatically
      if (this.#state.currentLabel && !this.#state.isGeneratingFact) {
        this._generateFunFact(this.#state.currentLabel);
      }
    });

    // Camera select
    this.#view.cameraSelect?.addEventListener("change", async () => {
      if (this.#state.isCameraActive) {
        await this._restartCamera();
      }
    });

    // Copy button
    this.#view.btnCopy?.addEventListener("click", () => {
      this._copyFact();
    });
  }

  // ──────────────────────────────────────
  // PRESENTER — Application initialization
  // ──────────────────────────────────────
  async _initialize() {
    this._updateStatus("Memuat model...", false);

    try {
      // Step 1: Load detection model (includes backend setup)
      this._updateStatus("Memuat model deteksi...", false);
      const modelResult = await this.#detectionService.loadModel();
      this.#state.isModelLoaded = true;
      this.#state.backend = modelResult.backend;
      this._updateStatus(`Backend: ${modelResult.backend}`, false);

      // Step 2: Load AI model
      this._updateStatus("Memuat model AI...", false);
      await this.#rootFactsService.loadModel((info) => {
        if (info.status === "progress") {
          const pct = Math.round(info.progress || 0);
          this._updateStatus(`Memuat AI... ${pct}%`, false);
        }
      });
      this.#state.isAiLoaded = true;

      // Step 3: Ready
      this._updateStatus("Siap", true);

      if (modelResult.simulated) {
        this._updateStatus("Simulasi", true);
      }

    } catch (error) {
      logError("Initialization", error);
      this._updateStatus("Error: " + error.message, false);
    }
  }

  // ──────────────────────────────────────
  // PRESENTER — Toggle scanning on/off
  // ──────────────────────────────────────
  async _toggleScanning() {
    if (this.#state.isScanning) {
      this._stopScanning();
    } else {
      await this._startScanning();
    }
  }

  async _startScanning() {
    try {
      this._showState("loading");

      // Start camera
      await this.#cameraService.startCamera(
        "media-video",
        "media-canvas",
        this.#view.cameraSelect,
      );
      this.#state.isCameraActive = true;

      // Hide placeholder, show overlay
      hideElement(this.#view.cameraPlaceholder);
      this.#view.cameraOverlay?.classList.add("active");
      this.#view.btnToggle?.classList.add("scanning");

      this.#state.isScanning = true;
      this.#state.isDetecting = true;

      // Start realtime detection loop
      this._startDetectionLoop();

    } catch (error) {
      logError("Start scanning", error);
      this._updateStatus("Gagal: " + error.message, false);
      this._showState("idle");
    }
  }

  _stopScanning() {
    this.#state.isScanning = false;
    this.#state.isDetecting = false;

    // Cancel the detection loop
    if (this.#state.detectionLoopId) {
      cancelAnimationFrame(this.#state.detectionLoopId);
      this.#state.detectionLoopId = null;
    }

    // Stop camera
    this.#cameraService.stopCamera();
    this.#state.isCameraActive = false;

    // Reset UI
    showElement(this.#view.cameraPlaceholder);
    this.#view.cameraOverlay?.classList.remove("active");
    this.#view.btnToggle?.classList.remove("scanning");

    this._showState("idle");
    this._updateStatus("Siap", true);
  }

  // ──────────────────────────────────────
  // PRESENTER — Realtime detection loop with FPS limiting
  // ──────────────────────────────────────
  _startDetectionLoop() {
    const loop = async (timestamp) => {
      if (!this.#state.isDetecting) return;

      const elapsed = timestamp - this.#state.lastDetectionTime;
      const interval = 1000 / this.#state.currentFPS;

      if (elapsed >= interval) {
        this.#state.lastDetectionTime = timestamp;
        await this._runDetection();
      }

      this.#state.detectionLoopId = requestAnimationFrame(loop);
    };

    this.#state.detectionLoopId = requestAnimationFrame(loop);
  }

  // ──────────────────────────────────────
  // PRESENTER — Single detection frame
  // ──────────────────────────────────────
  async _runDetection() {
    const video = this.#cameraService.getVideoElement();
    if (!video) return;

    const result = await this.#detectionService.predict(video);
    if (!result) return;

    const { detectionConfidenceThreshold } = APP_CONFIG;

    if (result.isValid && result.confidence >= detectionConfidenceThreshold) {
      // Update view with detection result
      this._updateDetection(result.label, result.confidence);

      // Generate fact only on label change
      if (this.#state.currentLabel !== result.label) {
        this.#state.currentLabel = result.label;
        this._generateFunFact(result.label);
      }
    }
  }

  // ──────────────────────────────────────
  // VIEW — Update detection display
  // ──────────────────────────────────────
  _updateDetection(label, confidence) {
    this._showState("result");

    setElementText(this.#view.detectedName, label);
    setElementText(this.#view.detectedConfidence, `${confidence}%`);

    if (this.#view.confidenceFill) {
      this.#view.confidenceFill.style.width = `${confidence}%`;

      // Color code based on confidence
      const theme = getConfidenceTheme(confidence);
      const colors = {
        green: "#10b981",
        yellow: "#f59e0b",
        red: "#ef4444",
      };
      this.#view.confidenceFill.style.backgroundColor = colors[theme] || colors.green;
    }

    this.#state.currentConfidence = confidence;
  }

  // ──────────────────────────────────────
  // PRESENTER — AI Fun Fact generation
  // ──────────────────────────────────────
  async _generateFunFact(label) {
    if (!this.#rootFactsService.isReady() || this.#state.isGeneratingFact) return;

    this.#state.isGeneratingFact = true;

    // Show loading in the fact area
    showElement(this.#view.funFactLoading);
    hideElement(this.#view.funFactContent);

    try {
      const fact = await this.#rootFactsService.generateFacts(label, this.#state.currentTone);
      this.#state.currentFact = fact;

      // Update view
      setElementText(this.#view.funFactText, fact);
      addFadeInAnimation(this.#view.funFactText);

    } catch (error) {
      logError("Fun fact generation", error);
      setElementText(this.#view.funFactText, "Gagal menghasilkan fakta. Coba lagi.");
    } finally {
      hideElement(this.#view.funFactLoading);
      showElement(this.#view.funFactContent);
      this.#state.isGeneratingFact = false;
    }
  }

  // ──────────────────────────────────────
  // VIEW — Copy fact to clipboard
  // ──────────────────────────────────────
  async _copyFact() {
    if (!this.#state.currentFact) return;

    try {
      await navigator.clipboard.writeText(this.#state.currentFact);

      // Visual feedback
      if (this.#view.btnCopy) {
        this.#view.btnCopy.classList.add("copied");
        addScaleAnimation(this.#view.btnCopy, () => {
          setTimeout(() => {
            this.#view.btnCopy.classList.remove("copied");
          }, 1500);
        });
      }
    } catch (error) {
      logError("Clipboard copy", error);
      // Fallback: select text
      const range = document.createRange();
      range.selectNodeContents(this.#view.funFactText);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  // ──────────────────────────────────────
  // VIEW — State management (idle / loading / result)
  // ──────────────────────────────────────
  _showState(state) {
    const states = {
      idle: this.#view.stateIdle,
      loading: this.#view.stateLoading,
      result: this.#view.stateResult,
    };

    Object.entries(states).forEach(([key, el]) => {
      if (key === state) {
        showElement(el);
        if (state === "result") {
          addFadeInAnimation(el);
        }
      } else {
        hideElement(el);
      }
    });
  }

  // ──────────────────────────────────────
  // VIEW — Update header status pill
  // ──────────────────────────────────────
  _updateStatus(text, isActive) {
    setElementText(this.#view.statusText, text);

    if (isActive) {
      this.#view.statusDot?.classList.add("active");
    } else {
      this.#view.statusDot?.classList.remove("active");
    }
  }

  // ──────────────────────────────────────
  // Restart camera (e.g., after switching device)
  // ──────────────────────────────────────
  async _restartCamera() {
    this.#cameraService.stopCamera();
    try {
      await this.#cameraService.startCamera(
        "media-video",
        "media-canvas",
        this.#view.cameraSelect,
      );
    } catch (error) {
      logError("Camera restart", error);
    }
  }
}
