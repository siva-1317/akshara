import { supabase } from "../config/supabase.js";
import { evaluateTestWithGemini } from "./geminiController.js";
import { buildQuotaAnnouncement, getGeminiModelForUserId, isQuotaError } from "../utils/geminiClient.js";

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

const isMissingColumnError = (error, columnName) => {
  if (!error) {
    return false;
  }

  const message = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  const target = String(columnName || "").toLowerCase();

  return (
    message.includes(`column`) &&
    (message.includes(`does not exist`) || details.includes(`does not exist`)) &&
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

const getActiveOfferForUserId = async (userId) => {
  if (!userId) {
    return null;
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (isMissingTableError(error, "offers")) {
    return null;
  }

  if (error) {
    throw error;
  }

  return (data || [])[0] || null;
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

const extractJson = (text) => {
  const cleaned = String(text || "").replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
};

const normalizeRewardType = (value) => String(value || "").trim().toLowerCase();

const shouldIssueCertificate = (rewardType) => ["certificate", "both"].includes(normalizeRewardType(rewardType));
const shouldAwardCoins = (rewardType) => ["coins", "both"].includes(normalizeRewardType(rewardType));

const generateCertificateData = async ({ userName, publishedTest, score, issuedAtIso, requesterUserId }) => {
  const fallback = {
    recipientName: String(userName || "Learner").trim() || "Learner",
    title: "Certificate of Completion",
    body: `This certifies that ${String(userName || "Learner").trim() || "Learner"} has successfully completed "${
      publishedTest?.title || publishedTest?.topic || "AKSHARA Test"
    }" on AKSHARA.`,
    issuer: "AKSHARA",
    score,
    issuedAt: issuedAtIso,
    testTitle: publishedTest?.title || publishedTest?.topic || "AKSHARA Test"
  };

  try {
    const prompt = `
Create a short certificate content for an online test portal.

Recipient name: ${fallback.recipientName}
Test title: ${fallback.testTitle}
Topic: ${publishedTest?.topic || ""}
Score (percentage): ${score}
Issued at (ISO): ${issuedAtIso}
Issuer: AKSHARA

Return valid JSON only in this exact shape:
{
  "title": "string",
  "body": "string",
  "recipientName": "string",
  "issuer": "string"
}
`;
    const { model } = await getGeminiModelForUserId(requesterUserId);
    const result = await model.generateContent(prompt);
    const parsed = extractJson(result.response.text());
    const merged = {
      ...fallback,
      title: String(parsed?.title || fallback.title).trim() || fallback.title,
      body: String(parsed?.body || fallback.body).trim() || fallback.body,
      recipientName: String(parsed?.recipientName || fallback.recipientName).trim() || fallback.recipientName,
      issuer: String(parsed?.issuer || fallback.issuer).trim() || fallback.issuer
    };
    return merged;
  } catch (error) {
    console.warn("Certificate generation failed; using fallback.", error.message);
    return fallback;
  }
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
    if (!(await requireApprovedUser(req, res))) {
      return;
    }

    const {
      userId,
      topic,
      difficulty,
      questionCount,
      totalTime,
      examType,
      subtopics = [],
      paymentMode = null
    } = req.body;
    const headerUserId = req.headers["x-user-id"];
    const headerRole = req.headers["x-user-role"];

    if (headerUserId && headerRole !== "admin" && headerUserId !== userId) {
      return res.status(403).json({ message: "Unauthorized test creation." });
    }

    const mode = String(paymentMode || "").trim().toLowerCase();
    const wantsOffer = mode === "offer";
    const wantsCoins = mode === "coins" || !mode;
    if (!wantsOffer && !wantsCoins) {
      return res.status(400).json({ message: "paymentMode must be 'offer' or 'coins'." });
    }

    const activeOffer = wantsOffer ? await getActiveOfferForUserId(userId) : null;
    if (wantsOffer && !activeOffer) {
      return res.status(403).json({ message: "No active offer available for this user." });
    }

    const effectiveDifficulty = activeOffer?.fixed_difficulty || difficulty;
    const effectiveExamType = activeOffer?.fixed_exam_type || examType;

    const effectiveQuestionCountRaw =
      activeOffer?.fixed_question_count != null ? activeOffer.fixed_question_count : questionCount;

    if (!userId || !topic || !effectiveDifficulty || !effectiveQuestionCountRaw || !totalTime || !effectiveExamType) {
      return res.status(400).json({ message: "Missing required test fields." });
    }

    const desiredCount = Math.floor(Number(effectiveQuestionCountRaw));
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
    if (!activeOffer && currentCoins <= 0) {
      return res.status(403).json({ message: "Not enough coins to attend a test." });
    }

    const allowedCount = activeOffer ? desiredCount : Math.min(desiredCount, currentCoins);
    const nextCoins = activeOffer ? currentCoins : currentCoins - allowedCount;

    if (!activeOffer) {
      const { error: coinUpdateError } = await supabase
        .from("users")
        .update({ coins: nextCoins })
        .eq("id", userId);

      if (coinUpdateError) {
        throw coinUpdateError;
      }
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
      difficulty: effectiveDifficulty,
      score: 0,
      time: totalTime,
      date: new Date().toISOString(),
      exam_type: effectiveExamType,
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
      message: activeOffer
        ? "Offer active: test created without using coins."
        : allowedCount < desiredCount
        ? `Test created with ${allowedCount} questions based on your available coins.`
        : "Test created successfully.",
      test: data,
      coins: nextCoins,
      usedCoins: activeOffer ? 0 : allowedCount
    });
  } catch (error) {
    next(error);
  }
};

export const getHistory = async (req, res, next) => {
  try {
    if (!(await requireApprovedUser(req, res))) {
      return;
    }

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
    if (!(await requireApprovedUser(req, res))) {
      return;
    }

    const { userId } = req.query;
    const serverTime = new Date().toISOString();
    const activeOffer = await getActiveOfferForUserId(userId);

    const offerPayload = activeOffer
      ? {
          id: activeOffer.id,
          type: activeOffer.offer_type,
          startsAt: activeOffer.starts_at,
          endsAt: activeOffer.ends_at || null,
          fixedQuestionCount: activeOffer.fixed_question_count ?? null,
          fixedDifficulty: activeOffer.fixed_difficulty ?? null,
          fixedExamType: activeOffer.fixed_exam_type ?? null,
          status: activeOffer.status,
          serverTime
        }
      : null;

    const { data: onboardingRow, error: onboardingError } = await supabase
      .from("user_onboarding")
      .select("ai_result")
      .eq("user_id", userId)
      .maybeSingle();

    const personalization = onboardingError ? null : onboardingRow?.ai_result || null;

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

    const onboardingSuggestions =
      !totalTests && personalization
        ? [
            ...(Array.isArray(personalization?.suggestedTests) ? personalization.suggestedTests : []),
            ...(Array.isArray(personalization?.learningFocus) ? personalization.learningFocus : [])
          ].filter(Boolean).slice(0, 3)
        : [];

    const contributionGraph = buildContributionGraph(tests);

    return res.json({
      totalTests,
      averageScore,
      weakTopics: totalTests
        ? weakTopics
        : Array.isArray(personalization?.weakAreas)
          ? personalization.weakAreas.slice(0, 3)
          : weakTopics,
      strongestTopic,
      improvement,
      consistency,
      completionRate,
      topicBreakdown,
      recentScores,
      suggestions: onboardingSuggestions.length ? onboardingSuggestions : suggestions,
      contributionGraph,
      personalization,
      offer: offerPayload,
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
    const requesterUserId = req.headers["x-user-id"] || userId;

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
      const { model } = await getGeminiModelForUserId(requesterUserId);
      evaluation = await evaluateTestWithGemini({ test, questions, answers, model });
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

    let taskCompletion = null;
    if (updatedTest?.published_test_id) {
      const { data: publishedTest, error: publishedTestError } = await supabase
        .from("published_tests")
        .select("*")
        .eq("id", updatedTest.published_test_id)
        .maybeSingle();

      if (!isMissingTableError(publishedTestError, "published_tests")) {
        if (publishedTestError) {
          throw publishedTestError;
        }

        if (publishedTest) {
          const passMark = Number.isFinite(Number(publishedTest.pass_mark)) ? Number(publishedTest.pass_mark) : 60;
          const passed = Number(evaluation.score || 0) >= passMark;

          if (passed) {
            const { data: existingCompletion, error: completionError } = await supabase
              .from("task_completions")
              .select("*")
              .eq("user_id", userId)
              .eq("published_test_id", publishedTest.id)
              .maybeSingle();

            if (!isMissingTableError(completionError, "task_completions")) {
              if (completionError) {
                throw completionError;
              }

              if (existingCompletion) {
                taskCompletion = existingCompletion;
              } else {
                let certificateId = null;
                let coinsAwarded = 0;

                const rewardType = publishedTest.reward_type || "certificate";

                if (shouldAwardCoins(rewardType)) {
                  const rewardCoins = Math.max(0, Math.floor(Number(publishedTest.reward_coins) || 0));
                  if (rewardCoins > 0) {
                    const { data: coinUser, error: coinUserError } = await supabase
                      .from("users")
                      .select("coins")
                      .eq("id", userId)
                      .single();

                    if (coinUserError) {
                      throw coinUserError;
                    }

                    const nextCoins = (Number.isFinite(coinUser?.coins) ? coinUser.coins : 0) + rewardCoins;
                    const { error: updateCoinError } = await supabase
                      .from("users")
                      .update({ coins: nextCoins })
                      .eq("id", userId);

                    if (updateCoinError) {
                      throw updateCoinError;
                    }

                    coinsAwarded = rewardCoins;
                  }
                }

                if (shouldIssueCertificate(rewardType)) {
                  const { data: userRow, error: userRowError } = await supabase
                    .from("users")
                    .select("name")
                    .eq("id", userId)
                    .maybeSingle();

                  if (userRowError) {
                    throw userRowError;
                  }

                  const issuedAtIso = new Date().toISOString();
                  const certificateData = await generateCertificateData({
                    userName: userRow?.name || "Learner",
                    publishedTest,
                    score: evaluation.score,
                    issuedAtIso,
                    requesterUserId
                  });

                  const { data: existingCert, error: existingCertError } = await supabase
                    .from("certificates")
                    .select("id")
                    .eq("user_id", userId)
                    .eq("published_test_id", publishedTest.id)
                    .maybeSingle();

                  if (!isMissingTableError(existingCertError, "certificates")) {
                    if (existingCertError) {
                      throw existingCertError;
                    }

                    if (existingCert?.id) {
                      certificateId = existingCert.id;
                    } else {
                      const { data: createdCert, error: certCreateError } = await supabase
                        .from("certificates")
                        .insert({
                          user_id: userId,
                          published_test_id: publishedTest.id,
                          test_id: testId,
                          certificate_data: certificateData,
                          issued_at: issuedAtIso
                        })
                        .select("id")
                        .single();

                      if (isMissingTableError(certCreateError, "certificates")) {
                        // Ignore if schema isn't applied yet.
                      } else if (certCreateError) {
                        throw certCreateError;
                      } else {
                        certificateId = createdCert?.id || null;
                      }
                    }
                  }
                }

                const { data: createdCompletion, error: createCompletionError } = await supabase
                  .from("task_completions")
                  .insert({
                    user_id: userId,
                    published_test_id: publishedTest.id,
                    test_id: testId,
                    score: evaluation.score,
                    coins_awarded: coinsAwarded,
                    certificate_id: certificateId,
                    completed_at: new Date().toISOString()
                  })
                  .select("*")
                  .single();

                if (isMissingTableError(createCompletionError, "task_completions")) {
                  // Ignore if schema isn't applied yet.
                } else if (createCompletionError) {
                  throw createCompletionError;
                } else {
                  taskCompletion = createdCompletion;
                }

                await createNotification({
                  userId,
                  type: "task",
                  title: "Task completed",
                  message: `You passed "${publishedTest.title}" with ${evaluation.score}%.`
                });
              }
            }
          }
        }
      }
    }

    return res.json({
      message: "Test submitted successfully.",
      result: {
        score: evaluation.score,
        weakTopics: evaluation.weakTopics,
        explanation: evaluation.explanation,
        test: updatedTest,
        taskCompletion
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

export const approveAdminUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "User id is required." });
    }

    const { data, error } = await supabase
      .from("users")
      .update({ approval_status: "approved" })
      .eq("id", userId)
      .select("*")
      .single();

    if (isMissingColumnError(error, "approval_status")) {
      return res.status(503).json({
        message: "User approval is not configured yet. Ask admin to run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    await createNotification({
      userId,
      type: "approval",
      title: "Account approved",
      message: "Your AKSHARA account has been approved. You can now access the dashboard."
    });

    return res.json({ message: "User approved.", user: data });
  } catch (error) {
    next(error);
  }
};

export const rejectAdminUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "User id is required." });
    }

    const { data, error } = await supabase
      .from("users")
      .update({ approval_status: "rejected" })
      .eq("id", userId)
      .select("*")
      .single();

    if (isMissingColumnError(error, "approval_status")) {
      return res.status(503).json({
        message: "User approval is not configured yet. Ask admin to run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    await createNotification({
      userId,
      type: "approval",
      title: "Account rejected",
      message: "Your AKSHARA access request was rejected. Contact admin for details."
    });

    return res.json({ message: "User rejected.", user: data });
  } catch (error) {
    next(error);
  }
};


export const deleteAdminUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User id is required." });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, role, email, name")
      .eq("id", userId)
      .single();

    if (userError) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user?.role === "admin") {
      return res.status(400).json({ message: "Cannot delete admin users." });
    }

    const safeDelete = async (table, column) => {
      const { error } = await supabase.from(table).delete().eq(column, userId);
      if (isMissingTableError(error, table)) {
        return;
      }
      if (error) {
        throw error;
      }
    };

    await safeDelete("answers", "user_id");
    await safeDelete("tests", "user_id");
    await safeDelete("user_onboarding", "user_id");
    await safeDelete("unblock_requests", "user_id");
    await safeDelete("coin_requests", "user_id");
    await safeDelete("notifications", "user_id");
    await safeDelete("offers", "user_id");
    await safeDelete("feedback", "user_id");
    await safeDelete("certificates", "user_id");
    await safeDelete("task_completions", "user_id");

    const { data, error } = await supabase.from("users").delete().eq("id", userId).select("id");

    if (error) {
      throw error;
    }

    return res.json({ message: "User deleted.", id: (data || [])[0]?.id || userId });
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

export const revokeCoinsFromUser = async (req, res, next) => {
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

    const currentCoins = Number.isFinite(userRow.coins) ? userRow.coins : 0;
    const nextCoins = Math.max(0, currentCoins - Math.floor(amount));
    const revoked = Math.min(currentCoins, Math.floor(amount));

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
      title: "Coins revoked",
      message: `Admin revoked ${revoked} coins. Your new balance is ${nextCoins}.`
    });

    return res.json({
      message: "Coins revoked successfully.",
      user: updatedUser,
      coins: nextCoins,
      revoked
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminOffers = async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("offers")
      .select("*, submitter:users!offers_user_id_fkey(name,email)")
      .order("created_at", { ascending: false });

    if (isMissingTableError(error, "offers")) {
      return res.json({ offers: [] });
    }

    if (error) {
      throw error;
    }

    return res.json({ offers: data || [] });
  } catch (error) {
    next(error);
  }
};

export const createAdminOffers = async (req, res, next) => {
  try {
    const adminUserId = req.headers["x-user-id"] || null;
    const {
      userIds = [],
      offerType,
      endsAt = null,
      days = null,
      fixedQuestionCount = null,
      fixedDifficulty = null,
      fixedExamType = null
    } = req.body || {};

    const cleanedUserIds = Array.isArray(userIds) ? [...new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean))] : [];
    if (!cleanedUserIds.length) {
      return res.status(400).json({ message: "userIds is required." });
    }

    const type = String(offerType || "").trim().toLowerCase();
    const now = new Date();
    const nowIso = now.toISOString();

    let computedEndsAt = null;

    if (type === "time") {
      const parsed = new Date(String(endsAt || ""));
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Valid endsAt is required for time based offers." });
      }
      if (parsed.getTime() <= now.getTime()) {
        return res.status(400).json({ message: "endsAt must be in the future." });
      }
      computedEndsAt = parsed.toISOString();
    } else if (type === "days") {
      const dayCount = Number(days);
      if (!Number.isFinite(dayCount) || dayCount <= 0) {
        return res.status(400).json({ message: "days must be a positive number for days based offers." });
      }
      const end = new Date(now);
      end.setDate(end.getDate() + Math.floor(dayCount));
      computedEndsAt = end.toISOString();
    } else if (type === "lifetime") {
      computedEndsAt = null;
    } else {
      return res.status(400).json({ message: "offerType must be one of: time, days, lifetime." });
    }

    const allowedDifficulties = new Set(["easy", "medium", "hard"]);
    const allowedExamTypes = new Set(["no return", "return allowed", "per question timer", "total timer"]);

    const fixedQuestionCountValue =
      fixedQuestionCount == null || fixedQuestionCount === ""
        ? null
        : Math.floor(Number(fixedQuestionCount));

    if (fixedQuestionCountValue != null) {
      if (!Number.isFinite(fixedQuestionCountValue) || fixedQuestionCountValue <= 0) {
        return res.status(400).json({ message: "fixedQuestionCount must be a positive number." });
      }
    }

    const fixedDifficultyValue =
      fixedDifficulty == null || String(fixedDifficulty).trim() === "" ? null : String(fixedDifficulty).trim().toLowerCase();

    if (fixedDifficultyValue != null && !allowedDifficulties.has(fixedDifficultyValue)) {
      return res.status(400).json({ message: "fixedDifficulty must be one of: easy, medium, hard." });
    }

    const fixedExamTypeValue =
      fixedExamType == null || String(fixedExamType).trim() === "" ? null : String(fixedExamType).trim().toLowerCase();

    if (fixedExamTypeValue != null && !allowedExamTypes.has(fixedExamTypeValue)) {
      return res.status(400).json({
        message: "fixedExamType must be one of: no return, return allowed, per question timer, total timer."
      });
    }

    const cancelPayload = {
      status: "cancelled",
      cancelled_at: nowIso,
      ends_at: nowIso
    };

    const cancelQuery = supabase
      .from("offers")
      .update(cancelPayload)
      .in("user_id", cleanedUserIds)
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

    const { error: cancelError } = await cancelQuery;

    if (isMissingTableError(cancelError, "offers")) {
      return res.status(503).json({
        message: "Offers table is not configured yet. Please run the latest schema."
      });
    }

    if (cancelError) {
      throw cancelError;
    }

    const rows = cleanedUserIds.map((userId) => ({
      user_id: userId,
      offer_type: type,
      starts_at: nowIso,
      ends_at: computedEndsAt,
      fixed_question_count: fixedQuestionCountValue,
      fixed_difficulty: fixedDifficultyValue,
      fixed_exam_type: fixedExamTypeValue,
      status: "active",
      created_by: adminUserId
    }));

    const { data, error } = await supabase
      .from("offers")
      .insert(rows)
      .select("*, submitter:users!offers_user_id_fkey(name,email)");

    if (isMissingTableError(error, "offers")) {
      return res.status(503).json({
        message: "Offers table is not configured yet. Please run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    return res.status(201).json({
      message: "Offer created successfully.",
      offers: data || []
    });
  } catch (error) {
    next(error);
  }
};

export const cancelAdminOffers = async (req, res, next) => {
  try {
    const { userIds = [] } = req.body || {};

    const cleanedUserIds = Array.isArray(userIds) ? [...new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean))] : [];
    if (!cleanedUserIds.length) {
      return res.status(400).json({ message: "userIds is required." });
    }

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("offers")
      .update({
        status: "cancelled",
        cancelled_at: nowIso,
        ends_at: nowIso
      })
      .in("user_id", cleanedUserIds)
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .select("id");

    if (isMissingTableError(error, "offers")) {
      return res.status(503).json({
        message: "Offers table is not configured yet. Please run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    return res.json({
      message: `Cancelled ${(data || []).length} offer(s).`,
      cancelledCount: (data || []).length
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminOffer = async (req, res, next) => {
  try {
    const { offerId } = req.params;
    const { endsAt = undefined, fixedQuestionCount = undefined, fixedDifficulty = undefined, fixedExamType = undefined } =
      req.body || {};

    const { data: existing, error: fetchError } = await supabase
      .from("offers")
      .select("*")
      .eq("id", offerId)
      .single();

    if (isMissingTableError(fetchError, "offers")) {
      return res.status(503).json({
        message: "Offers table is not configured yet. Please run the latest schema."
      });
    }

    if (fetchError) {
      throw fetchError;
    }

    const allowedDifficulties = new Set(["easy", "medium", "hard"]);
    const allowedExamTypes = new Set(["no return", "return allowed", "per question timer", "total timer"]);

    const updatePayload = {};

    if (fixedQuestionCount !== undefined) {
      if (fixedQuestionCount == null || fixedQuestionCount === "") {
        updatePayload.fixed_question_count = null;
      } else {
        const parsed = Math.floor(Number(fixedQuestionCount));
        if (!Number.isFinite(parsed) || parsed <= 0) {
          return res.status(400).json({ message: "fixedQuestionCount must be a positive number." });
        }
        updatePayload.fixed_question_count = parsed;
      }
    }

    if (fixedDifficulty !== undefined) {
      if (fixedDifficulty == null || String(fixedDifficulty).trim() === "") {
        updatePayload.fixed_difficulty = null;
      } else {
        const parsed = String(fixedDifficulty).trim().toLowerCase();
        if (!allowedDifficulties.has(parsed)) {
          return res.status(400).json({ message: "fixedDifficulty must be one of: easy, medium, hard." });
        }
        updatePayload.fixed_difficulty = parsed;
      }
    }

    if (fixedExamType !== undefined) {
      if (fixedExamType == null || String(fixedExamType).trim() === "") {
        updatePayload.fixed_exam_type = null;
      } else {
        const parsed = String(fixedExamType).trim().toLowerCase();
        if (!allowedExamTypes.has(parsed)) {
          return res.status(400).json({
            message: "fixedExamType must be one of: no return, return allowed, per question timer, total timer."
          });
        }
        updatePayload.fixed_exam_type = parsed;
      }
    }

    if (endsAt !== undefined) {
      if (endsAt == null || String(endsAt).trim() === "") {
        if (String(existing.offer_type || "").toLowerCase() !== "lifetime") {
          return res.status(400).json({ message: "Only lifetime offers can have endsAt cleared." });
        }
        updatePayload.ends_at = null;
      } else {
        const parsed = new Date(String(endsAt));
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ message: "Valid endsAt is required." });
        }
        const now = new Date();
        if (parsed.getTime() <= now.getTime()) {
          return res.status(400).json({ message: "endsAt must be in the future." });
        }
        updatePayload.ends_at = parsed.toISOString();
      }
    }

    if (!Object.keys(updatePayload).length) {
      return res.json({ message: "No changes.", offer: existing });
    }

    const { data, error } = await supabase
      .from("offers")
      .update(updatePayload)
      .eq("id", offerId)
      .select("*, submitter:users!offers_user_id_fkey(name,email)")
      .single();

    if (error) {
      throw error;
    }

    return res.json({ message: "Offer updated.", offer: data });
  } catch (error) {
    next(error);
  }
};

export const getAdminOfferTemplates = async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("offer_templates")
      .select("*")
      .order("updated_at", { ascending: false });

    if (isMissingTableError(error, "offer_templates")) {
      return res.json({ templates: [] });
    }

    if (error) {
      throw error;
    }

    return res.json({ templates: data || [] });
  } catch (error) {
    next(error);
  }
};

export const getAdminAnalytics = async (_req, res, next) => {
  try {
    const answersTotalQuery = supabase.from("answers").select("id", { count: "exact", head: true });
    const answersCorrectQuery = supabase
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("is_correct", true);

    const passMark = 60;

    const testsTotalQuery = supabase.from("tests").select("id", { count: "exact", head: true });
    const testsPassedQuery = supabase
      .from("tests")
      .select("id", { count: "exact", head: true })
      .gte("score", passMark);
    const testsEasyQuery = supabase
      .from("tests")
      .select("id", { count: "exact", head: true })
      .eq("difficulty", "easy");
    const testsMediumQuery = supabase
      .from("tests")
      .select("id", { count: "exact", head: true })
      .eq("difficulty", "medium");
    const testsHardQuery = supabase
      .from("tests")
      .select("id", { count: "exact", head: true })
      .eq("difficulty", "hard");

    const fetchAllUsers = async (selectColumns) => {
      const pageSize = 1000;
      const maxRows = 50000;
      const rows = [];

      for (let from = 0; from < maxRows; from += pageSize) {
        const { data, error } = await supabase
          .from("users")
          .select(selectColumns)
          .range(from, from + pageSize - 1);

        if (isMissingTableError(error, "users")) {
          return { rows: [], usersTableMissing: true, createdAtMissing: false };
        }

        if (isMissingColumnError(error, "created_at")) {
          return { rows: null, usersTableMissing: false, createdAtMissing: true };
        }

        if (error) {
          throw error;
        }

        const batch = data || [];
        rows.push(...batch);

        if (batch.length < pageSize) {
          break;
        }
      }

      return { rows, usersTableMissing: false, createdAtMissing: false };
    };

    const [answersTotalRes, answersCorrectRes, testsTotalRes, testsPassedRes, testsEasyRes, testsMediumRes, testsHardRes] =
      await Promise.all([
      answersTotalQuery,
      answersCorrectQuery,
      testsTotalQuery,
      testsPassedQuery,
      testsEasyQuery,
      testsMediumQuery,
      testsHardQuery
    ]);

    const answersTableMissing = isMissingTableError(answersTotalRes.error, "answers")
      || isMissingTableError(answersCorrectRes.error, "answers");

    const testsTableMissing = isMissingTableError(testsTotalRes.error, "tests")
      || isMissingTableError(testsPassedRes.error, "tests")
      || isMissingTableError(testsEasyRes.error, "tests")
      || isMissingTableError(testsMediumRes.error, "tests")
      || isMissingTableError(testsHardRes.error, "tests");

    if (!answersTableMissing) {
      if (answersTotalRes.error) {
        throw answersTotalRes.error;
      }
      if (answersCorrectRes.error) {
        throw answersCorrectRes.error;
      }
    }

    if (!testsTableMissing) {
      if (testsTotalRes.error) {
        throw testsTotalRes.error;
      }
      if (testsPassedRes.error) {
        throw testsPassedRes.error;
      }
      if (testsEasyRes.error) {
        throw testsEasyRes.error;
      }
      if (testsMediumRes.error) {
        throw testsMediumRes.error;
      }
      if (testsHardRes.error) {
        throw testsHardRes.error;
      }
    }

    const primaryUsers = await fetchAllUsers("id, role, profession, is_blocked, created_at");
    let usersTableMissing = primaryUsers.usersTableMissing;
    let createdAtMissing = primaryUsers.createdAtMissing;
    let users = primaryUsers.rows || [];

    if (!usersTableMissing && createdAtMissing) {
      const fallbackUsers = await fetchAllUsers("id, role, profession, is_blocked");
      usersTableMissing = fallbackUsers.usersTableMissing;
      users = fallbackUsers.rows || [];
    }

    const usersByProfession = users.reduce((accumulator, user) => {
      const key = String(user.profession || "unknown").trim().toLowerCase() || "unknown";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    const totalUsers = users.length;
    const blockedUsers = users.filter((user) => user.is_blocked).length;
    const roleCounts = users.reduce((accumulator, user) => {
      const role = String(user.role || "user").trim().toLowerCase() || "user";
      accumulator[role] = (accumulator[role] || 0) + 1;
      return accumulator;
    }, {});

    const answersTotal = answersTableMissing ? null : answersTotalRes.count ?? 0;
    const answersCorrect = answersTableMissing ? null : answersCorrectRes.count ?? 0;

    const testsTotal = testsTableMissing ? null : testsTotalRes.count ?? 0;
    const testsPassed = testsTableMissing ? null : testsPassedRes.count ?? 0;
    const testsByDifficulty = testsTableMissing
      ? null
      : {
          easy: testsEasyRes.count ?? 0,
          medium: testsMediumRes.count ?? 0,
          hard: testsHardRes.count ?? 0
        };

    if (testsByDifficulty && testsTotal != null) {
      const known = Object.values(testsByDifficulty).reduce((sum, value) => sum + (Number(value) || 0), 0);
      const other = Math.max(0, (Number(testsTotal) || 0) - known);
      testsByDifficulty.other = other;
    }

    const accuracyPercent =
      answersTotal != null && answersTotal > 0 && answersCorrect != null
        ? Math.round((answersCorrect / answersTotal) * 100)
        : null;

    const testsPassRatePercent =
      testsTotal != null && testsTotal > 0 && testsPassed != null ? Math.round((testsPassed / testsTotal) * 100) : null;

    const now = new Date();
    const monthKeys = Array.from({ length: 12 }).map((_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const monthLabel = d.toLocaleString("en-US", { month: "short" });
      return {
        key: `${year}-${month}`,
        label: `${monthLabel} ${year}`
      };
    });

    const yearKeys = Array.from({ length: 5 }).map((_, index) => {
      const year = now.getFullYear() - (4 - index);
      return { key: String(year), label: String(year) };
    });

    let userCreatedSeries = null;
    if (!usersTableMissing && !createdAtMissing) {
      const monthCounts = {};
      const yearCounts = {};

      users.forEach((user) => {
        if (!user.created_at) {
          return;
        }
        const d = new Date(user.created_at);
        if (Number.isNaN(d.getTime())) {
          return;
        }
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const monthKey = `${y}-${m}`;
        const yearKey = String(y);
        monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
        yearCounts[yearKey] = (yearCounts[yearKey] || 0) + 1;
      });

      userCreatedSeries = {
        monthly: monthKeys.map(({ key, label }) => ({ key, label, count: Number(monthCounts[key] || 0) })),
        yearly: yearKeys.map(({ key, label }) => ({ key, label, count: Number(yearCounts[key] || 0) }))
      };
    }

    const fetchActiveOffers = async () => {
      const pageSize = 1000;
      const maxRows = 50000;
      const rows = [];
      const nowIso = new Date().toISOString();

      for (let from = 0; from < maxRows; from += pageSize) {
        const { data, error } = await supabase
          .from("offers")
          .select("user_id, offer_type")
          .eq("status", "active")
          .lte("starts_at", nowIso)
          .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        if (isMissingTableError(error, "offers")) {
          return { rows: [], offersTableMissing: true };
        }

        if (error) {
          throw error;
        }

        const batch = data || [];
        rows.push(...batch);

        if (batch.length < pageSize) {
          break;
        }
      }

      return { rows, offersTableMissing: false };
    };

    const activeOffersResult = await fetchActiveOffers();
    const activeOffersRows = activeOffersResult.rows || [];
    const activeOffersByType = activeOffersRows.reduce((accumulator, offer) => {
      const key = String(offer.offer_type || "unknown").trim().toLowerCase() || "unknown";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
    const activeOfferUsers = new Set(activeOffersRows.map((row) => row.user_id).filter(Boolean)).size;

    const buildMonthKeys = (monthsBack = 12) => {
      const now = new Date();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const keys = [];

      for (let offset = monthsBack - 1; offset >= 0; offset -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        keys.push({
          key: `${y}-${m}`,
          label: `${months[d.getMonth()]} ${y}`
        });
      }

      return keys;
    };

    const fetchRecentCertificates = async ({ startIso }) => {
      const pageSize = 1000;
      const maxRows = 50000;
      const rows = [];

      for (let from = 0; from < maxRows; from += pageSize) {
        const { data, error } = await supabase
          .from("certificates")
          .select("issued_at, user_id")
          .gte("issued_at", startIso)
          .order("issued_at", { ascending: false })
          .range(from, from + pageSize - 1);

        if (isMissingTableError(error, "certificates")) {
          return { rows: [], certificatesTableMissing: true };
        }

        if (error) {
          throw error;
        }

        const batch = data || [];
        rows.push(...batch);

        if (batch.length < pageSize) {
          break;
        }
      }

      return { rows, certificatesTableMissing: false };
    };

    const certificateTotalQuery = supabase.from("certificates").select("id", { count: "exact", head: true });
    const certificateTotalRes = await certificateTotalQuery;

    const certificatesTableMissing = isMissingTableError(certificateTotalRes.error, "certificates");
    if (!certificatesTableMissing && certificateTotalRes.error) {
      throw certificateTotalRes.error;
    }
    const certificatesTotal = certificatesTableMissing ? null : certificateTotalRes.count ?? 0;

    const months = buildMonthKeys(12);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 11, 1);
    startDate.setHours(0, 0, 0, 0);

    const recentCertificatesResult = certificatesTableMissing
      ? { rows: [], certificatesTableMissing: true }
      : await fetchRecentCertificates({ startIso: startDate.toISOString() });

    const recentCertificates = recentCertificatesResult.rows || [];
    const certificateMonthCounts = recentCertificates.reduce((accumulator, row) => {
      const d = row.issued_at ? new Date(row.issued_at) : null;
      if (!d || Number.isNaN(d.getTime())) {
        return accumulator;
      }
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    const certificateUniqueUsers = recentCertificatesResult.certificatesTableMissing
      ? null
      : new Set(recentCertificates.map((row) => row.user_id).filter(Boolean)).size;

    return res.json({
      answers: {
        total: answersTotal,
        correct: answersCorrect,
        accuracyPercent
      },
      offers: {
        activeTotal: activeOffersResult.offersTableMissing ? null : activeOffersRows.length,
        activeUsers: activeOffersResult.offersTableMissing ? null : activeOfferUsers,
        byType: activeOffersResult.offersTableMissing ? null : activeOffersByType
      },
      certificates: {
        total: certificatesTableMissing ? null : certificatesTotal,
        uniqueUsers: certificateUniqueUsers,
        issuedSeries: recentCertificatesResult.certificatesTableMissing
          ? null
          : {
              monthly: months.map(({ key, label }) => ({
                key,
                label,
                count: Number(certificateMonthCounts[key] || 0)
              }))
            }
      },
      tests: {
        total: testsTotal,
        passed: testsPassed,
        passRatePercent: testsPassRatePercent,
        byDifficulty: testsByDifficulty
      },
      users: {
        total: totalUsers,
        blocked: blockedUsers,
        byRole: roleCounts,
        byProfession: usersByProfession,
        createdSeries: userCreatedSeries
      }
    });
  } catch (error) {
    next(error);
  }
};

export const upsertAdminOfferTemplate = async (req, res, next) => {
  try {
    const adminUserId = req.headers["x-user-id"] || null;
    const {
      name,
      offerType,
      days = null,
      fixedQuestionCount = null,
      fixedDifficulty = null,
      fixedExamType = null
    } = req.body || {};

    const templateName = String(name || "").trim();
    if (!templateName) {
      return res.status(400).json({ message: "name is required." });
    }

    const type = String(offerType || "").trim().toLowerCase();
    if (!["time", "days", "lifetime"].includes(type)) {
      return res.status(400).json({ message: "offerType must be one of: time, days, lifetime." });
    }

    const allowedDifficulties = new Set(["easy", "medium", "hard"]);
    const allowedExamTypes = new Set(["no return", "return allowed", "per question timer", "total timer"]);

    const fixedQuestionCountValue =
      fixedQuestionCount == null || fixedQuestionCount === ""
        ? null
        : Math.floor(Number(fixedQuestionCount));

    if (fixedQuestionCountValue != null) {
      if (!Number.isFinite(fixedQuestionCountValue) || fixedQuestionCountValue <= 0) {
        return res.status(400).json({ message: "fixedQuestionCount must be a positive number." });
      }
    }

    const fixedDifficultyValue =
      fixedDifficulty == null || String(fixedDifficulty).trim() === "" ? null : String(fixedDifficulty).trim().toLowerCase();

    if (fixedDifficultyValue != null && !allowedDifficulties.has(fixedDifficultyValue)) {
      return res.status(400).json({ message: "fixedDifficulty must be one of: easy, medium, hard." });
    }

    const fixedExamTypeValue =
      fixedExamType == null || String(fixedExamType).trim() === "" ? null : String(fixedExamType).trim().toLowerCase();

    if (fixedExamTypeValue != null && !allowedExamTypes.has(fixedExamTypeValue)) {
      return res.status(400).json({
        message: "fixedExamType must be one of: no return, return allowed, per question timer, total timer."
      });
    }

    const daysValue = type === "days"
      ? Math.floor(Number(days))
      : null;

    if (type === "days") {
      if (!Number.isFinite(daysValue) || daysValue <= 0) {
        return res.status(400).json({ message: "days must be a positive number for days based templates." });
      }
    }

    const nowIso = new Date().toISOString();
    const payload = {
      name: templateName,
      offer_type: type,
      days: daysValue,
      fixed_question_count: fixedQuestionCountValue,
      fixed_difficulty: fixedDifficultyValue,
      fixed_exam_type: fixedExamTypeValue,
      created_by: adminUserId,
      updated_at: nowIso
    };

    const { data, error } = await supabase
      .from("offer_templates")
      .upsert(payload, { onConflict: "name" })
      .select("*")
      .single();

    if (isMissingTableError(error, "offer_templates")) {
      return res.status(503).json({
        message: "Offer templates are not configured in the database yet. Please run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    return res.status(201).json({ message: "Template saved.", template: data });
  } catch (error) {
    next(error);
  }
};

export const deleteAdminOfferTemplate = async (req, res, next) => {
  try {
    const { templateId } = req.params;

    const { data, error } = await supabase
      .from("offer_templates")
      .delete()
      .eq("id", templateId)
      .select("id");

    if (isMissingTableError(error, "offer_templates")) {
      return res.status(503).json({
        message: "Offer templates are not configured in the database yet. Please run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    return res.json({ message: "Template deleted.", id: (data || [])[0]?.id || templateId });
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

export const getAdminFeedbacks = async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("feedback")
      .select("*, submitter:users!feedback_user_id_fkey(name,email)")
      .order("created_at", { ascending: false });

    if (isMissingTableError(error, "feedback")) {
      return res.json({ feedbacks: [] });
    }

    if (error) {
      throw error;
    }

    return res.json({ feedbacks: data || [] });
  } catch (error) {
    next(error);
  }
};

export const markAdminFeedbackReviewed = async (req, res, next) => {
  try {
    const { feedbackId } = req.params;
    const adminUserId = req.headers["x-user-id"] || null;

    const { data, error } = await supabase
      .from("feedback")
      .update({
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminUserId
      })
      .eq("id", feedbackId)
      .select("*, submitter:users!feedback_user_id_fkey(name,email)")
      .single();

    if (isMissingTableError(error, "feedback")) {
      return res.status(503).json({ message: "Feedback table is not configured yet." });
    }

    if (isMissingColumnError(error, "reviewed_at") || isMissingColumnError(error, "reviewed_by")) {
      return res.status(503).json({
        message: "Feedback review columns are not configured yet. Please run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    return res.json({ message: "Feedback marked as reviewed.", feedback: data });
  } catch (error) {
    next(error);
  }
};

export const clearAdminFeedback = async (req, res, next) => {
  try {
    const { feedbackId } = req.params;

    const { data, error } = await supabase.from("feedback").delete().eq("id", feedbackId).select("id");

    if (isMissingTableError(error, "feedback")) {
      return res.status(503).json({ message: "Feedback table is not configured yet." });
    }

    if (error) {
      throw error;
    }

    const deleted = (data || []).length ? data[0] : null;
    return res.json({ message: "Feedback cleared.", id: deleted?.id || feedbackId });
  } catch (error) {
    next(error);
  }
};

export const clearAdminFeedbacks = async (req, res, next) => {
  try {
    const reviewedBeforeDays = Number(req.body?.reviewedBeforeDays ?? 30);
    const days = Number.isFinite(reviewedBeforeDays) && reviewedBeforeDays > 0 ? reviewedBeforeDays : 30;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Math.floor(days));

    const { data, error } = await supabase
      .from("feedback")
      .delete()
      .not("reviewed_at", "is", null)
      .lt("reviewed_at", cutoff.toISOString())
      .select("id");

    if (isMissingTableError(error, "feedback")) {
      return res.status(503).json({ message: "Feedback table is not configured yet." });
    }

    if (isMissingColumnError(error, "reviewed_at")) {
      return res.status(503).json({
        message: "Feedback review columns are not configured yet. Please run the latest schema."
      });
    }

    if (error) {
      throw error;
    }

    return res.json({
      message: `Cleared ${(data || []).length} feedback item(s).`,
      clearedCount: (data || []).length
    });
  } catch (error) {
    next(error);
  }
};

export const askAppAssistant = async (req, res, next) => {
  try {
    const { question } = req.body;
    const userId = req.headers["x-user-id"];

    if (!question?.trim()) {
      return res.status(400).json({ message: "Question is required." });
    }

    let answer;
    let announcement = null;
    try {
      const prompt = `You are the in-app help assistant for AKSHARA, an AI test portal. Answer the user's question briefly and clearly. User question: ${question}`;
      const { model } = await getGeminiModelForUserId(userId);
      const result = await model.generateContent(prompt);
      answer = result.response.text().trim();
    } catch (assistantError) {
      console.warn("Gemini assistant fallback triggered.", assistantError.message);
      if (isQuotaError(assistantError)) {
        announcement = buildQuotaAnnouncement(await getGeminiModelForUserId(userId));
      }
      answer =
        "You can create tests from the Create Test page, review scores in the dashboard, check old attempts in History, and contact admin through feedback or unblock request forms if needed.";
    }

    return res.json({ answer, announcement });
  } catch (error) {
    next(error);
  }
};

