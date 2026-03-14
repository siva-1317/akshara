import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import Pagination from "../../components/Pagination";

const clampPage = (value, totalPages) => Math.max(1, Math.min(Number(value) || 1, totalPages));

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
};

export default function AdminFeedbacks({
  feedbacks,
  onMarkReviewed,
  onClear,
  onClearReviewedOlderThan,
  actionLoading
}) {
  const [tab, setTab] = useState("pending");
  const [clearDays, setClearDays] = useState(30);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const pending = useMemo(() => (feedbacks || []).filter((item) => !item.reviewed_at), [feedbacks]);
  const reviewed = useMemo(() => (feedbacks || []).filter((item) => item.reviewed_at), [feedbacks]);

  const list = tab === "pending" ? pending : reviewed;

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = clampPage(page, totalPages);
  const pagedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [currentPage, list]);

  // Keep state in sync when list size changes (e.g., clearing feedbacks).
  // Avoids rendering a clamped page number while the internal state is out of range.
  useEffect(() => {
    if (page !== currentPage) {
      setPage(currentPage);
    }
  }, [currentPage, page]);

  const switchTab = (next) => {
    setTab(next);
    setPage(1);
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h2 className="section-title mb-1">User Feedbacks</h2>
          <p className="text-muted mb-0">Review user feedback, mark it reviewed, and clear old items.</p>
        </div>
      </div>

      <div className="admin-tabs mb-3">
        <button
          type="button"
          className={`admin-tab-btn ${tab === "pending" ? "active" : ""}`}
          onClick={() => switchTab("pending")}
        >
          Pending ({pending.length})
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${tab === "reviewed" ? "active" : ""}`}
          onClick={() => switchTab("reviewed")}
        >
          Reviewed ({reviewed.length})
        </button>
      </div>

      <Card
        title={tab === "pending" ? "Pending feedback" : "Reviewed feedback"}
        subtitle={
          tab === "pending"
            ? "Mark feedback as reviewed once handled."
            : "Clear reviewed feedback older than a chosen period."
        }
      >
        {tab === "reviewed" ? (
          <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
            <div className="field-shell" style={{ maxWidth: 220 }}>
              <label className="form-label mb-1">Clear reviewed older than (days)</label>
              <input
                className="form-control create-input"
                type="number"
                min="1"
                value={clearDays}
                onChange={(event) => setClearDays(Number(event.target.value))}
              />
            </div>
            <button
              type="button"
              className="btn btn-outline-danger"
              disabled={actionLoading || reviewed.length === 0}
              onClick={() => onClearReviewedOlderThan?.(clearDays)}
            >
              {actionLoading ? "Clearing..." : "Clear old reviewed"}
            </button>
          </div>
        ) : null}

        <div className="d-grid gap-3">
          {pagedList.length ? (
            pagedList.map((item) => (
              <div className="suggestion-card" key={item.id}>
                <div className="flex-grow-1">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <strong>{item.submitter?.name || item.user_id}</strong>
                    {item.submitter?.email ? (
                      <span className="text-muted small">{item.submitter.email}</span>
                    ) : null}
                    <span className="badge text-bg-light text-capitalize">{item.category || "feedback"}</span>
                    <span className="text-muted small ms-auto">Created: {formatDate(item.created_at)}</span>
                  </div>
                  <p className="mb-2 text-muted">{item.message}</p>
                  <small className="text-muted">
                    Status: {item.reviewed_at ? `Reviewed (${formatDate(item.reviewed_at)})` : "Pending"}
                  </small>
                </div>

                <div className="d-flex flex-column flex-sm-row gap-2">
                  {!item.reviewed_at ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-ak-primary"
                      disabled={actionLoading}
                      onClick={() => onMarkReviewed?.(item.id)}
                    >
                      {actionLoading ? "Updating..." : "Mark reviewed"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    disabled={actionLoading}
                    onClick={() => onClear?.(item.id)}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted mb-0">
              {tab === "pending" ? "No pending feedback yet." : "No reviewed feedback yet."}
            </p>
          )}
        </div>

        <Pagination
          className="mt-3"
          page={currentPage}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      </Card>
    </>
  );
}
