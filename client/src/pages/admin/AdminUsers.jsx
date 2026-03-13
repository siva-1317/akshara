import { useEffect, useMemo, useState } from "react";
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
  grantCoins,
  onGrantCoinsChange,
  onGrantCoins,
  actionLoading
}) {
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewUserId, setViewUserId] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReasonLocal, setBlockReasonLocal] = useState("");

  const filteredUsers = useMemo(() => {
    const list = (users || []).filter((user) => user.role !== "admin");
    if (tab === "blocked") {
      return list.filter((user) => user.is_blocked);
    }
    return list.filter((user) => !user.is_blocked);
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

  const selectedUser = useMemo(
    () => (users || []).find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const viewUser = useMemo(
    () => (users || []).find((user) => user.id === viewUserId) || null,
    [users, viewUserId]
  );

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
    setViewUserId(user.id);
    setViewOpen(true);
  };

  const openBlock = () => {
    setBlockReasonLocal("");
    setBlockOpen(true);
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
                      <span className={`status-tag ${user.is_blocked ? "blocked" : "active"}`}>
                        {user.is_blocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td>{Number.isFinite(user.coins) ? user.coins : 0}</td>
                    <td>
                      <button className="btn btn-sm btn-outline-ak" onClick={() => openView(user)}>
                        View
                      </button>
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

      {viewOpen && viewUser ? (
        <>
          <button
            type="button"
            className="modal-backdrop-ak"
            aria-label="Close student details"
            onClick={() => setViewOpen(false)}
          />
          <div className="modal-card-ak" role="dialog" aria-modal="true">
            <div className="ak-card">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h5 className="fw-bold mb-1">Student Details</h5>
                  <p className="text-muted mb-0">Profile and recent performance.</p>
                </div>
                <div className="d-flex gap-2">
                  {viewUser.is_blocked ? null : (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={openBlock}
                    >
                      Block
                    </button>
                  )}
                  {viewUser.is_blocked ? (
                    <button
                      type="button"
                      className="btn btn-ak-primary btn-sm"
                      disabled={actionLoading}
                      onClick={() => onUnblockUser?.(viewUser.id)}
                    >
                      Unblock
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-outline-ak btn-sm"
                    onClick={() => setViewOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="row g-4 admin-detail-grid">
                <div className="col-lg-5">
                  <Card title="Profile" subtitle="Student information">
                    <div className="row g-3">
                      <div className="col-12">
                        <div className="kv-row">
                          <span className="kv-label">Name</span>
                          <span className="kv-value">{viewUser.name}</span>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="kv-row">
                          <span className="kv-label">Email</span>
                          <span className="kv-value">{viewUser.email}</span>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="kv-row">
                          <span className="kv-label">Phone</span>
                          <span className="kv-value">{viewUser.phone_number || "-"}</span>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="kv-row">
                          <span className="kv-label">Profession</span>
                          <span className="kv-value">{viewUser.profession || "-"}</span>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="kv-row">
                          <span className="kv-label">Coins</span>
                          <span className="kv-value">{Number.isFinite(viewUser.coins) ? viewUser.coins : 0}</span>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="kv-row">
                          <span className="kv-label">Status</span>
                          <span className="kv-value">{viewUser.is_blocked ? "Blocked" : "Active"}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="col-lg-7">
                  <Card title="Performance" subtitle="Recent overview">
                    <div className="row g-3 mb-3">
                      <div className="col-md-4">
                        <div className="mini-stat-card">
                          <small>Total Tests</small>
                          <strong>{selectedPerformance?.performance?.totalTests || 0}</strong>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mini-stat-card">
                          <small>Average Score</small>
                          <strong>{selectedPerformance?.performance?.averageScore || 0}%</strong>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="mini-stat-card">
                          <small>Weak Topics</small>
                          <strong>{selectedPerformance?.performance?.weakestTopics?.join(", ") || "None"}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="row g-3 mb-3">
                      <div className="col-md-8">
                        <label className="form-label create-label mb-2">Grant Coins</label>
                        <div className="field-shell">
                          <input
                            type="number"
                            min="1"
                            className="form-control create-input"
                            value={grantCoins}
                            onChange={(event) => onGrantCoinsChange?.(event.target.value)}
                            placeholder="Coins to add"
                          />
                        </div>
                      </div>
                      <div className="col-md-4 d-grid">
                        <label className="form-label create-label mb-2">&nbsp;</label>
                        <button
                          className="btn btn-ak-primary"
                          type="button"
                          onClick={() => onGrantCoins?.(viewUser.id)}
                          disabled={actionLoading}
                        >
                          Add Coins
                        </button>
                      </div>
                    </div>

                    <Card title="Recent Tests" subtitle="Latest attempts">
                      <div className="d-grid gap-2">
                        {selectedPerformance?.performance?.recentTests?.length ? (
                          selectedPerformance.performance.recentTests.map((test) => (
                            <div className="admin-test-row" key={test.id}>
                              <div>
                                <strong>{test.topic}</strong>
                                <div className="text-muted small">
                                  {new Date(test.date).toLocaleDateString()}
                                </div>
                              </div>
                              <div>
                                <small>Difficulty</small>
                                <div className="fw-bold text-capitalize">{test.difficulty}</div>
                              </div>
                              <div>
                                <small>Score</small>
                                <div className="fw-bold">{test.score || 0}%</div>
                              </div>
                              <div className="text-muted small d-none d-md-block">
                                {new Date(test.date).toLocaleString()}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-muted mb-0">No tests found.</p>
                        )}
                      </div>
                    </Card>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {viewOpen && blockOpen && viewUser ? (
        <>
          <button
            type="button"
            className="modal-backdrop-ak"
            aria-label="Close block form"
            onClick={() => setBlockOpen(false)}
          />
          <div className="modal-card-ak" role="dialog" aria-modal="true">
            <div className="ak-card" style={{ width: "min(640px, 94vw)" }}>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h5 className="fw-bold mb-1">Block User</h5>
                  <p className="text-muted mb-0">Provide a reason to block this user.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-ak btn-sm"
                  onClick={() => setBlockOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="field-shell mb-3">
                <textarea
                  className="form-control create-input unblock-textarea"
                  placeholder="Reason to block"
                  value={blockReasonLocal}
                  onChange={(event) => setBlockReasonLocal(event.target.value)}
                  rows="3"
                  required
                />
              </div>

              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-ak"
                  onClick={() => setBlockOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  disabled={actionLoading || !blockReasonLocal.trim()}
                  onClick={() => {
                    onBlockReasonChange?.(blockReasonLocal);
                    onBlockUser?.(viewUser.id);
                    setBlockOpen(false);
                    setViewOpen(false);
                  }}
                >
                  Block Now
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
