import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000"
});

api.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem("aksharaUser") || "null");
  if (user?.role) {
    config.headers["x-user-role"] = user.role;
  }
  if (user?.id) {
    config.headers["x-user-id"] = user.id;
  }
  return config;
});

const storeAnnouncement = (announcement) => {
  const message = String(announcement || "").trim();
  if (!message) {
    return;
  }

  const payload = {
    message,
    expiresAt: Date.now() + 12 * 60 * 60 * 1000
  };

  localStorage.setItem("aksharaAnnouncement", JSON.stringify(payload));
  window.dispatchEvent(new Event("akshara-announcement"));
};

api.interceptors.response.use(
  (response) => {
    storeAnnouncement(response?.data?.announcement);
    return response;
  },
  (error) => {
    storeAnnouncement(error?.response?.data?.announcement);
    return Promise.reject(error);
  }
);

export const loginWithGoogle = (credential) => api.post("/login", { credential });
export const loginWithPassword = (payload) => api.post("/login", payload);
export const getCurrentUser = () => api.get("/me");
export const updateCurrentUser = (payload) => api.put("/me", payload);
export const getOnboarding = () => api.get("/onboarding");
export const submitOnboarding = (payload) => api.post("/onboarding", payload);
export const createTest = (payload) => api.post("/create-test", payload);
export const suggestSubtopics = (payload) => api.post("/suggest-subtopics", payload);
export const generateQuestions = (payload) => api.post("/generate-questions", payload);
export const submitTest = (payload) => api.post("/submit-test", payload);
export const getHistory = (userId) => api.get("/history", { params: { userId } });
export const getDashboard = (userId) => api.get("/dashboard", { params: { userId } });
export const suggestTest = (payload) => api.post("/suggest-test", payload);
export const getTest = (testId) => api.get(`/test/${testId}`);
export const getReview = (testId) => api.get(`/review/${testId}`);
export const getAdminUsers = () => api.get("/admin/users");
export const getAdminUserPerformance = (userId) => api.get(`/admin/users/${userId}/performance`);
export const deleteAdminUser = (userId) => api.delete(`/admin/users/${userId}`);
export const blockAdminUser = (userId, payload) => api.post(`/admin/users/${userId}/block`, payload);
export const unblockAdminUser = (userId, payload) => api.post(`/admin/users/${userId}/unblock`, payload);
export const approveAdminUser = (userId) => api.post(`/admin/users/${userId}/approve`);
export const rejectAdminUser = (userId) => api.post(`/admin/users/${userId}/reject`);
export const getAdminTests = () => api.get("/admin/tests");
export const deleteAdminTest = (testId) => api.delete(`/admin/tests/${testId}`);
export const getTopics = () => api.get("/admin/topics");
export const addTopic = (payload) => api.post("/admin/topics", payload);
export const getUnblockRequests = () => api.get("/admin/unblock-requests");
export const getNotifications = () => api.get("/notifications");
export const markNotificationRead = (notificationId) =>
  api.post(`/notifications/${notificationId}/read`);
export const markAllNotificationsRead = () => api.post("/notifications/read-all");
export const clearNotifications = () => api.delete("/notifications");
export const submitUnblockRequest = (payload) => api.post("/unblock-request", payload);
export const requestCoins = (payload) => api.post("/coins/request", payload);
export const getAdminCoinRequests = () => api.get("/admin/coin-requests");
export const approveAdminCoinRequest = (requestId, payload) =>
  api.post(`/admin/coin-requests/${requestId}/approve`, payload);
export const rejectAdminCoinRequest = (requestId, payload) =>
  api.post(`/admin/coin-requests/${requestId}/reject`, payload);
export const rejectAdminUnblockRequest = (requestId, payload) =>
  api.post(`/admin/unblock-requests/${requestId}/reject`, payload);
export const grantAdminUserCoins = (userId, payload) => api.post(`/admin/users/${userId}/coins`, payload);
export const revokeAdminUserCoins = (userId, payload) =>
  api.post(`/admin/users/${userId}/coins/revoke`, payload);
export const submitFeedback = (payload) => api.post("/feedback", payload);
export const getAdminFeedbacks = () => api.get("/admin/feedbacks");
export const markAdminFeedbackReviewed = (feedbackId) =>
  api.post(`/admin/feedbacks/${feedbackId}/review`);
export const clearAdminFeedback = (feedbackId) => api.delete(`/admin/feedbacks/${feedbackId}`);
export const clearAdminFeedbacks = (payload) => api.post("/admin/feedbacks/clear", payload);
export const askAssistant = (payload) => api.post("/assistant/query", payload);
export const getAdminOffers = () => api.get("/admin/offers");
export const createAdminOffers = (payload) => api.post("/admin/offers", payload);
export const cancelAdminOffers = (payload) => api.post("/admin/offers/cancel", payload);
export const cancelAdminOffer = (offerId) => api.post(`/admin/offers/${offerId}/cancel`);
export const updateAdminOffer = (offerId, payload) => api.post(`/admin/offers/${offerId}`, payload);
export const getAdminOfferTemplates = () => api.get("/admin/offer-templates");
export const upsertAdminOfferTemplate = (payload) => api.post("/admin/offer-templates", payload);
export const deleteAdminOfferTemplate = (templateId) =>
  api.delete(`/admin/offer-templates/${templateId}`);
export const getAdminAnalytics = () => api.get("/admin/analytics");

export const getTasks = () => api.get("/tasks");
export const startTask = (publishedTestId) => api.post(`/tasks/${publishedTestId}/start`);
export const getAdminPublishedTests = () => api.get("/admin/published-tests");
export const createAdminPublishedTest = (payload) => api.post("/admin/published-tests", payload);
export const deleteAdminPublishedTest = (publishedTestId) =>
  api.delete(`/admin/published-tests/${publishedTestId}`);
export const getMyCertificates = () => api.get("/certificates");
export const downloadCertificatePdf = (certificateId) =>
  api.get(`/certificates/${certificateId}/pdf`, { responseType: "blob" });

export default api;
