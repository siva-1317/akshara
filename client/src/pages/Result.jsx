import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getReview } from "../api";
import Card from "../components/Card";

export default function Result() {
  const { testId } = useParams();
  const location = useLocation();
  const [result, setResult] = useState(location.state?.result || null);

  useEffect(() => {
    const loadResult = async () => {
      if (result) {
        return;
      }

      try {
        const { data } = await getReview(testId);
        setResult({
          score: data.test?.score || 0,
          weakTopics: data.test?.weak_topics || [],
          explanation: data.test?.evaluation_explanation || "Review the detailed breakdown below."
        });
      } catch (err) {
        console.error(err);
      }
    };

    loadResult();
  }, [result, testId]);

  return (
    <div className="page-shell">
      <div className="container">
        <div className="row g-4">
          <div className="col-md-4">
            <Card title="Score">
              <div className="metric-value">{result?.score || 0}%</div>
            </Card>
          </div>
          <div className="col-md-4">
            <Card title="Weak Topics">
              <p className="mb-0">{result?.weakTopics?.join(", ") || "No weak topics detected"}</p>
            </Card>
          </div>
          <div className="col-md-4">
            <Card title="AI Evaluation">
              <p className="mb-0">{result?.explanation || "Evaluation complete."}</p>
            </Card>
          </div>
        </div>

        <div className="ak-card mt-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h4 className="fw-bold mb-1">Review your answers</h4>
            <p className="text-muted mb-0">
              Dive into explanations and compare your response with the correct answer.
            </p>
          </div>
          <div className="d-flex gap-2">
            <Link className="btn btn-outline-ak" to="/history">
              History
            </Link>
            <Link className="btn btn-ak-primary" to={`/review/${testId}`}>
              Open Review
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
