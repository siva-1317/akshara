import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiApiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const geminiModel = geminiApiKey
  ? new GoogleGenerativeAI(geminiApiKey).getGenerativeModel({
      model: modelName
    })
  : {
      async generateContent() {
        throw new Error(
          "Gemini is not configured. Set GEMINI_API_KEY in server/.env."
        );
      }
    };

if (!geminiApiKey) {
  console.warn(
    "Gemini API key is missing. AI question generation and evaluation will fail until server/.env is configured."
  );
}
