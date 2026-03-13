import Card from "../../components/Card";

export default function AdminDashboard({
  users,
  tests,
  requests,
  coinRequests,
  notifications,
  onDeleteTest
}) {
  const pendingCount =
    (requests || []).filter((item) => item.status === "pending").length +
    (coinRequests || []).filter((item) => item.status === "pending").length;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h2 className="section-title mb-1">Admin Dashboard</h2>
          <p className="text-muted mb-0">
            Monitor users, review requests, moderate accounts, and track platform activity.
          </p>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-3">
          <Card title="Users">
            <div className="metric-value">{(users || []).length}</div>
            <p className="text-muted mb-0">Registered accounts</p>
          </Card>
        </div>
        <div className="col-lg-3">
          <Card title="Overall Tests">
            <div className="metric-value">{(tests || []).length}</div>
            <p className="text-muted mb-0">Attempts across all users</p>
          </Card>
        </div>
        <div className="col-lg-3">
          <Card title="Pending Requests">
            <div className="metric-value">{pendingCount}</div>
            <p className="text-muted mb-0">Waiting for admin review</p>
          </Card>
        </div>
        <div className="col-lg-3">
          <Card title="Notifications">
            <div className="metric-value">{(notifications || []).length}</div>
            <p className="text-muted mb-0">Latest activity alerts</p>
          </Card>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12">
          <Card title="All Tests" subtitle="Delete tests or inspect recent activity">
            <div className="table-responsive">
              <table className="table table-ak align-middle">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>User</th>
                    <th>Difficulty</th>
                    <th>Score</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(tests || []).length ? (
                    (tests || []).map((test) => (
                      <tr key={test.id}>
                        <td>{test.topic}</td>
                        <td>{test.users?.name || test.user_id}</td>
                        <td className="text-capitalize">{test.difficulty}</td>
                        <td>{test.score || 0}%</td>
                        <td>{new Date(test.date).toLocaleString()}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => onDeleteTest?.(test.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center text-muted py-4">
                        No tests available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

