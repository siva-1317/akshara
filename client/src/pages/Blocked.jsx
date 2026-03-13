import { useState } from "react";
import { submitUnblockRequest } from "../api";

export default function Blocked() {
  const user = JSON.parse(localStorage.getItem("aksharaUser") || "null");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      setMessage("");
      await submitUnblockRequest({
        userId: user?.id,
        reason
      });
      setReason("");
      setMessage("Your unblock request has been sent to admin.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send unblock request.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("aksharaUser");
    window.location.href = "/login";
  };

  return (
    <div className="page-shell blocked-page">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-7">
            <div className="ak-card blocked-card">
              <span className="status-pill mb-3">Access Restricted</span>
              <h2 className="section-title mb-3">An admin has blocked your account</h2>
              <p className="text-muted mb-4">
                Reason from admin: <strong>{user?.blockReason || "No reason was provided."}</strong>
              </p>

              <form onSubmit={handleSubmit} className="blocked-form">
                <label className="form-label create-label">Request Unblock</label>
                <div className="field-shell mb-3">
                  <textarea
                    className="form-control create-input unblock-textarea"
                    rows="5"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain why your account should be unblocked."
                    required
                  />
                </div>
                <div className="d-flex flex-wrap gap-3">
                  <button className="btn btn-ak-primary" disabled={loading}>
                    {loading ? "Sending Request..." : "Request Unblock"}
                  </button>
                  <button type="button" className="btn btn-outline-ak" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </form>

              {message ? <div className="alert alert-success mt-4 mb-0">{message}</div> : null}
              {error ? <div className="alert alert-danger mt-4 mb-0">{error}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
