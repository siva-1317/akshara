import express from "express";
import {
  addTopic,
  askAppAssistant,
  blockUser,
  cancelAdminOffers,
  clearAdminFeedback,
  clearAdminFeedbacks,
  clearNotifications,
  createAdminOffers,
  createUnblockRequest,
  deleteAdminOfferTemplate,
  deleteAdminTest,
  deleteAdminUser,
  getAdminAnalytics,
  getAdminFeedbacks,
  getAdminOfferTemplates,
  getAdminOffers,
  getAdminTests,
  getAdminUserPerformance,
  getAdminUsers,
  getCoinRequests,
  getNotifications,
  getTopics,
  getUnblockRequests,
  grantCoinsToUser,
  markAdminFeedbackReviewed,
  markAllNotificationsRead,
  markNotificationRead,
  approveCoinRequest,
  rejectCoinRequest,
  rejectUnblockRequest,
  requestCoins,
  revokeCoinsFromUser,
  submitFeedback,
  unblockUser,
  approveAdminUser,
  rejectAdminUser,
  updateAdminOffer,
  cancelAdminOffer,
  upsertAdminOfferTemplate
} from "../controllers/testController.js";

const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (req.headers["x-user-role"] !== "admin") {
    return res.status(403).json({ message: "Admin access only." });
  }
  next();
};

router.get("/admin/users", requireAdmin, getAdminUsers);
router.post("/admin/users/:userId/approve", requireAdmin, approveAdminUser);
router.post("/admin/users/:userId/reject", requireAdmin, rejectAdminUser);
router.get("/admin/users/:userId/performance", requireAdmin, getAdminUserPerformance);
router.delete("/admin/users/:userId", requireAdmin, deleteAdminUser);
router.post("/admin/users/:userId/block", requireAdmin, blockUser);
router.post("/admin/users/:userId/unblock", requireAdmin, unblockUser);
router.post("/admin/users/:userId/coins", requireAdmin, grantCoinsToUser);
router.post("/admin/users/:userId/coins/revoke", requireAdmin, revokeCoinsFromUser);

router.get("/admin/tests", requireAdmin, getAdminTests);
router.delete("/admin/tests/:testId", requireAdmin, deleteAdminTest);

router.get("/admin/unblock-requests", requireAdmin, getUnblockRequests);
router.post("/admin/unblock-requests/:requestId/reject", requireAdmin, rejectUnblockRequest);

router.get("/admin/coin-requests", requireAdmin, getCoinRequests);
router.post("/admin/coin-requests/:requestId/approve", requireAdmin, approveCoinRequest);
router.post("/admin/coin-requests/:requestId/reject", requireAdmin, rejectCoinRequest);

router.get("/admin/topics", getTopics);
router.post("/admin/topics", requireAdmin, addTopic);

router.get("/admin/feedbacks", requireAdmin, getAdminFeedbacks);
router.post("/admin/feedbacks/:feedbackId/review", requireAdmin, markAdminFeedbackReviewed);
router.delete("/admin/feedbacks/:feedbackId", requireAdmin, clearAdminFeedback);
router.post("/admin/feedbacks/clear", requireAdmin, clearAdminFeedbacks);

router.get("/admin/offers", requireAdmin, getAdminOffers);
router.post("/admin/offers", requireAdmin, createAdminOffers);
router.post("/admin/offers/cancel", requireAdmin, cancelAdminOffers);
router.post("/admin/offers/:offerId", requireAdmin, updateAdminOffer);
router.post("/admin/offers/:offerId/cancel", requireAdmin, cancelAdminOffer);

router.get("/admin/offer-templates", requireAdmin, getAdminOfferTemplates);
router.post("/admin/offer-templates", requireAdmin, upsertAdminOfferTemplate);
router.delete("/admin/offer-templates/:templateId", requireAdmin, deleteAdminOfferTemplate);

router.get("/admin/analytics", requireAdmin, getAdminAnalytics);

router.get("/notifications", getNotifications);
router.post("/notifications/:notificationId/read", markNotificationRead);
router.post("/notifications/read-all", markAllNotificationsRead);
router.delete("/notifications", clearNotifications);

router.post("/unblock-request", createUnblockRequest);
router.post("/coins/request", requestCoins);
router.post("/feedback", submitFeedback);
router.post("/assistant/query", askAppAssistant);

export default router;
