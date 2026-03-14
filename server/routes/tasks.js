import express from "express";
import {
  createAdminPublishedTest,
  deleteAdminPublishedTest,
  getAdminPublishedTests,
  getTasks,
  startTask
} from "../controllers/taskController.js";

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ message: "Admin access only." });
  }
  next();
};

router.get("/tasks", getTasks);
router.post("/tasks/:publishedTestId/start", startTask);

router.get("/admin/published-tests", requireAdmin, getAdminPublishedTests);
router.post("/admin/published-tests", requireAdmin, createAdminPublishedTest);
router.delete("/admin/published-tests/:publishedTestId", requireAdmin, deleteAdminPublishedTest);

export default router;

