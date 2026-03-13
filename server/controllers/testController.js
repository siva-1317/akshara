import { supabase } from "../config/supabase.js";
import { evaluateTestWithGemini } from "./geminiController.js";
import { geminiModel } from "../config/gemini.js";

const createNotification = async ({ userId = null, type, title, message }) => {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message
  });

  if (isMissingTableError(error, "notifications")) {
    return;
  }

  if (error) {
    throw error;
  }
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

const calculateFallbackEvaluation = (questions, answers, topic) => {
  let correct = 0;

  questions.forEach((question) => {
    const submitted = answers.find((answer) => answer.questionId === question.id);
    if (submitted?.userAnswer === question.answer) {
      correct += 1;
    }
  });

  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  return {
    score,
    weakTopics: score < 70 ? [topic] : [],
    explanation: score < 70 ? "Focus on fundamentals and practice similar questions." : "Strong performance overall."
  };
};

const CONTRIBUTION_TIME_ZONE = "Asia/Kolkata";

const getDatePartsInTimeZone = (date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CONTRIBUTION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });

  return formatter.formatToParts(date).reduce((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});
};

const getDateKeyInTimeZone = (date) => {
  const parts = getDatePartsInTimeZone(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const buildContributionGraph = (tests, days = 126) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (days - 1));

  const countsByDay = tests.reduce((accumulator, test) => {
    const dateKey = getDateKeyInTimeZone(new Date(test.date));
    accumulator[dateKey] = (accumulator[dateKey] || 0) + 1;
    return accumulator;
  }, {});

  const contributions = [];
  let totalContributions = 0;
  let activeDays = 0;
  let maxCount = 0;

  for (let index = 0; index < days; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    const dateKey = getDateKeyInTimeZone(date);
    const count = countsByDay[dateKey] || 0;
    const parts = getDatePartsInTimeZone(date);

    contributions.push({
      date: dateKey,
      count,
      dayLabel: parts.weekday,
      monthLabel: date.toLocaleDateString("en-US", {
        month: "short",
        timeZone: CONTRIBUTION_TIME_ZONE
      }),
      yearLabel: parts.year,
      dayOfMonth: Number(parts.day)
    });

    totalContributions += count;
    if (count > 0) {
      activeDays += 1;
      maxCount = Math.max(maxCount, count);
    }
  }

  return {
    totalContributions,
    activeDays,
    maxCount,
    days: contributions
  };
};

export const createTest = async (req, res, next) => {
  try {
    const { userId, topic, difficulty, questionCount, totalTime, examType, subtopics = [] } = req.body;
    const headerUserId = req.headers["x-user-id"];
    const headerRole = req.headers["x-user-role"];

    if (!userId || !topic || !difficulty || !questionCount || !totalTime || !examType) {
      return res.status(400).json({ message: "Missing required test fields." });
    }

    if (headerUserId && headerRole !== "admin" && headerUserId !== userId) {
      return res.status(403).json({ message: "Unauthorized test creation." });
    }

    const desiredCount = Math.floor(Number(questionCount));
    if (!Number.isFinite(desiredCount) || desiredCount <= 0) {
      return res.status(400).json({ message: "questionCount must be a positive number." });
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("coins")
      .eq("id", userId)
      .single();

    if (userError) {
      throw userError;
    }

    const currentCoins = Number.isFinite(userRow.coins) ? userRow.coins : 0;
    if (currentCoins <= 0) {
      return res.status(403).json({ message: "Not enough coins to attend a test." });
    }

    const allowedCount = Math.min(desiredCount, currentCoins);
    const nextCoins = currentCoins - allowedCount;

    const { error: coinUpdateError } = await supabase
      .from("users")
      .update({ coins: nextCoins })
      .eq("id", userId);

    if (coinUpdateError) {
      throw coinUpdateError;
    }

    const cleanedSubtopics = Array.isArray(subtopics)
      ? [...new Map(
          subtopics
            .map((item) => String(item || "").trim())
            .filter(Boolean)
            .map((item) => [item.toLowerCase(), item])
        ).values()]
      : [];

    const payload = {
      user_id: userId,
      topic,
      difficulty,
      score: 0,
      time: totalTime,
      date: new Date().toISOString(),
      exam_type: examType,
      question_count: allowedCount,
      total_time: totalTime,
      sub_topics: cleanedSubtopics
    };

    let { data, error } = await supabase.from("tests").insert(payload).select().single();

    if (error && String(error.message || "").toLowerCase().includes("sub_topics")) {
      // Backward compatible: allow older schemas without sub_topics column.
      // Persisting subtopics is optional; question generation still uses them.
      const { sub_topics: _ignored, ...payloadWithoutSubtopics } = payload;
      const retry = await supabase.from("tests").insert(payloadWithoutSubtopics).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      throw error;
    }

    return res.status(201).json({
      message: allowedCount < desiredCount
        ? `Test created with ${allowedCount} questions based on your available coins.`
        : "Test created successfully.",
      test: data,
      coins: nextCoins,
      usedCoins: allowedCount
    });
  } catch (error) {
    next(error);
  }
};

export const getHistory = async (req, res, next) => {
  try {
    const { userId } = req.query;
    let query = supabase.from("tests").select("*").order("date", { ascending: false });
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return res.json({ tests: data || [] });
  } catch (error) {
    next(error);
  }
};

export const getDashboard = async (req, res, next) => {
  try {
    const { userId } = req.query;

    const { data: tests, error } = await supabase
      .from("tests")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error) {
      throw error;
    }

    const totalTests = tests.length;
    const averageScore = totalTests
      ? Math.round(tests.reduce((sum, test) => sum + (test.score || 0), 0) / totalTests)
      : 0;
    const weakTopics = [
      ...new Set(tests.filter((test) => (test.score || 0) < 70).map((test) => test.topic))
    ].slice(0, 3);
    const topicScores = tests.reduce((accumulator, test) => {
      if (!accumulator[test.topic]) {
        accumulator[test.topic] = [];
      }
      accumulator[test.topic].push(test.score || 0);
      return accumulator;
    }, {});
    const topicBreakdown = Object.entries(topicScores)
      .map(([topic, scores]) => ({
        topic,
        average: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
      }))
      .sort((first, second) => second.average - first.average);
    const strongestTopic = topicBreakdown[0]?.topic || "Not enough data";
    const recentScores = tests.slice(0, 5).map((test) => test.score || 0).reverse();
    const previousAverage = recentScores.length > 1
      ? Math.round(
          recentScores.slice(0, -1).reduce((sum, score) => sum + score, 0) /
            (recentScores.length - 1)
        )
      : averageScore;
    const improvement = averageScore - previousAverage;
    const completionRate = totalTests ? Math.min(100, 55 + totalTests * 7) : 0;
    const consistency = totalTests
      ? Math.max(
          0,
          100 -
            Math.round(
              Math.sqrt(
                tests.reduce((sum, test) => sum + Math.pow((test.score || 0) - averageScore, 2), 0) /
                  totalTests
              )
            )
        )
      : 0;
    const suggestions = [
      weakTopics[0]
        ? `Retake ${weakTopics[0]} with a medium-difficulty test to close your weakest gap.`
        : "Try a mixed-topic challenge to build broader confidence.",
      improvement >= 0
        ? "Your recent results are improving. Increase difficulty gradually."
        : "Focus on accuracy first, then rebuild speed with timed practice.",
      topicBreakdown[1]
        ? `Your next best revision topic is ${topicBreakdown[1].topic}.`
        : "Keep building history to unlock more targeted recommendations."
    ];
    const contributionGraph = buildContributionGraph(tests);

    return res.json({
      totalTests,
      averageScore,
      weakTopics,
      strongestTopic,
      improvement,
      consistency,
      completionRate,
      topicBreakdown,
      recentScores,
      suggestions,
      contributionGraph,
      suggestedTest: weakTopics[0]
        ? `${weakTopics[0]} practice test`
        : "Try a medium difficulty mixed-topic test",
      history: tests.slice(0, 5)
    });
  } catch (error) {
    next(error);
  }
};

export const getTestById = async (req, res, next) => {
  try {
    const { testId } = req.params;
    const { data: test, error: testError } = await supabase
      .from("tests")
      .select("*")
      .eq("id", testId)
      .single();

    if (testError) {
      throw testError;
    }

    const { data: questions, error: questionError } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", testId)
      .order("position", { ascending: true });

    if (questionError) {
      throw questionError;
    }

    return res.json({
      test: {
        ...test,
        questions
      }
    });
  } catch (error) {
    next(error);
  }
};

export const submitTest = async (req, res, next) => {
  try {
    const { testId, userId, answers = [] } = req.body;

    const { data: test, error: testError } = await supabase
      .from("tests")
      .select("*")
      .eq("id", testId)
      .single();

    if (testError) {
      throw testError;
    }

    const { data: questions, error: questionError } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", testId)
      .order("position", { ascending: true });

    if (questionError) {
      throw questionError;
    }

    let evaluation;
    try {
      evaluation = await evaluateTestWithGemini({ test, questions, answers });
    } catch (geminiError) {
      console.warn("Gemini evaluation failed, using fallback scoring.", geminiError.message);
      evaluation = calculateFallbackEvaluation(questions, answers, test.topic);
    }

    const answerRows = questions.map((question) => {
      const matched = answers.find((answer) => answer.questionId === question.id);
      return {
        test_id: testId,
        question_id: question.id,
        user_id: userId,
        user_answer: matched?.userAnswer || null,
        is_correct: matched?.userAnswer === question.answer
      };
    });

    const { error: answerError } = await supabase.from("answers").upsert(answerRows, {
      onConflict: "test_id,question_id,user_id"
    });

    if (answerError) {
      throw answerError;
    }

    const { data: updatedTest, error: updateError } = await supabase
      .from("tests")
      .update({
        score: evaluation.score,
        weak_topics: evaluation.weakTopics,
        evaluation_explanation: evaluation.explanation
      })
      .eq("id", testId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.json({
      message: "Test submitted successfully.",
      result: {
        score: evaluation.score,
        weakTopics: evaluation.weakTopics,
        explanation: evaluation.explanation,
        test: updatedTest
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getReview = async (req, res, next) => {
  try {
    const { testId } = req.params;

    const { data: test, error: testError } = await supabase
      .from("tests")
      .select("*")
      .eq("id", testId)
      .single();

    if (testError) {
      throw testError;
    }

    const { data: questions, error: questionError } = await supabase
      .from("questions")
      .select("*")
      .eq("test_id", testId)
      .order("position", { ascending: true });

    if (questionError) {
      throw questionError;
    }

    const { data: answerRows, error: answerError } = await supabase
      .from("answers")
      .select("*")
      .eq("test_id", testId);

    if (answerError) {
      throw answerError;
    }

    const reviewQuestions = questions.map((question) => ({
      ...question,
      user_answer: answerRows.find((answer) => answer.question_id === question.id)?.user_answer || null
    }));

    return res.json({
      test,
      questions: reviewQuestions
    });
  } catch (error) {
    next(error);
  }
};

export const suggestTest = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const { data: tests, error } = await supabase
      .from("tests")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error) {
      throw error;
    }

    const lowScoreTest = tests.find((test) => (test.score || 0) < 70);
    const suggestion = lowScoreTest
      ? {
          topic: lowScoreTest.topic,
          difficulty: "medium",
          reason: "You can strengthen a weak topic by retrying a focused practice test."
        }
      : {
          topic: "Mixed Aptitude",
          difficulty: "hard",
          reason: "You are doing well, so a broader challenge is the next best step."
        };

    return res.json({ suggestion });
  } catch (error) {
    next(error);
  }
};

export const getAdminUsers = async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from("users").select("*").order("name");
    if (error) {
      throw error;
    }

    return res.json({ users: data || [] });
  } catch (error) {
    next(error);
  }
};

export const getAdminTests = async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("tests")
      .select("*, users(name,email)")
      .order("date", { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({ tests: data || [] });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminTest = async (req, res, next) => {
  try {
    const { testId } = req.params;

    const { error: answerError } = await supabase.from("answers").delete().eq("test_id", testId);
    if (answerError) {
      throw answerError;
    }

    const { error: questionError } = await supabase.from("questions").delete().eq("test_id", testId);
    if (questionError) {
      throw questionError;
    }

    const { error: testError } = await supabase.from("tests").delete().eq("id", testId);
    if (testError) {
      throw testError;
    }

    return res.json({ message: "Test deleted successfully." });
  } catch (error) {
    next(error);
  }
};

export const getTopics = async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from("topics").select("*").order("name");
    if (error) {
      throw error;
    }

    return res.json({ topics: data || [] });
  } catch (error) {
    next(error);
  }
};

export const addTopic = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Topic name is required." });
    }

    const { data, error } = await supabase.from("topics").insert({ name }).select().single();

    if (error) {
      throw error;
    }

    return res.status(201).json({
      message: "Topic added successfully.",
      topic: data
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminUserPerformance = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userError) {
      throw userError;
    }

    const { data: tests, error: testsError } = await supabase
      .from("tests")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (testsError) {
      throw testsError;
    }

    const totalTests = tests.length;
    const averageScore = totalTests
      ? Math.round(tests.reduce((sum, test) => sum + (test.score || 0), 0) / totalTests)
      : 0;
    const weakestTopics = [
      ...new Set(tests.filter((test) => (test.score || 0) < 70).map((test) => test.topic))
    ].slice(0, 5);

    return res.json({
      user,
      performance: {
        totalTests,
        averageScore,
        weakestTopics,
        recentTests: tests.slice(0, 8)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const blockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ message: "Block reason is required." });
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        is_blocked: true,
        block_reason: reason.trim()
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    await createNotification({
      userId,
      type: "block",
      title: "Account blocked",
      message: `An admin has blocked your access. Reason: ${reason.trim()}`
    });

    return res.json({
      message: "User blocked successfully.",
      user: data
    });
  } catch (error) {
    next(error);
  }
};

export const unblockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { note = "", requestId = null } = req.body;

    const { data, error } = await supabase
      .from("users")
      .update({
        is_blocked: false,
        block_reason: null
      })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (requestId) {
      const { error: requestError } = await supabase
        .from("unblock_requests")
        .update({
          status: "approved",
          admin_note: note || "Request approved"
        })
        .eq("id", requestId);

      if (requestError && !isMissingTableError(requestError, "unblock_requests")) {
        throw requestError;
      }
    }

    await createNotification({
      userId,
      type: "unblock",
      title: "Account unblocked",
      message: note?.trim() || "Your account has been unblocked. You can sign in again."
    });

    return res.json({
      message: "User unblocked successfully.",
      user: data
    });
  } catch (error) {
    next(error);
  }
};

export const createUnblockRequest = async (req, res, next) => {
  try {
    const { userId, reason } = req.body;

    if (!userId || !reason?.trim()) {
      return res.status(400).json({ message: "User ID and reason are required." });
    }

    const { data, error } = await supabase
      .from("unblock_requests")
      .insert({
        user_id: userId,
        reason: reason.trim(),
        status: "pending"
      })
      .select()
      .single();

    if (isMissingTableError(error, "unblock_requests")) {
      return res.status(503).json({
        message:
          "Unblock requests are not configured in the database yet. Please ask the admin to run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    await createNotification({
      type: "unblock-request",
      title: "New unblock request",
      message: `User ${userId} requested account reactivation.`
    });

    return res.status(201).json({
      message: "Unblock request sent successfully.",
      request: data
    });
  } catch (error) {
    next(error);
  }
};

export const getUnblockRequests = async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("unblock_requests")
      .select("*, users(name,email)")
      .order("created_at", { ascending: false });

    if (isMissingTableError(error, "unblock_requests")) {
      return res.json({ requests: [] });
    }

    if (error) {
      throw error;
    }

    return res.json({ requests: data || [] });
  } catch (error) {
    next(error);
  }
};

export const rejectUnblockRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { note = "" } = req.body;

    const { data: requestRow, error: requestError } = await supabase
      .from("unblock_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (isMissingTableError(requestError, "unblock_requests")) {
      return res.status(503).json({ message: "Unblock requests table is not configured yet." });
    }

    if (requestError) {
      throw requestError;
    }

    if (requestRow.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be rejected." });
    }

    const { data: updatedRequest, error } = await supabase
      .from("unblock_requests")
      .update({
        status: "rejected",
        admin_note: note?.trim() || null
      })
      .eq("id", requestId)
      .select("*, users(name,email)")
      .single();

    if (error) {
      throw error;
    }

    await createNotification({
      userId: requestRow.user_id,
      type: "unblock",
      title: "Unblock request rejected",
      message: note?.trim() || "Admin rejected your unblock request."
    });

    await createNotification({
      type: "unblock-request",
      title: "Unblock request rejected",
      message: `${updatedRequest.users?.name || requestRow.user_id} unblock request was rejected.`
    });

    return res.json({ message: "Unblock request rejected.", request: updatedRequest });
  } catch (error) {
    next(error);
  }
};

export const requestCoins = async (req, res, next) => {
  try {
    const headerUserId = req.headers["x-user-id"];
    const { userId, requestedCoins, reason = "" } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    if (headerUserId && headerUserId !== userId) {
      return res.status(403).json({ message: "Unauthorized coin request." });
    }

    const amount = Number(requestedCoins);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "requestedCoins must be a positive number." });
    }

    const { data, error } = await supabase
      .from("coin_requests")
      .insert({
        user_id: userId,
        requested_coins: Math.floor(amount),
        reason: reason?.trim() || null,
        status: "pending"
      })
      .select("*, users(name,email)")
      .single();

    if (isMissingTableError(error, "coin_requests")) {
      return res.status(503).json({
        message:
          "Coin requests are not configured in the database yet. Please ask the admin to run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    await createNotification({
      userId,
      type: "coins",
      title: "Coins request submitted",
      message: `Your request for ${data.requested_coins} coins has been sent to admin for review.`
    });

    await createNotification({
      type: "coins-request",
      title: "New coins request",
      message: `${data.users?.name || userId} requested ${data.requested_coins} coins.`
    });

    return res.status(201).json({
      message: "Coins request submitted.",
      request: data
    });
  } catch (error) {
    next(error);
  }
};

export const getCoinRequests = async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("coin_requests")
      .select("*, users(name,email)")
      .order("created_at", { ascending: false });

    if (isMissingTableError(error, "coin_requests")) {
      return res.json({ requests: [] });
    }

    if (error) {
      throw error;
    }

    return res.json({ requests: data || [] });
  } catch (error) {
    next(error);
  }
};

export const approveCoinRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { coinsGranted = null, note = "" } = req.body;

    const { data: requestRow, error: requestError } = await supabase
      .from("coin_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (isMissingTableError(requestError, "coin_requests")) {
      return res.status(503).json({ message: "Coin requests table is not configured yet." });
    }

    if (requestError) {
      throw requestError;
    }

    if (requestRow.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be approved." });
    }

    const amount = coinsGranted == null ? requestRow.requested_coins : Number(coinsGranted);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "coinsGranted must be a positive number." });
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("coins")
      .eq("id", requestRow.user_id)
      .single();

    if (userError) {
      throw userError;
    }

    const nextCoins = (userRow.coins || 0) + Math.floor(amount);

    const { error: updateUserError } = await supabase
      .from("users")
      .update({ coins: nextCoins })
      .eq("id", requestRow.user_id);

    if (updateUserError) {
      throw updateUserError;
    }

    const { data: updatedRequest, error: updateRequestError } = await supabase
      .from("coin_requests")
      .update({
        status: "approved",
        admin_note: note?.trim() || null,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", requestId)
      .select("*, users(name,email)")
      .single();

    if (updateRequestError) {
      throw updateRequestError;
    }

    await createNotification({
      userId: requestRow.user_id,
      type: "coins",
      title: "Coins request approved",
      message: `Admin approved ${Math.floor(amount)} coins. Your new balance is ${nextCoins}.`
    });

    await createNotification({
      type: "coins",
      title: "Coins granted",
      message: `${updatedRequest.users?.name || requestRow.user_id} received ${Math.floor(amount)} coins.`
    });

    return res.json({
      message: "Coins request approved.",
      request: updatedRequest,
      coins: nextCoins
    });
  } catch (error) {
    next(error);
  }
};

export const rejectCoinRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { note = "" } = req.body;

    const { data: requestRow, error: requestError } = await supabase
      .from("coin_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (isMissingTableError(requestError, "coin_requests")) {
      return res.status(503).json({ message: "Coin requests table is not configured yet." });
    }

    if (requestError) {
      throw requestError;
    }

    if (requestRow.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be rejected." });
    }

    const { data: updatedRequest, error } = await supabase
      .from("coin_requests")
      .update({
        status: "rejected",
        admin_note: note?.trim() || null,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", requestId)
      .select("*, users(name,email)")
      .single();

    if (error) {
      throw error;
    }

    await createNotification({
      userId: requestRow.user_id,
      type: "coins",
      title: "Coins request rejected",
      message: note?.trim() || "Admin rejected your coins request."
    });

    return res.json({
      message: "Coins request rejected.",
      request: updatedRequest
    });
  } catch (error) {
    next(error);
  }
};

export const grantCoinsToUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { coins } = req.body;

    const amount = Number(coins);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "coins must be a positive number." });
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("coins")
      .eq("id", userId)
      .single();

    if (userError) {
      throw userError;
    }

    const nextCoins = (userRow.coins || 0) + Math.floor(amount);

    const { data: updatedUser, error } = await supabase
      .from("users")
      .update({ coins: nextCoins })
      .eq("id", userId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await createNotification({
      userId,
      type: "coins",
      title: "Coins added",
      message: `Admin added ${Math.floor(amount)} coins. Your new balance is ${nextCoins}.`
    });

    return res.json({
      message: "Coins granted successfully.",
      user: updatedUser,
      coins: nextCoins
    });
  } catch (error) {
    next(error);
  }
};

export const getNotifications = async (req, res, next) => {
  try {
    const role = req.headers["x-user-role"];
    const userId = req.headers["x-user-id"];

    let query = supabase.from("notifications").select("*").order("created_at", { ascending: false });
    query = role === "admin" ? query.is("user_id", null) : query.eq("user_id", userId);

    const { data, error } = await query;

    if (isMissingTableError(error, "notifications")) {
      return res.json({ notifications: [] });
    }

    if (error) {
      throw error;
    }

    return res.json({ notifications: data || [] });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (isMissingTableError(error, "notifications")) {
      return res.json({ message: "Notifications table is not configured yet." });
    }

    if (error) {
      throw error;
    }

    return res.json({ message: "Notification marked as read." });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const role = req.headers["x-user-role"];
    const userId = req.headers["x-user-id"];

    let query = supabase.from("notifications").update({ is_read: true });
    query = role === "admin" ? query.is("user_id", null) : query.eq("user_id", userId);

    const { error } = await query;

    if (isMissingTableError(error, "notifications")) {
      return res.json({ message: "Notifications table is not configured yet." });
    }

    if (error) {
      throw error;
    }

    return res.json({ message: "All notifications marked as read." });
  } catch (error) {
    next(error);
  }
};

export const clearNotifications = async (req, res, next) => {
  try {
    const role = req.headers["x-user-role"];
    const userId = req.headers["x-user-id"];

    let query = supabase.from("notifications").delete();
    query = role === "admin" ? query.is("user_id", null) : query.eq("user_id", userId);

    const { error } = await query;

    if (isMissingTableError(error, "notifications")) {
      return res.json({ message: "Notifications table is not configured yet." });
    }

    if (error) {
      throw error;
    }

    return res.json({ message: "Notifications cleared successfully." });
  } catch (error) {
    next(error);
  }
};

export const submitFeedback = async (req, res, next) => {
  try {
    const { userId, category, message } = req.body;

    if (!userId || !category || !message?.trim()) {
      return res.status(400).json({ message: "Feedback category and message are required." });
    }

    const { data, error } = await supabase
      .from("feedback")
      .insert({
        user_id: userId,
        category,
        message: message.trim()
      })
      .select()
      .single();

    if (isMissingTableError(error, "feedback")) {
      return res.status(503).json({
        message:
          "Feedback is not configured in the database yet. Please ask the admin to run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    await createNotification({
      type: "feedback",
      title: "New user feedback",
      message: `A user submitted ${category} feedback.`
    });

    return res.status(201).json({
      message: "Feedback submitted successfully.",
      feedback: data
    });
  } catch (error) {
    next(error);
  }
};

export const askAppAssistant = async (req, res, next) => {
  try {
    const { question } = req.body;

    if (!question?.trim()) {
      return res.status(400).json({ message: "Question is required." });
    }

    let answer;
    try {
      const prompt = `You are the in-app help assistant for AKSHARA, an AI test portal. Answer the user's question briefly and clearly. User question: ${question}`;
      const result = await geminiModel.generateContent(prompt);
      answer = result.response.text().trim();
    } catch (assistantError) {
      console.warn("Gemini assistant fallback triggered.", assistantError.message);
      answer =
        "You can create tests from the Create Test page, review scores in the dashboard, check old attempts in History, and contact admin through feedback or unblock request forms if needed.";
    }

    return res.json({ answer });
  } catch (error) {
    next(error);
  }
};
