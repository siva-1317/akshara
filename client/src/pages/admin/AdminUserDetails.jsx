import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../../components/Card";

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
};

export default function AdminUserDetails({
  users,
  selectedPerformance,
  onSelectUser,
  onBlockUser,
  onUnblockUser,
  onDeleteUser,
  grantCoins,
  onGrantCoinsChange,
  onGrantCoins,
  onRevokeCoins,
  actionLoading
}) {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    if (userId) {
      onSelectUser?.(userId);
    }
  }, [onSelectUser, userId]);

  const user = useMemo(
    () => (users || []).find((item) => item.id === userId) || selectedPerformance?.user || null,
    [selectedPerformance?.user, userId, users]
  );

  const performance = userId === selectedPerformance?.user?.id ? selectedPerformance?.performance : null;

  if (!userId) {
    return (
      <div className="ak-card d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span className="text-muted">Missing user id.</span>
        <button className="btn btn-sm btn-outline-ak" onClick={() => navigate("/admin/users")}>
          Back
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="ak-card d-flex justify-content-between align-items-center flex-wrap gap-2">
        <span className="text-muted">User not found.</span>
        <button type="button" className="btn btn-sm btn-outline-ak" onClick={() => navigate("/admin/users")}>
          Back to Users
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h2 className="section-title mb-1">User Details</h2>
          <p className="text-muted mb-0">Profile and recent performance.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-outline-ak" onClick={() => navigate("/admin/users")}>
            Back to Users
          </button>
          {user.role !== "admin" ? (
            <button
              type="button"
              className="btn btn-outline-ak-danger"
              disabled={actionLoading}
              onClick={() => {
                setDeleteConfirm("");
                setDeleteOpen(true);
              }}
            >
              Delete
            </button>
          ) : null}
          {!user.is_blocked ? (
            <button
              type="button"
              className="btn btn-outline-ak-danger"
              onClick={() => {
                setBlockReason("");
                setBlockOpen(true);
              }}
            >
              Block
            </button>
          ) : null}
          {user.is_blocked ? (
            <button
              type="button"
              className="btn btn-ak-primary"
              disabled={actionLoading}
              onClick={() => onUnblockUser?.(user.id)}
            >
              Unblock
            </button>
          ) : null}
        </div>
      </div>

      <div className="row g-4 admin-detail-grid">
        <div className="col-lg-5">
          <Card title="Profile" subtitle="User information">
            <div className="row g-3">
              <div className="col-12">
                <div className="kv-row">
                  <span className="kv-label">Name</span>
                  <span className="kv-value">{user.name || "-"}</span>
                </div>
              </div>
              <div className="col-12">
                <div className="kv-row">
                  <span className="kv-label">Email</span>
                  <span className="kv-value">{user.email || "-"}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="kv-row">
                  <span className="kv-label">Phone</span>
                  <span className="kv-value">{user.phone_number || "-"}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="kv-row">
                  <span className="kv-label">Profession</span>
                  <span className="kv-value">{user.profession || "-"}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="kv-row">
                  <span className="kv-label">Coins</span>
                  <span className="kv-value">{Number.isFinite(user.coins) ? user.coins : 0}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="kv-row">
                  <span className="kv-label">Status</span>
                  <span className="kv-value">{user.is_blocked ? "Blocked" : "Active"}</span>
                </div>
              </div>
              <div className="col-12">
                <div className="kv-row">
                  <span className="kv-label">User ID</span>
                  <span className="kv-value">{user.id}</span>
                </div>
              </div>
              <div className="col-12">
                <div className="kv-row">
                  <span className="kv-label">Created</span>
                  <span className="kv-value">{formatDateTime(user.created_at)}</span>
                </div>
              </div>
              {user.is_blocked ? (
                <div className="col-12">
                  <div className="kv-row">
                    <span className="kv-label">Block reason</span>
                    <span className="kv-value">{user.block_reason || "-"}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="col-lg-7">
          <Card title="Performance" subtitle="Recent overview">
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <div className="mini-stat-card">
                  <small>Total Tests</small>
                  <strong>{performance?.totalTests || 0}</strong>
                </div>
              </div>
              <div className="col-md-4">
                <div className="mini-stat-card">
                  <small>Average Score</small>
                  <strong>{performance?.averageScore || 0}%</strong>
                </div>
              </div>
              <div className="col-md-4">
                <div className="mini-stat-card">
                  <small>Weak Topics</small>
                  <strong>{performance?.weakestTopics?.join(", ") || "None"}</strong>
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
                <div className="d-grid gap-2">
                  <button
                    className="btn btn-ak-primary"
                    type="button"
                    onClick={() => onGrantCoins?.(user.id)}
                    disabled={actionLoading}
                  >
                    Add Coins
                  </button>
                  <button
                    className="btn btn-outline-ak-danger"
                    type="button"
                    onClick={() => onRevokeCoins?.(user.id)}
                    disabled={actionLoading}
                  >
                    Revoke Coins
                  </button>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4 mb-2">
              <div>
                <h6 className="fw-bold mb-0">Recent Tests</h6>
                <small className="text-muted">Latest attempts</small>
              </div>
              <small className="text-muted">
                {performance?.recentTests?.length ? `${performance.recentTests.length} items` : ""}
              </small>
            </div>

            <div className="admin-recent-tests">
              {performance?.recentTests?.length ? (
                performance.recentTests.map((test) => (
                  <div className="admin-test-row" key={test.id}>
                    <div>
                      <strong>{test.topic}</strong>
                      <div className="text-muted small">{new Date(test.date).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <small>Difficulty</small>
                      <div className="fw-bold text-capitalize">{test.difficulty}</div>
                    </div>
                    <div>
                      <small>Score</small>
                      <div className="fw-bold">{test.score || 0}%</div>
                    </div>
                    <div className="text-muted small d-none d-md-block">{new Date(test.date).toLocaleString()}</div>
                  </div>
                ))
              ) : (
                <p className="text-muted mb-0">{performance ? "No tests found." : "Loading performance..."}</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {blockOpen && !user.is_blocked ? (
        <>
          <button
            type="button"
            className="modal-backdrop-ak"
            aria-label="Close block form"
            onClick={() => setBlockOpen(false)}
          />
          <div className="modal-card-ak modal-ak-tight" role="dialog" aria-modal="true">
            <div className="ak-card modal-ak-compact" style={{ width: "min(640px, 94vw)" }}>
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
                  value={blockReason}
                  onChange={(event) => setBlockReason(event.target.value)}
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
                  className="btn btn-outline-ak-danger"
                  disabled={actionLoading || !blockReason.trim()}
                  onClick={async () => {
                    await onBlockUser?.(user.id, blockReason);
                    setBlockOpen(false);
                    setBlockReason("");
                  }}
                >
                  Block Now
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {deleteOpen ? (
        <>
          <button
            type="button"
            className="modal-backdrop-ak"
            aria-label="Close delete confirmation"
            onClick={() => setDeleteOpen(false)}
          />
          <div className="modal-card-ak modal-ak-tight" role="dialog" aria-modal="true">
            <div className="ak-card modal-ak-compact" style={{ width: "min(680px, 94vw)" }}>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h5 className="fw-bold mb-1">Delete User</h5>
                  <p className="text-muted mb-0">This action permanently deletes the user and their data.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-ak btn-sm"
                  onClick={() => setDeleteOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="ak-callout ak-callout-danger mb-3">
                <strong>Warning:</strong> Deleting <strong>{user.name || user.email || user.id}</strong> will remove:
                <ul className="mb-0 mt-2">
                  <li>All tests, questions, and answers</li>
                  <li>Coin requests and unblock requests</li>
                  <li>Offers and notifications</li>
                  <li>Feedback and onboarding data</li>
                </ul>
              </div>

              <div className="field-shell mb-3">
                <input
                  className="form-control create-input"
                  value={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.value)}
                  placeholder={`Type ${user.email || user.id} to confirm`}
                />
              </div>

              <div className="d-flex gap-2 justify-content-end flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-ak"
                  onClick={() => setDeleteOpen(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-outline-ak-danger"
                  disabled={
                    actionLoading ||
                    String(deleteConfirm || "").trim() !== String(user.email || user.id).trim()
                  }
                  onClick={async () => {
                    await onDeleteUser?.(user.id);
                    setDeleteOpen(false);
                    setDeleteConfirm("");
                    navigate("/admin/users");
                  }}
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
