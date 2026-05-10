/**
 * Camera Service
 * Handles camera access, stream management, and device enumeration.
 * Responsible for starting/stopping the camera and providing video frames.
 */

import { CAMERA_CONFIG, FPS_CONFIG } from "../config.js";
import { getCameraErrorMessage, logError } from "../utils/index.js";

class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = CAMERA_CONFIG;
    this._currentFPS = FPS_CONFIG.default;
    this._selectedDeviceId = null;
  }

  /**
   * Initialize video and canvas DOM elements.
   */
  initializeElements(videoId, canvasId) {
    this.video = document.getElementById(videoId);
    this.canvas = document.getElementById(canvasId);

    if (this.canvas) {
      this.canvas.width = 224;
      this.canvas.height = 224;
    }
  }

  /**
   * Enumerate available video input devices and populate the camera select dropdown.
   */
  async loadCameras(cameraSelect) {
    try {
      // Request a temporary stream to trigger permission prompt
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");

      if (cameraSelect) {
        cameraSelect.innerHTML = "";

        videoDevices.forEach((device, index) => {
          const option = document.createElement("option");
          option.value = device.deviceId;
          option.textContent = device.label || `Kamera ${index + 1}`;

          // Prefer environment/back camera
          if (device.label.toLowerCase().includes("back") ||
              device.label.toLowerCase().includes("belakang") ||
              device.label.toLowerCase().includes("environment")) {
            option.selected = true;
          }

          cameraSelect.appendChild(option);
        });

        // If we have a "default" option mapping
        if (videoDevices.length === 0) {
          const fallback = document.createElement("option");
          fallback.value = "default";
          fallback.textContent = "Kamera Default";
          cameraSelect.appendChild(fallback);
        }
      }

      return videoDevices;
    } catch (error) {
      logError("Camera enumeration failed", error);
      throw new Error(getCameraErrorMessage(error));
    }
  }

  /**
   * Build camera constraints based on selected device or facing mode.
   */
  _getConstraints(deviceId) {
    if (deviceId && deviceId !== "default" && deviceId !== "front") {
      return {
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
    }

    // Default: prefer back camera; "front" uses user-facing
    const facingMode = deviceId === "front" ? "user" : "environment";
    return {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };
  }

  /**
   * Start the camera stream and attach it to the video element.
   */
  async startCamera(videoId, canvasId, cameraSelect) {
    this.initializeElements(videoId, canvasId);

    if (!this.video) {
      throw new Error("Video element not found");
    }

    // Stop any existing stream
    this.stopCamera();

    try {
      // Determine which device to use
      const selectedValue = cameraSelect?.value || "default";
      this._selectedDeviceId = selectedValue;

      const constraints = this._getConstraints(selectedValue);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      this.video.srcObject = this.stream;

      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        this.video.onloadedmetadata = () => {
          this.video.play()
            .then(resolve)
            .catch(reject);
        };
        this.video.onerror = reject;
      });

      return true;
    } catch (error) {
      logError("Camera start failed", error);
      throw new Error(getCameraErrorMessage(error));
    }
  }

  /**
   * Stop the camera stream and release all tracks.
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }
  }

  /**
   * Update the FPS target (used by the detection loop, not the camera itself).
   */
  setFPS(fps) {
    this._currentFPS = Math.max(FPS_CONFIG.min, Math.min(FPS_CONFIG.max, fps));
  }

  /**
   * Get the current FPS setting.
   */
  getFPS() {
    return this._currentFPS;
  }

  /**
   * Check whether the camera stream is currently active.
   */
  isActive() {
    return !!(this.stream && this.stream.active);
  }

  /**
   * Get the video element for external consumers (e.g., detection service).
   */
  getVideoElement() {
    return this.video;
  }
}

export default CameraService;
