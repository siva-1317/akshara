import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getReview } from "../api";
import Card from "../components/Card";
import { useToast } from "../components/ToastProvider";

const formatExplanation = (text = "") => {
  const numberedParts = Array.from(
    text.matchAll(/\d+\.\s[\s\S]*?(?=(?:\s+\d+\.\s)|$)/g),
    (match) => match[0].trim()
  ).filter((part) => part.length > 2);

  if (numberedParts.length > 1) {
    return numberedParts;
  }

  return text
    .split(/(?<=[.?!])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter((part) => part && !/^\d+\.?$/.test(part));
};

export default function Review() {
  const { testId } = useParams();
  const toast = useToast();
  const [review, setReview] = useState(null);
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
    const loadReview = async () => {
      try {
        setLoading(true);
        const { data } = await getReview(testId);
        setReview(data);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load review.");
      } finally {
        setLoading(false);
      }
    };

    loadReview();
  }, [testId]);

  return (
    <div className="page-shell review-page">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
          <div>
            <h2 className="section-title mb-1">Review Test</h2>
            <p className="text-muted mb-0">
              {review?.test?.topic} | Score {review?.test?.score || 0}%
            </p>
          </div>
        </div>

        {loading ? <p>Loading review...</p> : null}

        <div className="row g-4">
          {review?.questions?.map((question, index) => (
            <div className="col-12" key={question.id}>
              <Card title={`Question ${index + 1}`} subtitle={question.question} className="review-card">
                <div className="review-answer-block">
                  <p className="mb-2">
                    <strong>User Answer:</strong> {question.user_answer || "Not answered"}
                  </p>
                  <p className="mb-0">
                    <strong>Correct Answer:</strong> {question.answer}
                  </p>
                </div>
                <div className="review-explanation-panel mt-4">
                  <p className="mb-1 review-explanation-title">Explanation</p>
                  <div className="review-explanation-list">
                    {formatExplanation(question.explanation).map((item, itemIndex) => (
                      <div className="review-explanation-row" key={`${question.id}-${itemIndex}`}>
                        <span className="review-step-badge">{itemIndex + 1}</span>
                        <p className="mb-0">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
