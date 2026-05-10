/**
 * Root Facts — Application Configuration
 * Centralized configuration for all services and UI behavior.
 */

export const APP_CONFIG = {
  detectionConfidenceThreshold: 70,
  analyzingDelay: 2000,
  factsGenerationDelay: 2000,
  detectionRetryInterval: 100,
};

export const UI_CONFIG = {
  animationDuration: 300,
  fadeAnimation: "fadeIn 0.5s ease-out forwards",
  confidenceThresholds: {
    excellent: 90,
    good: 80,
  },
  factsCardOpacity: {
    loading: 0.6,
    normal: 1.0,
  },
};

export const CAMERA_CONFIG = {
  defaultFacing: "environment",
  constraints: {
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  },
};

export const MODEL_CONFIG = {
  modelPath: "./model/model.json",
  metadataPath: "./model/metadata.json",
  imageSize: 224,
  defaultLabels: [
    "Beetroot", "Paprika", "Cabbage", "Carrot", "Cauliflower",
    "Chilli", "Corn", "Cucumber", "Eggplant", "Garlic",
    "Ginger", "Lettuce", "Onion", "Peas", "Potato",
    "Turnip", "Soybean", "Spinach",
  ],
};

export const AI_CONFIG = {
  modelId: "Xenova/distilgpt2",
  defaultPersona: "normal",
  maxInputLength: 100,
  generation: {
    temperature: 0.7,
    top_p: 0.9,
    max_new_tokens: 80,
    do_sample: true,
  },
  personas: {
    normal: (label) => `Give me one interesting and fun fact about the vegetable ${label}:`,
    funny: (label) => `Tell me a hilarious and funny fact about ${label} that would make people laugh:`,
    professional: (label) => `Provide a professional scientific fact about the vegetable ${label}:`,
    casual: (label) => `Share a cool and casual fun fact about ${label}:`,
  },
};

export const FPS_CONFIG = {
  default: 30,
  min: 15,
  max: 60,
  step: 15,
};

export const BACKEND_PRIORITY = ["webgpu", "webgl", "cpu"];
