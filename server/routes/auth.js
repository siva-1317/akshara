import express from "express";
import { getCurrentUser, login, updateCurrentUser } from "../controllers/authController.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", getCurrentUser);
router.put("/me", updateCurrentUser);

export default router;
