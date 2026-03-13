import express from "express";
import { generateQuestions, suggestSubtopics } from "../controllers/geminiController.js";

const router = express.Router();

router.post("/generate-questions", generateQuestions);
router.post("/suggest-subtopics", suggestSubtopics);

export default router;
