/**
 * Detection Service
 * Handles TensorFlow.js model loading, adaptive backend selection,
 * and realtime vegetable image classification with proper memory management.
 */

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgpu";

import { MODEL_CONFIG, BACKEND_PRIORITY } from "../config.js";
import { logError, validateModelMetadata } from "../utils/index.js";

class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = MODEL_CONFIG;
    this.currentBackend = null;
    this.performanceStats = {
      operations: 0,
      totalTime: 0,
      averageTime: 0,
    };
  }

  /**
   * Set up the TensorFlow.js backend with adaptive fallback strategy.
   * Priority: WebGPU → WebGL → CPU
   * @returns {string} The name of the active backend
   */
  async _setupBackend() {
    for (const backend of BACKEND_PRIORITY) {
      try {
        if (backend === "webgpu" && !navigator.gpu) {
          console.log("WebGPU not supported, skipping...");
          continue;
        }

        await tf.setBackend(backend);
        await tf.ready();
        this.currentBackend = backend;
        console.log(`✅ TF.js backend set to: ${backend}`);
        return backend;
      } catch (err) {
        console.warn(`⚠️ Backend "${backend}" failed:`, err.message);
      }
    }

    // Last resort: cpu should always work
    await tf.setBackend("cpu");
    await tf.ready();
    this.currentBackend = "cpu";
    console.log("✅ TF.js backend fallback to: cpu");
    return "cpu";
  }

  /**
   * Load the TensorFlow.js model and metadata.
   * Sets up the adaptive backend before loading.
   * @returns {object} { backend, labelCount }
   */
  async loadModel() {
    // 1. Setup backend first
    const backend = await this._setupBackend();

    try {
      // 2. Load model and metadata in parallel
      const [model, metaResponse] = await Promise.all([
        tf.loadLayersModel(this.config.modelPath),
        fetch(this.config.metadataPath),
      ]);

      this.model = model;
      console.log("✅ TF.js model loaded successfully");
      console.log("   Layers:", this.model.layers.length);

      // 3. Parse metadata for labels
      if (metaResponse.ok) {
        const metadata = await metaResponse.json();
        if (validateModelMetadata(metadata)) {
          this.labels = metadata.labels;
          console.log("✅ Labels loaded:", this.labels.length);
        } else {
          console.warn("⚠️ Invalid metadata, using defaults");
          this.labels = this.config.defaultLabels;
        }
      } else {
        console.warn("⚠️ Metadata fetch failed, using defaults");
        this.labels = this.config.defaultLabels;
      }

      return { backend, labelCount: this.labels.length };
    } catch (error) {
      logError("Model loading failed", error);

      // Fallback: simulation mode so the app can still run
      console.warn("🔄 Entering simulation mode (model unavailable)");
      this.model = "SIMULATION_MODE";
      this.labels = this.config.defaultLabels;

      return { backend, labelCount: this.labels.length, simulated: true };
    }
  }

  /**
   * Run prediction on a video/image element.
   * Uses tf.tidy() for automatic tensor cleanup (memory management).
   *
   * @param {HTMLVideoElement|HTMLImageElement} imageElement
   * @returns {{ label: string, confidence: number, isValid: boolean } | null}
   */
  async predict(imageElement) {
    if (!this.model) return null;

    // Validate video readiness
    if (imageElement instanceof HTMLVideoElement) {
      if (imageElement.readyState < 2 || imageElement.videoWidth === 0) {
        return null;
      }
    }

    const startTime = performance.now();

    // Simulation mode — no TF processing needed
    if (this.model === "SIMULATION_MODE") {
      const randomIdx = Math.floor(Math.random() * this.labels.length);
      const confidence = 70 + Math.random() * 29;
      return {
        label: this.labels[randomIdx],
        confidence: Math.round(confidence),
        isValid: true,
      };
    }

    // Real model prediction wrapped in tf.tidy() for memory management
    try {
      const result = tf.tidy(() => {
        // Preprocess: resize to 224x224, normalize to [0, 1], add batch dimension
        const tensor = tf.browser
          .fromPixels(imageElement)
          .resizeNearestNeighbor([this.config.imageSize, this.config.imageSize])
          .toFloat()
          .expandDims(0)
          .div(255.0);

        // Run inference
        const predictions = this.model.predict(tensor);
        const data = predictions.dataSync();

        // Find the class with highest probability
        let maxIdx = 0;
        let maxVal = data[0];
        for (let i = 1; i < data.length; i++) {
          if (data[i] > maxVal) {
            maxVal = data[i];
            maxIdx = i;
          }
        }

        const confidence = Math.round(maxVal * 100);

        return {
          label: this.labels[maxIdx] || "Unknown",
          confidence,
          isValid: confidence >= 50,
        };
      });

      // Update performance stats
      const elapsed = performance.now() - startTime;
      this.performanceStats.operations++;
      this.performanceStats.totalTime += elapsed;
      this.performanceStats.averageTime =
        this.performanceStats.totalTime / this.performanceStats.operations;

      return result;
    } catch (err) {
      logError("Prediction failed", err);
      return null;
    }
  }

  /**
   * Get the current backend name.
   */
  getBackend() {
    return this.currentBackend;
  }

  /**
   * Get performance statistics.
   */
  getStats() {
    return { ...this.performanceStats };
  }

  /**
   * Dispose of the model to free memory.
   */
  dispose() {
    if (this.model && this.model !== "SIMULATION_MODE") {
      this.model.dispose();
    }
    this.model = null;
  }
}

export default DetectionService;
