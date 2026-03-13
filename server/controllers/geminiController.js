import { geminiModel } from "../config/gemini.js";
import { supabase } from "../config/supabase.js";

const extractJson = (text) => {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
};

const isQuotaError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("quota") ||
    message.includes("rate limit")
  );
};

const normalizeSubtopic = (value) => String(value || "").trim();

const uniqueSubtopics = (items) => {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    const cleaned = normalizeSubtopic(item);
    if (!cleaned) {
      continue;
    }
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(cleaned);
  }
  return result;
};

const fallbackSubtopicsForTopic = (topic) => {
  const key = String(topic || "").trim().toLowerCase();
  if (key === "aptitude") {
    return ["Ages", "Calendar", "Mixtures", "Ratio"];
  }
  return [];
};

const buildFallbackQuestions = ({ topic, difficulty, count, subtopics }) => {
  const cleanedSubtopics = uniqueSubtopics(subtopics);
  const topicLabel = String(topic || "General").trim() || "General";

  const safeCount = Math.max(1, Math.min(50, Math.floor(Number(count) || 1)));

  const bank = (() => {
    const key = String(topicLabel).trim().toLowerCase();
    if (key !== "aptitude") {
      return [];
    }

    const rows = [
      {
        subtopic: "Ages",
        question: "A is 4 years older than B. If B is 10 years old, what is A's age?",
        options: ["12", "13", "14", "15"],
        answer: "14",
        explanation: "A = B + 4 = 10 + 4 = 14."
      },
      {
        subtopic: "Ages",
        question: "The ratio of ages of A and B is 3:5. If A is 18 years old, what is B's age?",
        options: ["24", "28", "30", "32"],
        answer: "30",
        explanation: "3 parts = 18 => 1 part = 6 => B = 5 parts = 30."
      },
      {
        subtopic: "Ages",
        question: "After 5 years, the age of C will be 25 years. What is C's present age?",
        options: ["18", "19", "20", "21"],
        answer: "20",
        explanation: "Present age = 25 - 5 = 20."
      },
      {
        subtopic: "Ratio",
        question: "If x:y = 2:3 and y:z = 4:5, find x:z.",
        options: ["8:15", "2:5", "3:8", "4:9"],
        answer: "8:15",
        explanation: "Make y common: x:y = 2:3 => 8:12 and y:z = 4:5 => 12:15, so x:z = 8:15."
      },
      {
        subtopic: "Ratio",
        question: "A and B invest in a business in the ratio 3:2. If total profit is 1000, B's share is:",
        options: ["400", "500", "600", "700"],
        answer: "400",
        explanation: "Total parts = 5, B = 2/5 of 1000 = 400."
      },
      {
        subtopic: "Mixtures",
        question: "In a mixture of milk and water, milk:water = 3:1. What percentage of the mixture is water?",
        options: ["20%", "25%", "30%", "40%"],
        answer: "25%",
        explanation: "Total parts = 4, water = 1/4 = 25%."
      },
      {
        subtopic: "Mixtures",
        question: "A shopkeeper mixes 2 liters of water with 8 liters of juice. What is the ratio of water to juice?",
        options: ["1:2", "1:3", "1:4", "2:5"],
        answer: "1:4",
        explanation: "Water:Juice = 2:8 = 1:4."
      },
      {
        subtopic: "Calendar",
        question: "How many days are there in a leap year?",
        options: ["365", "366", "364", "367"],
        answer: "366",
        explanation: "A leap year has 366 days."
      },
      {
        subtopic: "Calendar",
        question: "If today is Monday, what day will it be after 9 days?",
        options: ["Tuesday", "Wednesday", "Thursday", "Friday"],
        answer: "Wednesday",
        explanation: "9 mod 7 = 2, Monday + 2 days = Wednesday."
      },
      {
        subtopic: "Ratio",
        question: "If 5 pencils cost 20, what is the cost of 12 pencils?",
        options: ["36", "40", "44", "48"],
        answer: "48",
        explanation: "Cost per pencil = 20/5 = 4, so 12 pencils cost 48."
      },
      {
        subtopic: "Mixtures",
        question: "A mixture contains 40% salt. How much salt is there in 250g of mixture?",
        options: ["80g", "90g", "100g", "120g"],
        answer: "100g",
        explanation: "40% of 250g = 0.4 * 250 = 100g."
      },
      {
        subtopic: "Ages",
        question: "D is twice as old as E. If E is 12 years old, how old is D?",
        options: ["18", "20", "22", "24"],
        answer: "24",
        explanation: "D = 2 * 12 = 24."
      },
      {
        subtopic: "Calendar",
        question: "How many months have 31 days?",
        options: ["6", "7", "8", "9"],
        answer: "7",
        explanation: "Jan, Mar, May, Jul, Aug, Oct, Dec = 7 months."
      },
      {
        subtopic: "Ratio",
        question: "Divide 120 in the ratio 2:3. The larger part is:",
        options: ["48", "60", "72", "80"],
        answer: "72",
        explanation: "Total parts = 5, larger = 3/5 of 120 = 72."
      },
      {
        subtopic: "Mixtures",
        question: "In a mixture, alcohol:water = 1:4. What fraction of the mixture is alcohol?",
        options: ["1/2", "1/3", "1/5", "1/4"],
        answer: "1/5",
        explanation: "Total parts = 5, alcohol = 1 part => 1/5."
      },
      {
        subtopic: "Calendar",
        question: "If a month has 30 days, how many weeks and days does it contain?",
        options: ["4 weeks 1 day", "4 weeks 2 days", "4 weeks 3 days", "5 weeks 1 day"],
        answer: "4 weeks 2 days",
        explanation: "30 = 4*7 + 2, so 4 weeks and 2 days."
      },
      {
        subtopic: "Ages",
        question: "F is 5 years younger than G. If G is 27, what is F's age?",
        options: ["20", "21", "22", "23"],
        answer: "22",
        explanation: "F = 27 - 5 = 22."
      },
      {
        subtopic: "Ratio",
        question: "If 3 kg of rice costs 150, what is the cost of 7 kg?",
        options: ["300", "350", "375", "400"],
        answer: "350",
        explanation: "Cost per kg = 150/3 = 50, so 7 kg costs 350."
      },
      {
        subtopic: "Mixtures",
        question: "A mixture has 60% coffee. How much coffee is in 500 ml of mixture?",
        options: ["250 ml", "280 ml", "300 ml", "350 ml"],
        answer: "300 ml",
        explanation: "60% of 500 ml = 0.6 * 500 = 300 ml."
      },
      {
        subtopic: "Calendar",
        question: "If today is Friday, what day will it be after 15 days?",
        options: ["Saturday", "Sunday", "Monday", "Tuesday"],
        answer: "Saturday",
        explanation: "15 mod 7 = 1, Friday + 1 = Saturday."
      }
    ];

    if (!cleanedSubtopics.length) {
      return rows;
    }

    const selected = new Set(cleanedSubtopics.map((s) => s.toLowerCase()));
    const filtered = rows.filter((row) => selected.has(String(row.subtopic).toLowerCase()));
    return filtered.length ? filtered : rows;
  })();

  const questions = [];
  for (let index = 0; index < safeCount; index += 1) {
    const row = bank[index % Math.max(1, bank.length)];
    if (!row) {
      questions.push({
        question: `Practice question ${index + 1} on ${topicLabel}.`,
        options: ["Option 1", "Option 2", "Option 3", "Option 4"],
        answer: "Option 1",
        explanation: "Retry later for AI-generated questions.",
        difficulty
      });
      continue;
    }

    questions.push({
      question: row.question,
      options: row.options,
      answer: row.answer,
      explanation: row.explanation,
      difficulty
    });
  }

  return questions;
};

const SUBTOPIC_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const subtopicCache = new Map();

export const generateQuestions = async (req, res, next) => {
  try {
    const { testId, topic, difficulty, count, subtopics = [] } = req.body;

    if (!testId || !topic || !difficulty || !count) {
      return res.status(400).json({ message: "testId, topic, difficulty, and count are required." });
    }

    const { data: testRow, error: testError } = await supabase
      .from("tests")
      .select("question_count")
      .eq("id", testId)
      .single();

    if (testError) {
      throw testError;
    }

    const requestedCount = Math.floor(Number(count));
    const testCount = Number.isFinite(testRow.question_count) ? testRow.question_count : requestedCount;
    const effectiveCount = Math.max(1, Math.min(requestedCount, testCount));

    const cleanedSubtopics = uniqueSubtopics(subtopics);
    const prompt = `
Generate ${effectiveCount} multiple-choice questions for an online test.
Topic: ${topic}
Difficulty: ${difficulty}
${cleanedSubtopics.length ? `Subtopics to focus on: ${cleanedSubtopics.join(", ")}` : ""}

Return valid JSON only in this exact shape:
{
  "questions": [
    {
      "question": "string",
      "options": ["option 1", "option 2", "option 3", "option 4"],
      "answer": "string",
      "explanation": "string",
      "difficulty": "${difficulty}"
    }
  ]
}
`;

    let parsedQuestions;
    let usedFallback = false;

    try {
      const result = await geminiModel.generateContent(prompt);
      const text = result.response.text();
      const parsed = extractJson(text);
      parsedQuestions = parsed.questions;
    } catch (assistantError) {
      usedFallback = true;
      parsedQuestions = buildFallbackQuestions({
        topic,
        difficulty,
        count: effectiveCount,
        subtopics
      });

      if (!isQuotaError(assistantError)) {
        console.warn("Gemini question generation failed; using fallback.", assistantError.message);
      }
    }

    const questions = (parsedQuestions || []).slice(0, effectiveCount).map((question, index) => ({
      test_id: testId,
      question: question.question,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      difficulty: question.difficulty || difficulty,
      topic,
      position: index + 1
    }));

    const { data, error } = await supabase.from("questions").insert(questions).select();

    if (error) {
      throw error;
    }

    return res.json({
      message: usedFallback
        ? "Questions generated with fallback because AI quota was exceeded."
        : "Questions generated successfully.",
      questions: data,
      fallback: usedFallback
    });
  } catch (error) {
    next(error);
  }
};

export const suggestSubtopics = async (req, res, next) => {
  try {
    const { topic } = req.body;

    if (!topic?.trim()) {
      return res.status(400).json({ message: "topic is required." });
    }

    const cacheKey = topic.trim().toLowerCase();
    const cached = subtopicCache.get(cacheKey);
    if (cached && Date.now() - cached.at < SUBTOPIC_CACHE_TTL_MS) {
      return res.json({ subtopics: cached.subtopics });
    }

    const fallback = fallbackSubtopicsForTopic(topic);

    try {
      const prompt = `
Suggest 8 to 12 useful subtopics for: ${topic}
Return valid JSON only in this exact shape:
{
  "subtopics": ["subtopic1", "subtopic2"]
}
`;
      const result = await geminiModel.generateContent(prompt);
      const parsed = extractJson(result.response.text());
      const subtopics = uniqueSubtopics(parsed?.subtopics);
      const finalSubtopics = subtopics.length ? subtopics : fallback;
      subtopicCache.set(cacheKey, { at: Date.now(), subtopics: finalSubtopics });
      return res.json({ subtopics: finalSubtopics });
    } catch (assistantError) {
      subtopicCache.set(cacheKey, { at: Date.now(), subtopics: fallback });
      return res.json({ subtopics: fallback });
    }
  } catch (error) {
    next(error);
  }
};

export const evaluateTestWithGemini = async ({ test, questions, answers }) => {
  const prompt = `
You are evaluating an online test submission.

Test Topic: ${test.topic}
Difficulty: ${test.difficulty}

Questions and answers:
${JSON.stringify(
    questions.map((question) => ({
      question: question.question,
      options: question.options,
      correctAnswer: question.answer,
      explanation: question.explanation,
      userAnswer: answers.find((answer) => answer.questionId === question.id)?.userAnswer || ""
    })),
    null,
    2
  )}

Return valid JSON only:
{
  "score": 0,
  "weakTopics": ["topic1", "topic2"],
  "explanation": "overall evaluation summary"
}
`;

  const result = await geminiModel.generateContent(prompt);
  return extractJson(result.response.text());
};
