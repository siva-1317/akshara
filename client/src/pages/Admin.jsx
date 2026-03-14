import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import {
  addTopic,
  approveAdminCoinRequest,
  approveAdminUser,
  blockAdminUser,
  clearAdminFeedback,
  clearAdminFeedbacks,
  deleteAdminUser,
  getAdminCoinRequests,
  getAdminFeedbacks,
  getAdminAnalytics,
  getAdminUserPerformance,
  getAdminUsers,
  getNotifications,
  getTopics,
  getUnblockRequests,
  grantAdminUserCoins,
  markAdminFeedbackReviewed,
  rejectAdminUnblockRequest,
  rejectAdminCoinRequest,
  rejectAdminUser,
  revokeAdminUserCoins,
  unblockAdminUser
} from "../api";
import AdminDashboard from "./admin/AdminDashboard";
import AdminRequests from "./admin/AdminRequests";
import AdminCertificates from "./admin/AdminCertificates";
import AdminTopics from "./admin/AdminTopics";
import AdminUserDetails from "./admin/AdminUserDetails";
import AdminUsers from "./admin/AdminUsers";
import AdminFeedbacks from "./admin/AdminFeedbacks";
import AdminOffers from "./admin/AdminOffers";

const useStoredUser = () => JSON.parse(localStorage.getItem("aksharaUser") || "null");

const SideLink = ({ to, label, pill = null }) => {
  const location = useLocation();
  const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
  return (
    <Link className={`admin-side-link ${active ? "active" : ""}`} to={to}>
      <span>{label}</span>
      {pill != null ? <span className="admin-side-pill">{pill}</span> : null}
    </Link>
  );
};

export default function Admin() {
  const storedUser = useStoredUser();
  const location = useLocation();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [topics, setTopics] = useState([]);
  const [requests, setRequests] = useState([]);
  const [coinRequests, setCoinRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPerformance, setSelectedPerformance] = useState(null);
  const [topicName, setTopicName] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [note, setNote] = useState("");
  const [grantCoins, setGrantCoins] = useState(50);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const pendingCount = useMemo(
    () =>
      requests.filter((item) => item.status === "pending").length +
      coinRequests.filter((item) => item.status === "pending").length,
    [coinRequests, requests]
  );

  const blockedCount = useMemo(() => users.filter((user) => user.is_blocked).length, [users]);
  const pendingFeedbackCount = useMemo(
    () => (feedbacks || []).filter((item) => !item.reviewed_at).length,
    [feedbacks]
  );
  const activeOffersTotal = analytics?.offers?.activeTotal;
  const waitingCount = useMemo(
    () =>
      (users || []).filter(
        (user) =>
          user.role !== "admin" &&
          !user.is_blocked &&
          String(user.approval_status || "approved").toLowerCase() !== "approved"
      ).length,
    [users]
  );

  const loadAdmin = async () => {
    try {
      setLoading(true);
      const [
        usersResponse,
        topicsResponse,
        requestsResponse,
        coinRequestsResponse,
        notificationsResponse,
        feedbacksResponse,
        analyticsResponse
      ] = await Promise.all([
        getAdminUsers(),
        getTopics(),
        getUnblockRequests(),
        getAdminCoinRequests(),
        getNotifications(),
        getAdminFeedbacks(),
        getAdminAnalytics()
      ]);

      const usersData = usersResponse.data.users || [];
      setUsers(usersData);
      setTopics(topicsResponse.data.topics || []);
      setRequests(requestsResponse.data.requests || []);
      setCoinRequests(coinRequestsResponse.data.requests || []);
      setNotifications(notificationsResponse.data.notifications || []);
      setFeedbacks(feedbacksResponse.data.feedbacks || []);
      setAnalytics(analyticsResponse.data || null);

      const nextUserId =
        selectedUserId || usersData.find((user) => user.role !== "admin")?.id || usersData[0]?.id || "";
      setSelectedUserId(nextUserId);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  const loadFeedbacks = async () => {
    const { data } = await getAdminFeedbacks();
    setFeedbacks(data.feedbacks || []);
  };

  useEffect(() => {
    loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }
    toast.error(error);
    setError("");
  }, [error, toast]);

  useEffect(() => {
    const loadSelectedPerformance = async () => {
      if (!selectedUserId) {
        setSelectedPerformance(null);
        return;
      }

      try {
        const { data } = await getAdminUserPerformance(selectedUserId);
        setSelectedPerformance(data);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load user performance.");
      }
    };

    loadSelectedPerformance();
  }, [selectedUserId]);

  const handleMarkFeedbackReviewed = async (feedbackId) => {
    try {
      setActionLoading(true);
      setError("");
      await markAdminFeedbackReviewed(feedbackId);
      await loadFeedbacks();
      toast.success("Feedback marked as reviewed.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update feedback.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearFeedback = async (feedbackId) => {
    try {
      setActionLoading(true);
      setError("");
      await clearAdminFeedback(feedbackId);
      await loadFeedbacks();
      toast.success("Feedback cleared.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to clear feedback.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearReviewedFeedbacks = async (reviewedBeforeDays) => {
    try {
      setActionLoading(true);
      setError("");
      await clearAdminFeedbacks({ reviewedBeforeDays });
      await loadFeedbacks();
      toast.success("Reviewed feedback cleared.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to clear feedbacks.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTopic = async (event) => {
    event.preventDefault();
    if (!topicName.trim()) {
      return;
    }

    try {
      setActionLoading(true);
      await addTopic({ name: topicName.trim() });
      setTopicName("");
      await loadAdmin();
      toast.success("Topic added successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add topic.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async (userIdOverride = null) => {
    const userId = userIdOverride || selectedUserId;
    if (!userId || !blockReason.trim()) {
      setError("Select a user and provide a block reason.");
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      await blockAdminUser(userId, { reason: blockReason });
      setBlockReason("");
      await loadAdmin();
      toast.warning("User blocked.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to block user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveUser = async (userId) => {
    try {
      setActionLoading(true);
      setError("");
      await approveAdminUser(userId);
      await loadAdmin();
      toast.success("User approved.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to approve user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectUser = async (userId) => {
    try {
      setActionLoading(true);
      setError("");
      await rejectAdminUser(userId);
      await loadAdmin();
      toast.warning("User rejected.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reject user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async (userId, requestId = null, noteOverride = null) => {
    try {
      setActionLoading(true);
      setError("");
      await unblockAdminUser(userId, {
        note: noteOverride == null ? note : noteOverride,
        requestId
      });
      setNote("");
      await loadAdmin();
      toast.success("User unblocked.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to unblock user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleGrantCoins = async (userId) => {
    const amount = Number(grantCoins);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid coins amount.");
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      await grantAdminUserCoins(userId, { coins: amount });
      await loadAdmin();
      toast.success("Coins granted successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to grant coins.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeCoins = async (userId) => {
    const amount = Number(grantCoins);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid coins amount.");
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      await revokeAdminUserCoins(userId, { coins: amount });
      await loadAdmin();
      toast.warning("Coins revoked.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to revoke coins.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      setActionLoading(true);
      setError("");
      await deleteAdminUser(userId);
      await loadAdmin();
      toast.warning("User deleted permanently.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveCoins = async (requestId, coinNote) => {
    try {
      setActionLoading(true);
      setError("");
      await approveAdminCoinRequest(requestId, { note: coinNote });
      await loadAdmin();
      toast.success("Coins request approved.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to approve coins request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectCoins = async (requestId, coinNote) => {
    try {
      setActionLoading(true);
      setError("");
      await rejectAdminCoinRequest(requestId, { note: coinNote });
      await loadAdmin();
      toast.warning("Coins request rejected.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reject coins request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectUnblock = async (requestId, unblockNote) => {
    try {
      setActionLoading(true);
      setError("");
      await rejectAdminUnblockRequest(requestId, { note: unblockNote });
      await loadAdmin();
      toast.warning("Unblock request rejected.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to reject unblock request.");
    } finally {
      setActionLoading(false);
    }
  };

  if (storedUser?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  if (location.pathname === "/admin" || location.pathname === "/admin/") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="page-shell admin-page">
      <aside className="admin-side-nav admin-side-nav-fixed">
        <span className="admin-side-title">Admin</span>
        <div className="admin-side-links">
          <SideLink to="/admin/dashboard" label="Dashboard" />
          <SideLink
            to="/admin/users"
            label="Users"
            pill={`${users.length - blockedCount} / ${blockedCount}${waitingCount ? ` (${waitingCount} waiting)` : ""}`}
          />
          <SideLink to="/admin/topics" label="Topics" pill={topics.length} />
          <SideLink to="/admin/requests" label="Requests" pill={pendingCount} />
          <SideLink to="/admin/offers" label="Offers" pill={activeOffersTotal == null ? "â€”" : activeOffersTotal} />
          <SideLink to="/admin/certificates" label="Certificates" />
          <SideLink to="/admin/feedbacks" label="Feedbacks" pill={pendingFeedbackCount} />
        </div>
      </aside>

      <div className="admin-main">
        <div className="container">
          {loading || actionLoading ? <div className="loading-pill mb-3">Updating...</div> : null}

          <Routes>
            <Route
              path="dashboard"
              element={
                <AdminDashboard
                  analytics={analytics}
                  requests={requests}
                  coinRequests={coinRequests}
                  notifications={notifications}
                />
              }
            />
          <Route
            path="users"
            element={
              <AdminUsers
                users={users}
                selectedUserId={selectedUserId}
                onSelectUser={setSelectedUserId}
                selectedPerformance={selectedPerformance}
                blockReason={blockReason}
                onBlockReasonChange={setBlockReason}
                note={note}
                onNoteChange={setNote}
                onBlockUser={handleBlock}
                onUnblockUser={(userId) => handleUnblock(userId)}
                onApproveUser={handleApproveUser}
                onRejectUser={handleRejectUser}
                grantCoins={grantCoins}
                onGrantCoinsChange={setGrantCoins}
                onGrantCoins={handleGrantCoins}
                actionLoading={actionLoading}
              />
            }
          />
          <Route
            path="users/:userId"
            element={
              <AdminUserDetails
                users={users}
                selectedPerformance={selectedPerformance}
                onSelectUser={setSelectedUserId}
                onBlockUser={async (userId, reason) => {
                  if (!userId || !String(reason || "").trim()) {
                    setError("Provide a block reason.");
                    return;
                  }

                  try {
                    setActionLoading(true);
                    setError("");
                    await blockAdminUser(userId, { reason: String(reason).trim() });
                    await loadAdmin();
                    toast.warning("User blocked.");
                  } catch (err) {
                    setError(err.response?.data?.message || "Unable to block user.");
                  } finally {
                    setActionLoading(false);
                  }
                }}
                onUnblockUser={(userId) => handleUnblock(userId, null, "")}
                onDeleteUser={handleDeleteUser}
                grantCoins={grantCoins}
                onGrantCoinsChange={setGrantCoins}
                onGrantCoins={handleGrantCoins}
                onRevokeCoins={handleRevokeCoins}
                actionLoading={actionLoading}
              />
            }
          />
            <Route
              path="topics"
              element={
                <AdminTopics
                  topics={topics}
                  topicName={topicName}
                  onTopicNameChange={setTopicName}
                  onAddTopic={handleAddTopic}
                  loading={actionLoading}
                />
              }
            />
            <Route
              path="requests"
              element={
                <AdminRequests
                  requests={requests}
                  coinRequests={coinRequests}
                  onApproveUnblock={(userId, requestId, unblockNote) => {
                    setNote(unblockNote || "");
                    return handleUnblock(userId, requestId);
                  }}
                  onRejectUnblock={handleRejectUnblock}
                  onApproveCoins={handleApproveCoins}
                  onRejectCoins={handleRejectCoins}
                  actionLoading={actionLoading}
                />
              }
            />
            <Route path="certificates" element={<AdminCertificates />} />
            <Route path="offers" element={<AdminOffers users={users} />} />
            <Route
              path="feedbacks"
              element={
                <AdminFeedbacks
                  feedbacks={feedbacks}
                  onMarkReviewed={handleMarkFeedbackReviewed}
                  onClear={handleClearFeedback}
                  onClearReviewedOlderThan={handleClearReviewedFeedbacks}
                  actionLoading={actionLoading}
                />
              }
            />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
