import { supabase } from "../config/supabase.js";
import { defaultGeminiModel, getGeminiModelForApiKey, hasDefaultGeminiKey } from "../config/gemini.js";
import { decryptSecret } from "./secrets.js";

export const isQuotaError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("quota") ||
    message.includes("rate limit")
  );
};

export const getGeminiModelForUserId = async (userId) => {
  const cleanedUserId = String(userId || "").trim();
  if (!cleanedUserId) {
    return { model: defaultGeminiModel, source: "default", hasUserKey: false };
  }

  const { data, error } = await supabase
    .from("users")
    .select("gemini_api_key")
    .eq("id", cleanedUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const decryptedKey = decryptSecret(data?.gemini_api_key);
  if (decryptedKey) {
    return { model: getGeminiModelForApiKey(decryptedKey), source: "user", hasUserKey: true };
  }

  return { model: defaultGeminiModel, source: "default", hasUserKey: false };
};

export const buildQuotaAnnouncement = ({ hasUserKey }) => {
  if (hasUserKey) {
    return null;
  }
  if (!hasDefaultGeminiKey) {
    return "AI is not configured yet. Ask the admin to set the Gemini API key on the server.";
  }
  return "AI quota reached for the default key. Add your own Gemini API key in Profile (Edit mode) to keep using AI features.";
};

