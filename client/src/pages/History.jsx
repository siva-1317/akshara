import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHistory } from "../api";
import { useToast } from "../components/ToastProvider";

export default function History() {
  const user = JSON.parse(localStorage.getItem("aksharaUser") || "null");
  const toast = useToast();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!error) {
      return;
    }
    toast.error(error);
    setError("");
  }, [error, toast]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const { data } = await getHistory(user?.id);
        setTests(data.tests || []);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load history.");
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      loadHistory();
    }
  }, [user?.id]);

  return (
    <div className="page-shell">
      <div className="container">
        <div className="ak-card">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
            <div>
              <h2 className="fw-bold mb-1">Test History</h2>
              <p className="text-muted mb-0">Review all tests, topics, and performance.</p>
            </div>
            <Link to="/create-test" className="btn btn-ak-primary">
              New Test
            </Link>
          </div>

          {loading ? <p className="mb-0">Loading history...</p> : null}

          {!loading ? (
            <div className="table-responsive">
              <table className="table table-ak align-middle">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Difficulty</th>
                    <th>Score</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.length ? (
                    tests.map((test) => (
                      <tr key={test.id}>
                        <td>{test.topic}</td>
                        <td className="text-capitalize">{test.difficulty}</td>
                        <td>{test.score || 0}%</td>
                        <td>{new Date(test.date).toLocaleString()}</td>
                        <td>
                          <Link className="btn btn-sm btn-outline-ak" to={`/review/${test.id}`}>
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        No test history available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
