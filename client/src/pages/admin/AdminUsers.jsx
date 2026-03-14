import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";

export default function AdminUsers({
  users,
  selectedUserId,
  onSelectUser,
  selectedPerformance,
  blockReason,
  onBlockReasonChange,
  note,
  onNoteChange,
  onBlockUser,
  onUnblockUser,
  onApproveUser,
  onRejectUser,
  grantCoins,
  onGrantCoinsChange,
  onGrantCoins,
  actionLoading
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");


  const filteredUsers = useMemo(() => {
    const list = (users || []).filter((user) => user.role !== "admin");
    if (tab === "blocked") {
      return list.filter((user) => user.is_blocked);
    }

    if (tab === "waiting") {
      return list.filter(
        (user) =>
          !user.is_blocked && String(user.approval_status || "approved").toLowerCase() !== "approved"
      );
    }

    return list.filter(
      (user) =>
        !user.is_blocked && String(user.approval_status || "approved").toLowerCase() === "approved"
    );
  }, [tab, users]);

  const searchedUsers = useMemo(() => {
    const needle = String(search || "").trim().toLowerCase();
    if (!needle) {
      return filteredUsers;
    }
    return filteredUsers.filter((user) => {
      const name = String(user.name || "").toLowerCase();
      const email = String(user.email || "").toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });
  }, [filteredUsers, search]);

  useEffect(() => {
    if (!searchedUsers.length) {
      return;
    }

    const existsInFiltered = searchedUsers.some((user) => user.id === selectedUserId);
    if (!existsInFiltered) {
      onSelectUser?.(searchedUsers[0].id);
    }
  }, [onSelectUser, searchedUsers, selectedUserId]);

  const openView = (user) => {
    onSelectUser?.(user.id);
    navigate(`/admin/users/${user.id}`);
  };

  const approveUser = async (userId) => {
    await onApproveUser?.(userId);
  };

  const rejectUser = async (userId) => {
    await onRejectUser?.(userId);
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h2 className="section-title mb-1">Users</h2>
          <p className="text-muted mb-0">Inspect performance, moderate accounts, and grant coins.</p>
        </div>
      </div>

      <Card title="User List" subtitle="View user details and moderate accounts">
        <div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
          <div className="admin-tabs">
            <button
              type="button"
              className={`admin-tab-btn ${tab === "active" ? "active" : ""}`}
              onClick={() => setTab("active")}
            >
              Active
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${tab === "blocked" ? "active" : ""}`}
              onClick={() => setTab("blocked")}
            >
              Blocked
            </button>
            <button
              type="button"
              className={`admin-tab-btn ${tab === "waiting" ? "active" : ""}`}
              onClick={() => setTab("waiting")}
            >
              Waiting
            </button>
          </div>
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div className="field-shell" style={{ minWidth: "260px" }}>
              <input
                className="form-control create-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or email"
              />
            </div>
            <small className="text-muted mb-0">{searchedUsers.length} users</small>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-ak align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Coins</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {searchedUsers.length ? (
                searchedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      {user.is_blocked ? (
                        <span className="status-tag blocked">Blocked</span>
                      ) : String(user.approval_status || "approved").toLowerCase() === "approved" ? (
                        <span className="status-tag active">Active</span>
                      ) : String(user.approval_status || "").toLowerCase() === "rejected" ? (
                        <span className="status-tag danger">Rejected</span>
                      ) : (
                        <span className="status-tag warning">Waiting</span>
                      )}
                    </td>
                    <td>{Number.isFinite(user.coins) ? user.coins : 0}</td>
                    <td>
                      {tab === "waiting" ? (
                        <div className="d-flex gap-2 flex-wrap">
                          <button
                            type="button"
                            className="btn btn-sm btn-ak-primary"
                            disabled={actionLoading}
                            onClick={() => approveUser(user.id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-ak-danger"
                            disabled={actionLoading}
                            onClick={() => rejectUser(user.id)}
                          >
                            Reject
                          </button>
                          <button className="btn btn-sm btn-outline-ak" onClick={() => openView(user)}>
                            View
                          </button>
                        </div>
                      ) : (
                        <button className="btn btn-sm btn-outline-ak" onClick={() => openView(user)}>
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center text-muted py-4">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
