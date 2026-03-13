import { useMemo, useState } from "react";
import Card from "../../components/Card";

export default function AdminRequests({
  requests,
  coinRequests,
  onApproveUnblock,
  onRejectUnblock,
  onApproveCoins,
  onRejectCoins,
  actionLoading
}) {
  const [tab, setTab] = useState("unblock");
  const [unblockNote, setUnblockNote] = useState("");
  const [coinNote, setCoinNote] = useState("");

  const pendingUnblocks = useMemo(
    () => (requests || []).filter((item) => item.status === "pending"),
    [requests]
  );

  const pendingCoins = useMemo(
    () => (coinRequests || []).filter((item) => item.status === "pending"),
    [coinRequests]
  );

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h2 className="section-title mb-1">Requests</h2>
          <p className="text-muted mb-0">Approve unblock and coin requests.</p>
        </div>
      </div>

      <div className="admin-tabs mb-3">
        <button
          type="button"
          className={`admin-tab-btn ${tab === "unblock" ? "active" : ""}`}
          onClick={() => setTab("unblock")}
        >
          Unblock Requests ({pendingUnblocks.length})
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${tab === "coins" ? "active" : ""}`}
          onClick={() => setTab("coins")}
        >
          Coin Requests ({pendingCoins.length})
        </button>
      </div>

      {tab === "unblock" ? (
        <Card title="Unblock Requests" subtitle="Approve or reject user unblock requests">
          <div className="field-shell mb-3">
            <textarea
              className="form-control create-input unblock-textarea"
              placeholder="Reason/note for approving or rejecting"
              value={unblockNote}
              onChange={(event) => setUnblockNote(event.target.value)}
              rows="2"
            />
          </div>
          <div className="d-grid gap-3">
            {(requests || []).length ? (
              (requests || []).map((request) => (
                <div className="suggestion-card" key={request.id}>
                  <div className="flex-grow-1">
                    <strong>{request.users?.name || request.user_id}</strong>
                    <p className="mb-2 text-muted">{request.reason}</p>
                    <small className="text-muted text-capitalize">{request.status}</small>
                    {request.admin_note ? (
                      <p className="mb-0 text-muted small">Admin note: {request.admin_note}</p>
                    ) : null}
                  </div>
                  {request.status === "pending" ? (
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-outline-danger"
                        disabled={actionLoading}
                        onClick={() => onRejectUnblock?.(request.id, unblockNote)}
                      >
                        Reject
                      </button>
                      <button
                        className="btn btn-sm btn-ak-primary"
                        disabled={actionLoading}
                        onClick={() => onApproveUnblock?.(request.user_id, request.id, unblockNote)}
                      >
                        Approve
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-muted mb-0">No unblock requests yet.</p>
            )}
          </div>
        </Card>
      ) : (
        <Card title="Coin Requests" subtitle="Approve or reject requested coins">
          <div className="field-shell mb-3">
            <textarea
              className="form-control create-input unblock-textarea"
              placeholder="Optional admin note for coin decisions"
              value={coinNote}
              onChange={(event) => setCoinNote(event.target.value)}
              rows="2"
            />
          </div>
          <div className="d-grid gap-3">
            {(coinRequests || []).length ? (
              (coinRequests || []).map((request) => (
                <div className="suggestion-card" key={request.id}>
                  <div className="flex-grow-1">
                    <strong>{request.users?.name || request.user_id}</strong>
                    <p className="mb-1 text-muted">
                      Requested: <strong>{request.requested_coins}</strong> coins
                    </p>
                    {request.reason ? <p className="mb-2 text-muted">{request.reason}</p> : null}
                    <small className="text-muted text-capitalize">{request.status}</small>
                    {request.admin_note ? (
                      <p className="mb-0 text-muted small">Admin note: {request.admin_note}</p>
                    ) : null}
                  </div>
                  {request.status === "pending" ? (
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-outline-danger"
                        disabled={actionLoading}
                        onClick={() => onRejectCoins?.(request.id, coinNote)}
                      >
                        Reject
                      </button>
                      <button
                        className="btn btn-sm btn-ak-primary"
                        disabled={actionLoading}
                        onClick={() => onApproveCoins?.(request.id, coinNote)}
                      >
                        Approve
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-muted mb-0">No coin requests yet.</p>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
