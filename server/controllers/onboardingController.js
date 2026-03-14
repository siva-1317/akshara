import { supabase } from "../config/supabase.js";
import { buildQuotaAnnouncement, getGeminiModelForUserId, isQuotaError } from "../utils/geminiClient.js";

const isMissingTableError = (error, tableName) => {
  if (!error) {
    return false;
  }

  const message = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  const target = String(tableName || "").toLowerCase();

  return (
    error.code === "PGRST205" ||
    message.includes(`table 'public.${target}'`) ||
    details.includes(`table 'public.${target}'`)
  );
};

const extractJson = (text) => {
  const cleaned = String(text || "").replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
};

const fallbackPersonalization = (answers = {}) => {
  const selectedSubjects = Array.isArray(answers?.subjectsToPractice)
    ? answers.subjectsToPractice.filter(Boolean)
    : [];

  const recommendedTopics = selectedSubjects.length ? selectedSubjects : ["Aptitude"];
  const defaultTopic = recommendedTopics[0] || "Aptitude";
  const preferredDifficulty = String(answers?.preferredDifficulty || "Mixed").trim() || "Mixed";
  const level = String(answers?.currentLevel || "Beginner").trim() || "Beginner";

  return {
    recommendedTopics,
    defaultTopic,
    defaultDifficulty: preferredDifficulty,
    suggestedTests: [
      `${defaultTopic} short test (${preferredDifficulty})`,
      `${defaultTopic} timed test (Mixed)`,
      "Mixed-topic practice set to build consistency"
    ],
    learningFocus: [
      level === "Beginner" ? "Build fundamentals and accuracy first" : "Increase speed with timed practice",
      "Review wrong answers and note patterns",
      "Practice consistently (even 15 minutes/day)"
    ],
    weakAreas: [String(answers?.difficultSubject || "").trim()].filter(Boolean)
  };
};

const buildPrompt = (answers) => `
You are personalizing an AI test & learning portal for a user.

User onboarding answers (JSON):
${JSON.stringify(answers, null, 2)}

Return valid JSON only in this exact shape:
{
  "recommendedTopics": ["Aptitude"],
  "defaultTopic": "Aptitude",
  "defaultDifficulty": "Easy | Medium | Hard | Mixed",
  "suggestedTests": ["string", "string", "string"],
  "learningFocus": ["string", "string", "string"],
  "weakAreas": ["string", "string"]
}

Rules:
- Keep arrays short (3-6 items).
- Use the user's selected subjects when possible.
- If user provided custom topics, include them.
`;

const parseMinutes = (value) => {
  const cleaned = String(value || "").trim().toLowerCase();
  if (!cleaned) {
    return null;
  }
  if (cleaned.includes("hour")) {
    const match = cleaned.match(/(\d+)/);
    const hours = match ? Number(match[1]) : 1;
    return Number.isFinite(hours) ? hours * 60 : 60;
  }
  const match = cleaned.match(/(\d+)/);
  const minutes = match ? Number(match[1]) : null;
  return Number.isFinite(minutes) ? minutes : null;
};

export const getOnboardingStatus = async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const { data, error } = await supabase
      .from("user_onboarding")
      .select("user_id, ai_result, created_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (isMissingTableError(error, "user_onboarding")) {
      return res.status(503).json({
        message:
          "Onboarding is not configured in the database yet. Please ask the admin to run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    return res.json({
      completed: Boolean(data?.user_id),
      aiResult: data?.ai_result || null,
      createdAt: data?.created_at || null
    });
  } catch (error) {
    next(error);
  }
};

export const submitOnboarding = async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"];
    const { answers } = req.body || {};

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    if (!answers || typeof answers !== "object") {
      return res.status(400).json({ message: "answers is required." });
    }

    let aiResult = null;
    let announcement = null;

    try {
      const { model } = await getGeminiModelForUserId(userId);
      const result = await model.generateContent(buildPrompt(answers));
      const parsed = extractJson(result.response.text());
      aiResult = parsed;
    } catch (assistantError) {
      aiResult = fallbackPersonalization(answers);
      if (isQuotaError(assistantError)) {
        const ctx = await getGeminiModelForUserId(userId);
        if (ctx.source === "default") {
          announcement = buildQuotaAnnouncement({ hasUserKey: ctx.hasUserKey });
        }
      } else {
        console.warn("Onboarding AI personalization failed; using fallback.", assistantError.message);
      }
    }

    const questionsPerTest = Number(answers?.questionsPerTest);
    const timePerTestMinutes = parseMinutes(answers?.timePerTest);
    aiResult = {
      ...(aiResult || {}),
      ...(Number.isFinite(questionsPerTest) ? { questionsPerTest } : {}),
      ...(Number.isFinite(timePerTestMinutes) ? { timePerTestMinutes } : {})
    };

    const payload = {
      user_id: userId,
      answers,
      ai_result: aiResult,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("user_onboarding")
      .upsert(payload, { onConflict: "user_id" })
      .select("user_id, ai_result, created_at, updated_at")
      .single();

    if (isMissingTableError(error, "user_onboarding")) {
      return res.status(503).json({
        message:
          "Onboarding is not configured in the database yet. Please ask the admin to run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    return res.status(201).json({
      message: "Onboarding saved successfully.",
      onboarding: data,
      announcement
    });
  } catch (error) {
    next(error);
  }
};
