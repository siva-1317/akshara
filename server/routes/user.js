import express from "express";
import {
  addTopic,
  askAppAssistant,
  blockUser,
  clearNotifications,
  createUnblockRequest,
  deleteAdminTest,
  getCoinRequests,
  getAdminTests,
  getAdminUserPerformance,
  getAdminUsers,
  getNotifications,
  getTopics
  ,
  getUnblockRequests,
  grantCoinsToUser,
  markAllNotificationsRead,
  markNotificationRead,
  approveCoinRequest,
  rejectCoinRequest,
  rejectUnblockRequest,
  requestCoins,
  submitFeedback,
  unblockUser
} from "../controllers/testController.js";

const router = express.Router();
const requireAdmin = (req, res, next) => {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ message: "Admin access only." });
  }
  next();
};

router.get("/admin/users", requireAdmin, getAdminUsers);
router.get("/admin/users/:userId/performance", requireAdmin, getAdminUserPerformance);
router.post("/admin/users/:userId/block", requireAdmin, blockUser);
router.post("/admin/users/:userId/unblock", requireAdmin, unblockUser);
router.get("/admin/tests", requireAdmin, getAdminTests);
router.get("/admin/unblock-requests", requireAdmin, getUnblockRequests);
router.delete("/admin/tests/:testId", requireAdmin, deleteAdminTest);
router.get("/admin/topics", getTopics);
router.post("/admin/topics", requireAdmin, addTopic);
router.get("/notifications", getNotifications);
router.post("/notifications/:notificationId/read", markNotificationRead);
router.post("/notifications/read-all", markAllNotificationsRead);
router.delete("/notifications", clearNotifications);
router.post("/unblock-request", createUnblockRequest);
router.post("/coins/request", requestCoins);
router.post("/feedback", submitFeedback);
router.post("/assistant/query", askAppAssistant);
router.get("/admin/coin-requests", requireAdmin, getCoinRequests);
router.post("/admin/coin-requests/:requestId/approve", requireAdmin, approveCoinRequest);
router.post("/admin/coin-requests/:requestId/reject", requireAdmin, rejectCoinRequest);
router.post("/admin/users/:userId/coins", requireAdmin, grantCoinsToUser);
router.post("/admin/unblock-requests/:requestId/reject", requireAdmin, rejectUnblockRequest);

export default router;
