import { supabase } from "../config/supabase.js";
import { buildQuotaAnnouncement, getGeminiModelForUserId, isQuotaError } from "../utils/geminiClient.js";

const extractJson = (text) => {
  const cleaned = String(text || "").replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
};

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

const isMissingColumnError = (error, columnName) => {
  if (!error) {
    return false;
  }

  const message = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  const target = String(columnName || "").toLowerCase();

  return (
    message.includes("column") &&
    (message.includes("does not exist") || details.includes("does not exist")) &&
    (message.includes(target) || details.includes(target))
  );
};

const requireApprovedUser = async (req, res) => {
  const userId = req.headers["x-user-id"];
  const role = String(req.headers["x-user-role"] || "").toLowerCase();

  if (!userId || role === "admin") {
    return true;
  }

  const { data, error } = await supabase
    .from("users")
    .select("approval_status")
    .eq("id", userId)
    .maybeSingle();

  if (isMissingTableError(error, "users") || isMissingColumnError(error, "approval_status")) {
    return true;
  }

  if (error) {
    throw error;
  }

  const status = String(data?.approval_status || "approved").toLowerCase();
  if (status === "approved") {
    return true;
  }

  const message = status === "rejected" ? "Your access request was rejected." : "Waiting for admin approval.";
  res.status(403).json({ message });
  return false;
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

const buildFallbackQuestions = ({ topic, difficulty, count }) => {
  const safeCount = Math.max(1, Math.min(50, Math.floor(Number(count) || 10)));
  const label = String(topic || "General").trim() || "General";
  const level = String(difficulty || "medium").trim() || "medium";

  const templates = [
    {
      question: `Which option best describes a key concept in ${label}?`,
      options: ["Definition", "Example", "Rule", "All of the above"],
      answer: "All of the above",
      explanation: `Foundational understanding of ${label} includes definitions, examples, and rules.`
    },
    {
      question: `In ${label}, which is typically considered a good practice?`,
      options: ["Ignore errors", "Write clear code", "Skip testing", "Avoid documentation"],
      answer: "Write clear code",
      explanation: "Clarity improves maintainability and reduces mistakes."
    },
    {
      question: `What is the primary goal when learning ${label}?`,
      options: ["Memorize only", "Understand concepts", "Avoid practice", "Copy answers"],
      answer: "Understand concepts",
      explanation: "Understanding concepts helps solve new problems."
    }
  ];

  const questions = [];
  for (let index = 0; index < safeCount; index += 1) {
    const base = templates[index % templates.length];
    questions.push({
      question: base.question,
      options: base.options,
      answer: base.answer,
      explanation: base.explanation,
      difficulty: level
    });
  }
  return questions;
};

const chunk = (items, size) => {
  const result = [];
  const safeSize = Math.max(1, Math.floor(size || 500));
  for (let index = 0; index < (items || []).length; index += safeSize) {
    result.push(items.slice(index, index + safeSize));
  }
  return result;
};

export const getTasks = async (req, res, next) => {
  try {
    if (!(await requireApprovedUser(req, res))) {
      return;
    }

    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({ message: "Missing user context." });
    }

    const { data: tasks, error: taskError } = await supabase
      .from("published_tests")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (isMissingTableError(taskError, "published_tests")) {
      return res.json({ tasks: [] });
    }

    if (taskError) {
      throw taskError;
    }

    const { data: completions, error: completionError } = await supabase
      .from("task_completions")
      .select("published_test_id, score, coins_awarded, certificate_id, completed_at")
      .eq("user_id", userId);

    const completionMap = new Map();

    if (!isMissingTableError(completionError, "task_completions")) {
      if (completionError) {
        throw completionError;
      }
      (completions || []).forEach((item) => {
        completionMap.set(item.published_test_id, item);
      });
    }

    const merged = (tasks || []).map((task) => ({
      ...task,
      completion: completionMap.get(task.id) || null
    }));

    return res.json({ tasks: merged });
  } catch (error) {
    next(error);
  }
};

export const startTask = async (req, res, next) => {
  try {
    if (!(await requireApprovedUser(req, res))) {
      return;
    }

    const userId = req.headers["x-user-id"];
    const { publishedTestId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Missing user context." });
    }

    if (!publishedTestId) {
      return res.status(400).json({ message: "publishedTestId is required." });
    }

    const { data: completion, error: completionError } = await supabase
      .from("task_completions")
      .select("id")
      .eq("user_id", userId)
      .eq("published_test_id", publishedTestId)
      .maybeSingle();

    if (!isMissingTableError(completionError, "task_completions")) {
      if (completionError) {
        throw completionError;
      }
      if (completion?.id) {
        return res.status(400).json({ message: "Task already completed." });
      }
    }

    const { data: task, error: taskError } = await supabase
      .from("published_tests")
      .select("*")
      .eq("id", publishedTestId)
      .eq("status", "published")
      .single();

    if (isMissingTableError(taskError, "published_tests")) {
      return res.status(503).json({ message: "Tasks are not configured yet. Ask admin to run schema." });
    }

    if (taskError) {
      throw taskError;
    }

    const { data: templateQuestions, error: questionError } = await supabase
      .from("published_test_questions")
      .select("*")
      .eq("published_test_id", publishedTestId)
      .order("position", { ascending: true });

    if (isMissingTableError(questionError, "published_test_questions")) {
      return res.status(503).json({
        message: "Task questions are not configured yet. Ask admin to run schema."
      });
    }

    if (questionError) {
      throw questionError;
    }

    if (!(templateQuestions || []).length) {
      return res.status(400).json({ message: "No questions configured for this task yet." });
    }

    const testPayload = {
      user_id: userId,
      topic: task.topic,
      sub_topics: task.sub_topics || [],
      difficulty: task.difficulty,
      exam_type: task.exam_type || null,
      question_count: task.question_count,
      total_time: task.total_time || null,
      published_test_id: task.id,
      date: new Date().toISOString()
    };

    let { data: createdTest, error: testError } = await supabase.from("tests").insert(testPayload).select("*").single();

    if (isMissingColumnError(testError, "published_test_id")) {
      const { published_test_id: _ignored, ...payloadWithoutPublishedTestId } = testPayload;
      const retry = await supabase.from("tests").insert(payloadWithoutPublishedTestId).select("*").single();
      createdTest = retry.data;
      testError = retry.error;
    }

    if (isMissingColumnError(testError, "sub_topics")) {
      const { sub_topics: _ignored, ...payloadWithoutSubtopics } = testPayload;
      const retry = await supabase.from("tests").insert(payloadWithoutSubtopics).select("*").single();
      createdTest = retry.data;
      testError = retry.error;
    }

    if (testError) {
      throw testError;
    }

    const questionRows = (templateQuestions || []).map((question, index) => ({
      test_id: createdTest.id,
      topic: question.topic || task.topic,
      question: question.question,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      difficulty: question.difficulty || task.difficulty,
      position: index + 1
    }));

    const { error: insertQuestionError } = await supabase.from("questions").insert(questionRows);
    if (insertQuestionError) {
      throw insertQuestionError;
    }

    return res.json({
      message: "Task started.",
      testId: createdTest.id,
      task
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminPublishedTests = async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("published_tests")
      .select("*")
      .order("created_at", { ascending: false });

    if (isMissingTableError(error, "published_tests")) {
      return res.json({ tasks: [] });
    }

    if (error) {
      throw error;
    }

    return res.json({ tasks: data || [] });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminPublishedTest = async (req, res, next) => {
  try {
    const { publishedTestId } = req.params;

    if (!publishedTestId) {
      return res.status(400).json({ message: "publishedTestId is required." });
    }

    const { data, error } = await supabase
      .from("published_tests")
      .delete()
      .eq("id", publishedTestId)
      .select("id")
      .single();

    if (isMissingTableError(error, "published_tests")) {
      return res.status(503).json({ message: "Tasks are not configured yet. Ask admin to run schema." });
    }

    if (error) {
      throw error;
    }

    return res.json({ message: "Task deleted.", id: data?.id || publishedTestId });
  } catch (error) {
    next(error);
  }
};

const createUserNotifications = async (notifications) => {
  if (!notifications.length) {
    return;
  }

  for (const batch of chunk(notifications, 500)) {
    const { error } = await supabase.from("notifications").insert(batch);
    if (isMissingTableError(error, "notifications")) {
      return;
    }
    if (error) {
      throw error;
    }
  }
};

export const createAdminPublishedTest = async (req, res, next) => {
  try {
    const adminUserId = req.headers["x-user-id"] || null;
    const {
      title,
      description = "",
      topic,
      difficulty,
      questionCount = 10,
      totalTime = null,
      examType = null,
      subtopics = [],
      passMark = 60,
      rewardType = "certificate",
      rewardCoins = 0
    } = req.body || {};

    if (!title?.trim()) {
      return res.status(400).json({ message: "title is required." });
    }

    if (!topic?.trim()) {
      return res.status(400).json({ message: "topic is required." });
    }

    if (!difficulty?.trim()) {
      return res.status(400).json({ message: "difficulty is required." });
    }

    const safeQuestionCount = Math.max(1, Math.min(50, Math.floor(Number(questionCount) || 10)));
    const safePass = Math.max(0, Math.min(100, Math.floor(Number(passMark) || 60)));
    const safeCoins = Math.max(0, Math.floor(Number(rewardCoins) || 0));
    const cleanedSubtopics = uniqueSubtopics(subtopics);

    const now = new Date().toISOString();

    const insertPayload = {
      created_by: adminUserId,
      title: title.trim(),
      description: String(description || "").trim() || null,
      topic: topic.trim(),
      sub_topics: cleanedSubtopics,
      difficulty: difficulty.trim(),
      exam_type: examType ? String(examType).trim() : null,
      question_count: safeQuestionCount,
      total_time: totalTime != null ? Math.max(1, Math.floor(Number(totalTime))) : null,
      pass_mark: safePass,
      reward_type: String(rewardType || "certificate").trim(),
      reward_coins: safeCoins,
      status: "published",
      published_at: now,
      created_at: now,
      updated_at: now
    };

    const tryInsert = async (payload) =>
      supabase.from("published_tests").insert(payload).select("*").single();

    let { data: createdTask, error: createError } = await tryInsert(insertPayload);

    if (isMissingColumnError(createError, "exam_type")) {
      const retryPayload = { ...insertPayload };
      delete retryPayload.exam_type;
      ({ data: createdTask, error: createError } = await tryInsert(retryPayload));
    }

    if (isMissingTableError(createError, "published_tests")) {
      return res.status(503).json({ message: "Tasks are not configured yet. Ask admin to run the latest schema." });
    }

    if (createError) {
      throw createError;
    }

    const prompt = `
Generate ${safeQuestionCount} multiple-choice questions for an online test.
Title: ${createdTask.title}
Topic: ${createdTask.topic}
Difficulty: ${createdTask.difficulty}
${cleanedSubtopics.length ? `Subtopics to focus on: ${cleanedSubtopics.join(", ")}` : ""}

Return valid JSON only in this exact shape:
{
  "questions": [
    {
      "question": "string",
      "options": ["option 1", "option 2", "option 3", "option 4"],
      "answer": "string",
      "explanation": "string",
      "difficulty": "${createdTask.difficulty}"
    }
  ]
}
`;

    let parsedQuestions;
    let announcement = null;

    try {
      const { model } = await getGeminiModelForUserId(adminUserId);
      const result = await model.generateContent(prompt);
      const parsed = extractJson(result.response.text());
      parsedQuestions = parsed?.questions || [];
    } catch (assistantError) {
      parsedQuestions = buildFallbackQuestions({
        topic: createdTask.topic,
        difficulty: createdTask.difficulty,
        count: safeQuestionCount
      });

      if (isQuotaError(assistantError)) {
        const { source, hasUserKey } = await getGeminiModelForUserId(adminUserId);
        if (source === "default") {
          announcement = buildQuotaAnnouncement({ hasUserKey });
        }
      } else {
        console.warn("Gemini task question generation failed; using fallback.", assistantError.message);
      }
    }

    const questionRows = (parsedQuestions || []).slice(0, safeQuestionCount).map((question, index) => ({
      published_test_id: createdTask.id,
      question: question.question,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      difficulty: question.difficulty || createdTask.difficulty,
      topic: createdTask.topic,
      position: index + 1
    }));

    const { error: questionInsertError } = await supabase.from("published_test_questions").insert(questionRows);

    if (isMissingTableError(questionInsertError, "published_test_questions")) {
      return res.status(503).json({
        message: "Task question table is not configured yet. Ask admin to run the latest schema."
      });
    }

    if (questionInsertError) {
      throw questionInsertError;
    }

    const { data: activeUsers, error: userError } = await supabase
      .from("users")
      .select("id")
      .neq("role", "admin")
      .eq("is_blocked", false);

    if (userError) {
      throw userError;
    }

    await createUserNotifications(
      (activeUsers || []).map((user) => ({
        user_id: user.id,
        type: "task",
        title: "New Test Available",
        message: `${createdTask.title} is now available in Tasks.`
      }))
    );

    return res.status(201).json({
      message: "Task created and published.",
      task: createdTask,
      announcement
    });
  } catch (error) {
    next(error);
  }
};

