import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTest, generateQuestions, getTopics, suggestSubtopics } from "../api";
import CustomSelect from "../components/CustomSelect";
import { useToast } from "../components/ToastProvider";

const defaultForm = {
  topic: "JavaScript",
  customTopic: "",
  difficulty: "medium",
  questionCount: 10,
  totalTime: 15,
  examType: "total timer"
};

const difficultyOptions = [
  { value: "easy", title: "Easy", text: "Warm up with concept-building questions." },
  { value: "medium", title: "Medium", text: "Balanced difficulty for regular practice." },
  { value: "hard", title: "Hard", text: "Push accuracy and depth under pressure." }
];

const examModes = [
  {
    value: "no return",
    title: "No Return",
    text: "Move forward only once, just like strict exam environments."
  },
  {
    value: "return allowed",
    title: "Return Allowed",
    text: "Navigate freely and revisit questions before submission."
  },
  {
    value: "per question timer",
    title: "Per Question Timer",
    text: "Use focused timing to control pace on every single question."
  },
  {
    value: "total timer",
    title: "Total Timer",
    text: "Run the full test on one shared countdown clock."
  }
];

export default function CreateTest() {
  const toast = useToast();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("aksharaUser") || "null");
  const coins = Number.isFinite(user?.coins) ? user.coins : 0;
  const [form, setForm] = useState(defaultForm);
  const [topics, setTopics] = useState(["JavaScript", "React", "Node.js", "SQL"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestedSubtopics, setSuggestedSubtopics] = useState([]);
  const [selectedSubtopics, setSelectedSubtopics] = useState([]);
  const [customSubtopic, setCustomSubtopic] = useState("");

  useEffect(() => {
    if (!error) {
      return;
    }
    toast.error(error);
    setError("");
  }, [error, toast]);
  const [subtopicsLoading, setSubtopicsLoading] = useState(false);
  const [subtopicsError, setSubtopicsError] = useState("");
  const topicOptions = [...topics.map((topic) => ({ value: topic, label: topic })), {
    value: "__custom__",
    label: "Custom Topic"
  }];
  const selectedTopic =
    form.topic === "__custom__" ? form.customTopic.trim() : form.topic.trim();

  const normalizeSubtopic = (value) => String(value || "").trim();

  const uniqueSubtopics = (items) => {
    const seen = new Set();
    const result = [];
    for (const item of items || []) {
      const cleaned = normalizeSubtopic(item);
      if (!cleaned) {
        continue;
      }
      const key = cleaned.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(cleaned);
    }
    return result;
  };

  const allSubtopics = uniqueSubtopics([...suggestedSubtopics, ...selectedSubtopics]);

  useEffect(() => {
    const loadTopics = async () => {
      try {
        const { data } = await getTopics();
        if (data.topics?.length) {
          setTopics(data.topics.map((topic) => topic.name));
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadTopics();
  }, []);

  useEffect(() => {
    if (!Number.isFinite(coins) || coins <= 0) {
      return;
    }

    setForm((current) => {
      const nextCount = Math.min(Number(current.questionCount) || 1, coins);
      if (nextCount === current.questionCount) {
        return current;
      }
      return { ...current, questionCount: nextCount };
    });
  }, [coins]);

  useEffect(() => {
    let active = true;

    const loadSubtopics = async () => {
      setSubtopicsError("");
      setSuggestedSubtopics([]);
      setSelectedSubtopics([]);
      setCustomSubtopic("");

      if (!selectedTopic) {
        return;
      }

      try {
        setSubtopicsLoading(true);
        const { data } = await suggestSubtopics({ topic: selectedTopic });
        if (!active) {
          return;
        }
        setSuggestedSubtopics(uniqueSubtopics(data?.subtopics || []));
      } catch (err) {
        if (!active) {
          return;
        }
        const fallback = selectedTopic.toLowerCase() === "aptitude"
          ? ["Ages", "Calendar", "Mixtures", "Ratio"]
          : [];
        setSuggestedSubtopics(fallback);
        setSubtopicsError("Unable to fetch AI suggestions right now.");
      } finally {
        if (active) {
          setSubtopicsLoading(false);
        }
      }
    };

    loadSubtopics();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTopic]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const toggleSubtopic = (label) => {
    const cleaned = normalizeSubtopic(label);
    if (!cleaned) {
      return;
    }

    setSelectedSubtopics((current) => {
      const targetKey = cleaned.toLowerCase();
      const exists = current.some((item) => String(item).toLowerCase() === targetKey);
      if (exists) {
        return current.filter((item) => String(item).toLowerCase() !== targetKey);
      }
      return uniqueSubtopics([...current, cleaned]);
    });
  };

  const handleAddCustomSubtopic = () => {
    const cleaned = normalizeSubtopic(customSubtopic);
    if (!cleaned) {
      return;
    }

    toggleSubtopic(cleaned);
    setCustomSubtopic("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      if (!coins || coins <= 0) {
        throw new Error("Not enough coins to generate a test.");
      }
      const { data: created } = await createTest({
        userId: user?.id,
        topic: selectedTopic,
        difficulty: form.difficulty,
        questionCount: Number(form.questionCount),
        totalTime: Number(form.totalTime),
        examType: form.examType,
        subtopics: selectedSubtopics
      });

      const nextUser = { ...user, coins: created.coins };
      localStorage.setItem("aksharaUser", JSON.stringify(nextUser));

      await generateQuestions({
        testId: created.test.id,
        topic: selectedTopic,
        difficulty: form.difficulty,
        count: Number(created.test.question_count || form.questionCount),
        subtopics: selectedSubtopics
      });

      navigate(`/test/${created.test.id}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to create test.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell create-test-page">
      <div className="container">
        <div className="create-test-shell">
          <div className="create-test-header">
            <div>
              <span className="status-pill mb-3">AI Exam Builder</span>
              <h2 className="section-title mb-2">Create a New Test</h2>
              <p className="text-muted mb-0">
                Shape a custom exam with the right topic, pressure level, and timing mode before
                AKSHARA generates your questions.
              </p>
            </div>

            <div className="create-test-summary">
              <div className="summary-chip">
                <small>Questions</small>
                <strong>{form.questionCount}</strong>
              </div>
              <div className="summary-chip">
                <small>Minutes</small>
                <strong>{form.totalTime}</strong>
              </div>
              <div className="summary-chip">
                <small>Mode</small>
                <strong>{form.examType}</strong>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="create-test-form">
            <div className="row g-4">
              <div className="col-lg-7">
                <div className="form-surface h-100">
                  <div className="row g-4">
                    <div className="col-md-6">
                      <label className="form-label create-label">Topic</label>
                      <div className="field-shell">
                        <CustomSelect
                          className="create-select"
                          name="topic"
                          value={form.topic}
                          onChange={handleChange}
                          options={topicOptions}
                        />
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label create-label">Custom Topic</label>
                      <div className="field-shell">
                        <input
                          className="form-control create-input"
                          name="customTopic"
                          value={form.customTopic}
                          onChange={handleChange}
                          placeholder="Enter a custom topic"
                          disabled={form.topic !== "__custom__"}
                          required={form.topic === "__custom__"}
                        />
                      </div>
                    </div>

                    {selectedTopic ? (
                      <div className="col-12">
                        <div className="subtopic-surface">
                          <div className="subtopic-header">
                            <div>
                              <label className="form-label create-label mb-1">Subtopics (optional)</label>
                              <p className="text-muted mb-0">
                                Select one or more subtopics, or add your own.
                              </p>
                            </div>
                            <span className="subtopic-count">
                              Selected: <strong>{selectedSubtopics.length}</strong>
                            </span>
                          </div>

                          {subtopicsLoading ? (
                            <p className="text-muted mb-2">Suggesting subtopics...</p>
                          ) : null}
                          {subtopicsError ? (
                            <p className="text-muted mb-2">{subtopicsError}</p>
                          ) : null}

                          <div className="subtopic-chip-row">
                            {allSubtopics.length ? (
                              allSubtopics.map((item) => {
                                const active = selectedSubtopics.some(
                                  (selected) =>
                                    String(selected).toLowerCase() === String(item).toLowerCase()
                                );
                                return (
                                  <button
                                    key={item}
                                    type="button"
                                    className={`subtopic-chip ${active ? "active" : ""}`}
                                    onClick={() => toggleSubtopic(item)}
                                  >
                                    {item}
                                  </button>
                                );
                              })
                            ) : (
                              <span className="text-muted">No suggestions yet.</span>
                            )}
                          </div>

                          <div className="subtopic-add-row">
                            <div className="field-shell flex-grow-1">
                              <input
                                className="form-control create-input"
                                value={customSubtopic}
                                onChange={(event) => setCustomSubtopic(event.target.value)}
                                placeholder="Add your own subtopic"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleAddCustomSubtopic();
                                  }
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              className="btn btn-outline-ak subtopic-add-btn"
                              onClick={handleAddCustomSubtopic}
                              disabled={!customSubtopic.trim()}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="col-md-6">
                      <label className="form-label create-label">Question Count</label>
                      <div className="field-shell">
                        <input
                          type="number"
                          min="1"
                          max={coins > 0 ? coins : 1}
                          className="form-control create-input"
                          name="questionCount"
                          value={form.questionCount}
                          onChange={handleChange}
                        />
                      </div>
                      <small className="text-muted d-block mt-2">
                        Coins available: <strong>{coins}</strong> (1 coin per question)
                      </small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label create-label">Total Time (minutes)</label>
                      <div className="field-shell">
                        <input
                          type="number"
                          min="1"
                          className="form-control create-input"
                          name="totalTime"
                          value={form.totalTime}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="form-label create-label d-block mb-3">Difficulty</label>
                      <div className="row g-3">
                        {difficultyOptions.map((option) => (
                          <div className="col-md-4" key={option.value}>
                            <button
                              type="button"
                              className={`choice-card ${form.difficulty === option.value ? "active" : ""}`}
                              onClick={() =>
                                setForm((current) => ({ ...current, difficulty: option.value }))
                              }
                            >
                              <span className="choice-title">{option.title}</span>
                              <span className="choice-text">{option.text}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-lg-5">
                <div className="form-surface h-100">
                  <label className="form-label create-label d-block mb-3">Exam Mode</label>
                  <div className="d-grid gap-3">
                    {examModes.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        className={`mode-choice ${form.examType === mode.value ? "active" : ""}`}
                        onClick={() =>
                          setForm((current) => ({ ...current, examType: mode.value }))
                        }
                      >
                        <span className="mode-choice-title">{mode.title}</span>
                        <span className="mode-choice-text">{mode.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="create-test-footer mt-4">
              <div className="text-muted">
                Topic: <strong>{form.topic === "__custom__" ? form.customTopic || "Custom Topic" : form.topic}</strong>
                {" • "}Difficulty: <strong className="text-capitalize">{form.difficulty}</strong>
              </div>
              <button className="btn btn-ak-primary btn-lg px-4" disabled={loading || coins <= 0}>
                {loading ? "Preparing Test..." : "Generate Test"}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
