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

const formatDateTimeCompact = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
};

const formatDuration = (startIso, endIso) => {
  if (!startIso || !endIso) {
    return "-";
  }

  const start = new Date(startIso);
  const end = new Date(endIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "-";
  }

  const deltaMs = Math.max(0, end.getTime() - start.getTime());
  const deltaMinutes = Math.round(deltaMs / (60 * 1000));

  if (deltaMinutes < 60) {
    return `${deltaMinutes} min`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 48) {
    return `${deltaHours} hr`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays} day${deltaDays === 1 ? "" : "s"}`;
};

const CancelIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="mini-icon">
    <path
      d="M6 6 18 18M18 6 6 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default function AdminUserDetails({
  users,
  selectedPerformance,
  onSelectUser,
  onBlockUser,
  onUnblockUser,
  onDeleteUser,
  onCancelOffer,
  grantCoins,
  onGrantCoinsChange,
  onGrantCoins,
  onRevokeCoins,
  actionLoading
}) {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [cancelOfferOpen, setCancelOfferOpen] = useState(false);
  const [cancelOfferId, setCancelOfferId] = useState("");
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
  const activeOffers = performance?.activeOffers || [];
  const certificates = performance?.certificates || [];
  const coinBonuses = performance?.coinBonuses || [];
  const bonusCoinsEarned = Number(performance?.bonusCoinsEarned) || 0;
  const recentBonusEvents = useMemo(
    () =>
      (coinBonuses || [])
        .filter((row) => (Number(row?.coins_awarded) || 0) > 0)
        .slice(0, 6),
    [coinBonuses]
  );
  const cancelOffer = useMemo(
    () => (activeOffers || []).find((offer) => offer.id === cancelOfferId) || null,
    [activeOffers, cancelOfferId]
  );

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
          <div className="d-grid gap-4">
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

            <Card title="Current Offers" subtitle="Offers running right now for this user">
              {performance ? (
                activeOffers.length ? (
                  <div className="d-grid gap-2">
                    {activeOffers.slice(0, 6).map((offer) => (
                      <div className="ak-info-row ak-offer-item" key={offer.id}>
                        <button
                          type="button"
                          className="ak-icon-btn danger ak-offer-cancel"
                          title="Cancel offer"
                          aria-label="Cancel offer"
                          disabled={actionLoading}
                          onClick={() => {
                            setCancelOfferId(offer.id);
                            setCancelOfferOpen(true);
                          }}
                        >
                          <CancelIcon />
                        </button>
                        <div className="ak-info-main">
                          <div className="ak-info-title-row">
                            <div className="ak-info-title text-capitalize">
                              {String(offer.offer_type || "offer").replace(/_/g, " ")}
                            </div>
                          </div>
                          <div className="ak-offer-time">
                            <span className="ak-date-pill">
                              <span className="ak-date-pill-label">Starts</span>
                              <span className="ak-date-pill-value">{formatDateTimeCompact(offer.starts_at)}</span>
                            </span>
                            <span className="ak-date-arrow" aria-hidden="true">
                              →
                            </span>
                            <span className="ak-date-pill">
                              <span className="ak-date-pill-label">Ends</span>
                              <span className="ak-date-pill-value">
                                {offer.ends_at ? formatDateTimeCompact(offer.ends_at) : "—"}
                              </span>
                            </span>
                          </div>
                          <div className="ak-offer-dates">
                            <div className="ak-offer-date">
                              <span className="ak-meta-label">Starts</span>
                              <span className="ak-meta-value">{formatDateTime(offer.starts_at)}</span>
                            </div>
                            <div className="ak-offer-date">
                              <span className="ak-meta-label">Ends</span>
                              <span className="ak-meta-value">
                                {offer.ends_at ? formatDateTime(offer.ends_at) : "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ak-info-meta">
                          <div className="ak-meta-item">
                            <span className="ak-meta-label">Duration</span>
                            <span className="ak-meta-value">
                              {offer.ends_at ? formatDuration(offer.starts_at, offer.ends_at) : "—"}
                            </span>
                          </div>
                          <div className="ak-meta-item">
                            <span className="ak-meta-label">Questions</span>
                            <span className="ak-meta-value">{offer.fixed_question_count ?? "-"}</span>
                          </div>
                          <div className="ak-meta-item">
                            <span className="ak-meta-label">Difficulty</span>
                            <span className="ak-meta-value text-capitalize">{offer.fixed_difficulty || "-"}</span>
                          </div>
                          <div className="ak-meta-item">
                            <span className="ak-meta-label">Exam</span>
                            <span className="ak-meta-value">{offer.fixed_exam_type || "-"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted mb-0">No active offers.</p>
                )
              ) : (
                <p className="text-muted mb-0">Loading offers...</p>
              )}
            </Card>

            <Card title="Certificates & Bonuses" subtitle="Claimed certificates and coin bonuses">
              {performance ? (
                <>
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <small className="text-muted mb-0">Certificates claimed</small>
                    <small className="text-muted mb-0">
                      {certificates.length ? `${certificates.length} items` : ""}
                    </small>
                  </div>

                  {certificates.length ? (
                    <div className="d-grid gap-2 mb-3">
                      {certificates.slice(0, 6).map((cert) => {
                        const publishedTitle = cert?.published_tests?.title;
                        const certTitle =
                          cert?.certificate_data?.testTitle || publishedTitle || cert?.certificate_data?.title;

                        return (
                          <div className="ak-info-row" key={cert.id}>
                            <div className="ak-info-main">
                              <div className="ak-info-title">{certTitle || "Certificate"}</div>
                              <div className="ak-info-sub text-muted">Issued: {formatDateTime(cert.issued_at)}</div>
                            </div>
                            <div className="ak-info-meta">
                              <div className="ak-meta-item">
                                <span className="ak-meta-label">Topic</span>
                                <span className="ak-meta-value">{cert?.published_tests?.topic || "-"}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted mb-3">No certificates claimed.</p>
                  )}

                  <div className="ak-summary-row mb-2">
                    <small className="text-muted mb-0">Bonus coins earned</small>
                    <strong className="mb-0">{bonusCoinsEarned}</strong>
                  </div>

                  {recentBonusEvents.length ? (
                    <div className="d-grid gap-2">
                      {recentBonusEvents.map((row) => (
                        <div className="ak-info-row" key={row.id}>
                          <div className="ak-info-main">
                            <div className="ak-info-title">{row?.published_tests?.title || "Task completion"}</div>
                            <div className="ak-info-sub text-muted">{formatDateTime(row.completed_at)}</div>
                          </div>
                          <div className="ak-info-meta">
                            <div className="ak-meta-item">
                              <span className="ak-meta-label">Coins</span>
                              <span className="ak-meta-value">{Number(row.coins_awarded) || 0}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted mb-0">No coin bonuses yet.</p>
                  )}
                </>
              ) : (
                <p className="text-muted mb-0">Loading certificates and bonuses...</p>
              )}
            </Card>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="d-grid gap-4">
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
                <div className="col-md-4">
                  <div className="mini-stat-card">
                    <small>Active Offers</small>
                    <strong>{performance ? activeOffers.length : "-"}</strong>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mini-stat-card">
                    <small>Certificates</small>
                    <strong>{performance ? certificates.length : "-"}</strong>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="mini-stat-card">
                    <small>Bonus Coins</small>
                    <strong>{performance ? bonusCoinsEarned : "-"}</strong>
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-8">
                  <label className="form-label create-label mb-2">Grant / Revoke Coins</label>
                  <div className="field-shell">
                    <input
                      type="number"
                      min="1"
                      className="form-control create-input"
                      value={grantCoins}
                      onChange={(event) => onGrantCoinsChange?.(event.target.value)}
                      placeholder="Coins amount"
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

            </Card>

            <Card title="Recent Tests" subtitle="Latest attempts">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                <small className="text-muted mb-0">{performance ? "" : "Loading..."}</small>
                <small className="text-muted mb-0">
                  {performance?.recentTests?.length ? `${performance.recentTests.length} items` : ""}
                </small>
              </div>
              <div className="admin-scroll-area d-grid gap-2">
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
                      <div className="text-muted small d-none d-md-block">
                        {new Date(test.date).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted mb-0">{performance ? "No tests found." : "Loading tests..."}</p>
                )}
              </div>
            </Card>

            {/* <Card title="Current Offers" subtitle="Offers running right now for this user">
              {performance ? (
                activeOffers.length ? (
                  <div className="d-grid gap-2">
                    {activeOffers.slice(0, 6).map((offer) => (
                      <div className="admin-test-row" key={offer.id}>
                        <div>
                          <strong className="text-capitalize">{offer.offer_type || "offer"}</strong>
                          <div className="text-muted small">
                            {formatDateTime(offer.starts_at)}
                            {offer.ends_at ? ` → ${formatDateTime(offer.ends_at)}` : ""}
                          </div>
                        </div>
                        <div>
                          <small>Questions</small>
                          <div className="fw-bold">{offer.fixed_question_count ?? "-"}</div>
                        </div>
                        <div>
                          <small>Difficulty</small>
                          <div className="fw-bold text-capitalize">{offer.fixed_difficulty || "-"}</div>
                        </div>
                        <div className="text-muted small d-none d-md-block">Exam: {offer.fixed_exam_type || "-"}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted mb-0">No active offers.</p>
                )
              ) : (
                <p className="text-muted mb-0">Loading offers...</p>
              )}
            </Card>

            <Card title="Certificates & Bonuses" subtitle="Claimed certificates and coin bonuses">
              {performance ? (
                <>
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <small className="text-muted mb-0">Certificates claimed</small>
                    <small className="text-muted mb-0">{certificates.length ? `${certificates.length} items` : ""}</small>
                  </div>

                  {certificates.length ? (
                    <div className="d-grid gap-2 mb-3">
                      {certificates.slice(0, 6).map((cert) => {
                        const publishedTitle = cert?.published_tests?.title;
                        const certTitle =
                          cert?.certificate_data?.testTitle || publishedTitle || cert?.certificate_data?.title;

                        return (
                          <div className="admin-test-row" key={cert.id}>
                            <div>
                              <strong>{certTitle || "Certificate"}</strong>
                              <div className="text-muted small">Issued: {formatDateTime(cert.issued_at)}</div>
                            </div>
                            <div className="text-muted small d-none d-md-block">
                              {cert?.published_tests?.topic ? `Topic: ${cert.published_tests.topic}` : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted mb-3">No certificates claimed.</p>
                  )}

                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <small className="text-muted mb-0">Bonus coins earned</small>
                    <strong className="mb-0">{bonusCoinsEarned}</strong>
                  </div>

                  {recentBonusEvents.length ? (
                    <div className="d-grid gap-2">
                      {recentBonusEvents.map((row) => (
                        <div className="admin-test-row" key={row.id}>
                          <div>
                            <strong>{row?.published_tests?.title || "Task completion"}</strong>
                            <div className="text-muted small">{formatDateTime(row.completed_at)}</div>
                          </div>
                          <div>
                            <small>Coins</small>
                            <div className="fw-bold">{Number(row.coins_awarded) || 0}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted mb-0">No coin bonuses yet.</p>
                  )}
                </>
              ) : (
                <p className="text-muted mb-0">Loading certificates and bonuses...</p>
              )}
            </Card> */}
          </div>
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

      {cancelOfferOpen ? (
        <>
          <button
            type="button"
            className="modal-backdrop-ak"
            aria-label="Close offer cancellation"
            onClick={() => setCancelOfferOpen(false)}
          />
          <div className="modal-card-ak modal-ak-tight" role="dialog" aria-modal="true">
            <div className="ak-card modal-ak-compact" style={{ width: "min(560px, 94vw)" }}>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h5 className="fw-bold mb-1">Cancel Offer</h5>
                  <p className="text-muted mb-0">This ends the active offer immediately.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-ak btn-sm"
                  onClick={() => setCancelOfferOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="ak-callout ak-callout-danger mb-3">
                <strong>Offer:</strong>{" "}
                <span className="text-capitalize">
                  {String(cancelOffer?.offer_type || "offer").replace(/_/g, " ")}
                </span>
                <div className="text-muted small mt-2">
                  Starts: {formatDateTime(cancelOffer?.starts_at)}{" "}
                  {cancelOffer?.ends_at ? `• Ends: ${formatDateTime(cancelOffer.ends_at)}` : ""}
                </div>
              </div>

              <div className="d-flex gap-2 justify-content-end flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-ak"
                  onClick={() => setCancelOfferOpen(false)}
                  disabled={actionLoading}
                >
                  Keep Offer
                </button>
                <button
                  type="button"
                  className="btn btn-outline-ak-danger"
                  disabled={actionLoading || !cancelOfferId}
                  onClick={async () => {
                    await onCancelOffer?.(cancelOfferId);
                    setCancelOfferOpen(false);
                    setCancelOfferId("");
                  }}
                >
                  Cancel Offer
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
