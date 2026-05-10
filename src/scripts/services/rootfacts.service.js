/**
 * RootFacts Service
 * Handles AI text generation using Transformers.js (HuggingFace)
 * for generating fun facts about detected vegetables.
 * Supports dynamic persona/tone switching.
 */

import { pipeline, env } from "@huggingface/transformers";
import { AI_CONFIG } from "../config.js";
import { logError } from "../utils/index.js";

// Configure Transformers.js for browser usage
env.allowLocalModels = false;
env.useBrowserCache = true;

class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = AI_CONFIG;
    this.currentBackend = null;
    this.currentTone = AI_CONFIG.defaultPersona;
  }

  /**
   * Load the text-generation model and initialize the pipeline.
   * @param {Function} progressCallback — receives { status, progress } updates
   * @returns {boolean} true when ready
   */
  async loadModel(progressCallback = null) {
    if (this.isModelLoaded) return true;

    try {
      console.log(`🤖 Loading AI model: ${this.config.modelId}`);

      this.generator = await pipeline(
        "text-generation",
        this.config.modelId,
        {
          progress_callback: (info) => {
            if (progressCallback) {
              progressCallback(info);
            }
            if (info.status === "progress") {
              console.log(`   AI model loading: ${Math.round(info.progress || 0)}%`);
            }
          },
        },
      );

      this.isModelLoaded = true;
      console.log("✅ AI model loaded successfully");
      return true;
    } catch (error) {
      logError("AI model loading failed", error);
      throw new Error("Gagal memuat model AI: " + error.message);
    }
  }

  /**
   * Set the persona/tone for fact generation.
   * @param {string} tone — "normal" | "funny" | "professional" | "casual"
   */
  setTone(tone) {
    if (this.config.personas[tone]) {
      this.currentTone = tone;
    } else {
      console.warn(`Unknown tone "${tone}", keeping "${this.currentTone}"`);
    }
  }

  /**
   * Build the prompt based on label and current tone.
   * Sanitizes input against prompt injection.
   * @param {string} vegetable
   * @param {string} tone
   * @returns {string}
   */
  _buildPrompt(vegetable, tone) {
    // Sanitize: strip special characters and limit length
    const sanitized = vegetable
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .slice(0, this.config.maxInputLength);

    if (!sanitized) {
      return "Tell me an interesting fact about vegetables:";
    }

    const personaFn = this.config.personas[tone] || this.config.personas.normal;
    return personaFn(sanitized);
  }

  /**
   * Generate a fun fact about the detected vegetable.
   * @param {string} vegetable — the detected label
   * @param {string} tone — persona tone override (optional)
   * @returns {string} generated fact text
   */
  async generateFacts(vegetable, tone = null) {
    if (!this.isModelLoaded || !this.generator) {
      throw new Error("Model AI belum dimuat. Tunggu inisialisasi selesai.");
    }

    if (this.isGenerating) {
      throw new Error("Sedang memproses. Tunggu sebentar.");
    }

    this.isGenerating = true;

    try {
      const activeTone = tone || this.currentTone;
      const prompt = this._buildPrompt(vegetable, activeTone);

      console.log(`🧠 Generating fact [${activeTone}]:`, prompt);

      const result = await this.generator(prompt, {
        max_new_tokens: this.config.generation.max_new_tokens,
        temperature: this.config.generation.temperature,
        top_p: this.config.generation.top_p,
        do_sample: this.config.generation.do_sample,
      });

      const generated = result?.[0]?.generated_text || "";

      // Clean up: try to extract just the generated part after the prompt
      let fact = generated;
      if (fact.startsWith(prompt)) {
        fact = fact.slice(prompt.length).trim();
      }

      // If empty after cleanup, return the full text
      if (!fact) {
        fact = generated.trim();
      }

      return fact || "Maaf, tidak bisa menghasilkan fakta saat ini. Coba lagi.";
    } catch (error) {
      logError("Fact generation failed", error);
      throw new Error("Gagal menghasilkan fun fact: " + error.message);
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Check if the model is loaded and ready.
   */
  isReady() {
    return this.isModelLoaded && this.generator !== null;
  }
}

export default RootFactsService;
