import "./env.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const defaultGeminiApiKey = String(process.env.GEMINI_API_KEY || "").trim();
const defaultModelName = String(process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();

export const hasDefaultGeminiKey = Boolean(defaultGeminiApiKey);

export const getGeminiModelForApiKey = (apiKey, model = defaultModelName) => {
  const cleanedKey = String(apiKey || "").trim();
  const cleanedModel = String(model || defaultModelName).trim() || defaultModelName;

  if (!cleanedKey) {
    return {
      async generateContent() {
        throw new Error("Gemini API key is missing.");
      }
    };
  }

  return new GoogleGenerativeAI(cleanedKey).getGenerativeModel({ model: cleanedModel });
};

export const defaultGeminiModel = hasDefaultGeminiKey
  ? getGeminiModelForApiKey(defaultGeminiApiKey, defaultModelName)
  : {
      async generateContent() {
        throw new Error("Gemini is not configured. Set GEMINI_API_KEY in server/.env.");
      }
    };

// Backwards-compat export used by older controllers.
export const geminiModel = defaultGeminiModel;

if (!hasDefaultGeminiKey) {
  console.warn(
    "Gemini API key is missing. AI question generation and evaluation will fail until server/.env is configured."
  );
}
