import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTest, submitTest } from "../api";

const formatSeconds = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function TestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("aksharaUser") || "null");
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const submitLock = useRef(false);

  useEffect(() => {
    const loadTest = async () => {
      try {
        setLoading(true);
        const { data } = await getTest(testId);
        const loadedTest = data.test;
        setTest(loadedTest);
        if (loadedTest.exam_type === "per question timer") {
          const perQuestionTime = Math.max(
            Math.floor(((loadedTest.total_time || loadedTest.time || 1) * 60) / loadedTest.questions.length),
            1
          );
          setTimeLeft(perQuestionTime);
        } else {
          setTimeLeft((loadedTest.total_time || loadedTest.time || 1) * 60);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load test.");
      } finally {
        setLoading(false);
      }
    };

    loadTest();
  }, [testId]);

  const handleSubmit = async () => {
    if (submitLock.current) {
      return;
    }

    try {
      submitLock.current = true;
      const payload = {
        testId,
        userId: user?.id,
        answers: Object.entries(answers).map(([questionId, userAnswer]) => ({
          questionId,
          userAnswer
        }))
      };
      const { data } = await submitTest(payload);
      navigate(`/result/${testId}`, { state: { result: data.result } });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to submit test.");
      submitLock.current = false;
    }
  };

  useEffect(() => {
    if (!test || timeLeft <= 0) {
      return undefined;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [test, timeLeft]);

  const currentQuestion = useMemo(() => test?.questions?.[currentIndex] || null, [test, currentIndex]);

  const chooseAnswer = (option) => {
    setAnswers((current) => ({
      ...current,
      [currentQuestion.id]: option
    }));
  };

  const resetPerQuestionTime = () => {
    if (test?.exam_type === "per question timer") {
      const perQuestionTime = Math.max(
        Math.floor(((test.total_time || test.time || 1) * 60) / test.questions.length),
        1
      );
      setTimeLeft(perQuestionTime);
    }
  };

  const handleNext = () => {
    if (currentIndex < test.questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      resetPerQuestionTime();
    }
  };

  const handlePrevious = () => {
    if (test.exam_type === "no return") {
      return;
    }
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      resetPerQuestionTime();
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <div className="container">
          <p>Loading test...</p>
        </div>
      </div>
    );
  }

  if (!test || error) {
    return (
      <div className="page-shell">
        <div className="container">
          <div className="alert alert-danger">{error || "Test not found."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
          <div>
            <h2 className="section-title mb-1">{test.topic} Test</h2>
            <p className="text-muted mb-0 text-capitalize">
              {test.difficulty} • {test.exam_type}
            </p>
          </div>
          <div className="timer-badge">Time Left: {formatSeconds(timeLeft)}</div>
        </div>

        <div className="question-panel p-4">
          <div className="d-flex justify-content-between mb-3">
            <span className="status-pill">
              Question {currentIndex + 1} / {test.questions.length}
            </span>
            <span className="status-pill text-capitalize">{currentQuestion?.difficulty}</span>
          </div>

          <h4 className="fw-bold mb-4">{currentQuestion?.question}</h4>

          <div className="d-grid gap-3">
            {currentQuestion?.options?.map((option) => (
              <div
                key={option}
                className={`option-item ${answers[currentQuestion.id] === option ? "active" : ""}`}
                onClick={() => chooseAnswer(option)}
              >
                {option}
              </div>
            ))}
          </div>

          <div className="d-flex justify-content-between flex-wrap gap-3 mt-4">
            <button
              className="btn btn-outline-ak"
              disabled={currentIndex === 0 || test.exam_type === "no return"}
              onClick={handlePrevious}
            >
              Previous
            </button>
            {currentIndex < test.questions.length - 1 ? (
              <button className="btn btn-ak-primary" onClick={handleNext}>
                Next Question
              </button>
            ) : (
              <button className="btn btn-ak-primary" onClick={handleSubmit}>
                Submit Test
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
