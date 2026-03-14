import Card from "../components/Card";

const getStoredUser = () => JSON.parse(localStorage.getItem("aksharaUser") || "null");

export default function Waiting() {
  const user = getStoredUser();
  const status = String(user?.approvalStatus || "approved").toLowerCase();
  const rejected = status === "rejected";

  return (
    <div className="page-shell">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-7">
            <Card
              title={rejected ? "Access request rejected" : "Waiting for admin approval"}
              subtitle={rejected ? "Your account is not approved." : "Your account is pending approval."}
              className="h-auto"
            >
              <p className="text-muted mb-3">
                {rejected
                  ? "Your AKSHARA access request was rejected. If you think this is a mistake, contact the admin."
                  : "Thanks for signing up. An admin needs to approve your account before you can access the dashboard, tests, and tasks."}
              </p>

              <div className="d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-ak"
                  onClick={() => window.location.reload()}
                >
                  Refresh status
                </button>
                <button
                  type="button"
                  className="btn btn-outline-ak-danger"
                  onClick={() => {
                    localStorage.removeItem("aksharaUser");
                    window.location.href = "/login";
                  }}
                >
                  Logout
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

