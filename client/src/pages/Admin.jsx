import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  addTopic,
  approveAdminCoinRequest,
  blockAdminUser,
  deleteAdminTest,
  getAdminCoinRequests,
  getAdminTests,
  getAdminUserPerformance,
  getAdminUsers,
  getNotifications,
  getTopics,
  getUnblockRequests,
  grantAdminUserCoins,
  rejectAdminUnblockRequest,
  rejectAdminCoinRequest,
  unblockAdminUser
} from "../api";
import AdminDashboard from "./admin/AdminDashboard";
import AdminRequests from "./admin/AdminRequests";
import AdminTopics from "./admin/AdminTopics";
import AdminUsers from "./admin/AdminUsers";

const useStoredUser = () => JSON.parse(localStorage.getItem("aksharaUser") || "null");

const SideLink = ({ to, label, pill = null }) => {
  const location = useLocation();
  const active = location.pathname === to;
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

  const [users, setUsers] = useState([]);
  const [tests, setTests] = useState([]);
  const [topics, setTopics] = useState([]);
  const [requests, setRequests] = useState([]);
  const [coinRequests, setCoinRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
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

  const loadAdmin = async () => {
    try {
      setLoading(true);
      const [
        usersResponse,
        testsResponse,
        topicsResponse,
        requestsResponse,
        coinRequestsResponse,
        notificationsResponse
      ] = await Promise.all([
        getAdminUsers(),
        getAdminTests(),
        getTopics(),
        getUnblockRequests(),
        getAdminCoinRequests(),
        getNotifications()
      ]);

      const usersData = usersResponse.data.users || [];
      setUsers(usersData);
      setTests(testsResponse.data.tests || []);
      setTopics(topicsResponse.data.topics || []);
      setRequests(requestsResponse.data.requests || []);
      setCoinRequests(coinRequestsResponse.data.requests || []);
      setNotifications(notificationsResponse.data.notifications || []);

      const nextUserId =
        selectedUserId || usersData.find((user) => user.role !== "admin")?.id || usersData[0]?.id || "";
      setSelectedUserId(nextUserId);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleDeleteTest = async (testId) => {
    try {
      setActionLoading(true);
      await deleteAdminTest(testId);
      await loadAdmin();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete test.");
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
    } catch (err) {
      setError(err.response?.data?.message || "Unable to block user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async (userId, requestId = null) => {
    try {
      setActionLoading(true);
      setError("");
      await unblockAdminUser(userId, {
        note,
        requestId
      });
      setNote("");
      await loadAdmin();
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
    } catch (err) {
      setError(err.response?.data?.message || "Unable to grant coins.");
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
            pill={`${users.length - blockedCount} / ${blockedCount}`}
          />
          <SideLink to="/admin/topics" label="Topics" pill={topics.length} />
          <SideLink to="/admin/requests" label="Requests" pill={pendingCount} />
        </div>
      </aside>

      <div className="admin-main">
        <div className="container">
          {loading || actionLoading ? <div className="loading-pill mb-3">Updating...</div> : null}
          {error ? <div className="alert alert-danger">{error}</div> : null}

          <Routes>
            <Route
              path="dashboard"
              element={
                <AdminDashboard
                  users={users}
                  tests={tests}
                  topics={topics}
                  requests={requests}
                  coinRequests={coinRequests}
                  notifications={notifications}
                  onDeleteTest={handleDeleteTest}
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
                  grantCoins={grantCoins}
                  onGrantCoinsChange={setGrantCoins}
                  onGrantCoins={handleGrantCoins}
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
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
