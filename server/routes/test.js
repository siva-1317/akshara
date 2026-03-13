import express from "express";
import {
  createTest,
  getDashboard,
  getHistory,
  getReview,
  getTestById,
  submitTest,
  suggestTest
} from "../controllers/testController.js";

const router = express.Router();

router.post("/create-test", createTest);
router.post("/submit-test", submitTest);
router.post("/suggest-test", suggestTest);
router.get("/history", getHistory);
router.get("/dashboard", getDashboard);
router.get("/test/:testId", getTestById);
router.get("/review/:testId", getReview);

export default router;
