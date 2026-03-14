import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import CustomSelect from "../../components/CustomSelect";
import { useToast } from "../../components/ToastProvider";
import {
  createAdminPublishedTest,
  deleteAdminPublishedTest,
  getAdminPublishedTests,
  getTopics
} from "../../api";

const splitSubtopics = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function AdminCertificates() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    topic: "",
    difficulty: "easy",
    questionCount: 10,
    totalTime: 10,
    examType: "total timer",
    subtopics: "",
    passMark: 60,
    rewardType: "certificate",
    rewardCoins: 0
  });

  const topicOptions = useMemo(() => {
    const base = (topics || []).map((t) => String(t.name || "").trim()).filter(Boolean);
    const unique = Array.from(new Set(base));
    return unique.length ? unique : ["Aptitude", "JavaScript", "React", "Node.js", "SQL"];
  }, [topics]);

  const difficultyOptions = useMemo(
    () => [
      { value: "easy", label: "easy" },
      { value: "medium", label: "medium" },
      { value: "hard", label: "hard" }
    ],
    []
  );

  const rewardOptions = useMemo(
    () => [
      { value: "certificate", label: "Certificate" },
      { value: "coins", label: "Coins" },
      { value: "both", label: "Both" },
      { value: "none", label: "None" }
    ],
    []
  );

  const examModes = useMemo(
    () => [
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
    ],
    []
  );

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [taskRes, topicRes] = await Promise.all([getAdminPublishedTests(), getTopics()]);
      setTasks(taskRes.data.tasks || []);
      setTopics(topicRes.data.topics || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load published tests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }
    toast.error(error);
    setError("");
  }, [error, toast]);

  const handleCreate = async (event) => {
    event.preventDefault();
    try {
      setActionLoading(true);
      setError("");
      const payload = {
        title: form.title,
        description: form.description,
        topic: form.topic,
        difficulty: form.difficulty,
        questionCount: form.questionCount,
        totalTime: form.totalTime,
        examType: form.examType,
        subtopics: splitSubtopics(form.subtopics),
        passMark: form.passMark,
        rewardType: form.rewardType,
        rewardCoins: form.rewardCoins
      };
      await createAdminPublishedTest(payload);
      setForm((current) => ({
        ...current,
        title: "",
        description: "",
        subtopics: ""
      }));
      await load();
      toast.success("Published test created.");
    } catch (err) {
      const message = err.response?.data?.message || "Unable to create test.";
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (taskId) => {
    try {
      setActionLoading(true);
      setError("");
      await deleteAdminPublishedTest(taskId);
      await load();
      toast.warning("Published test deleted.");
    } catch (err) {
      const message = err.response?.data?.message || "Unable to delete test.";
      setError(message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="d-grid gap-4">
      {loading || actionLoading ? <div className="loading-pill">Updating...</div> : null}

      <Card title="Publish New Test" subtitle="Create a task test and publish it to all active users.">
        <form className="d-grid gap-3" onSubmit={handleCreate}>
          <div className="form-surface d-grid gap-3">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label create-label">Title</label>
                <div className="field-shell">
                  <input
                    className="form-control create-input"
                    value={form.title}
                    onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                    placeholder="Eg: Aptitude Weekly Test"
                    required
                  />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label create-label">Topic</label>
                <div className="field-shell">
                  <input
                    className="form-control create-input"
                    list="admin-topic-list"
                    value={form.topic}
                    onChange={(e) => setForm((c) => ({ ...c, topic: e.target.value }))}
                    placeholder="Eg: Aptitude"
                    required
                  />
                </div>
                <datalist id="admin-topic-list">
                  {topicOptions.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="form-label create-label">Rules / Description (shown to users)</label>
              <div className="field-shell">
                <textarea
                  className="form-control create-input unblock-textarea"
                  rows="3"
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                  placeholder="Eg: 10 MCQs, no negative marks, attempt once."
                />
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label create-label">Difficulty</label>
                <div className="field-shell">
                  <CustomSelect
                    className="create-select"
                    value={form.difficulty}
                    options={difficultyOptions}
                    onChange={(e) => setForm((c) => ({ ...c, difficulty: e.target.value }))}
                  />
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label create-label">Questions</label>
                <div className="field-shell">
                  <input
                    className="form-control create-input"
                    type="number"
                    min="1"
                    max="50"
                    value={form.questionCount}
                    onChange={(e) => setForm((c) => ({ ...c, questionCount: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label create-label">Time (min)</label>
                <div className="field-shell">
                  <input
                    className="form-control create-input"
                    type="number"
                    min="1"
                    max="240"
                    value={form.totalTime}
                    onChange={(e) => setForm((c) => ({ ...c, totalTime: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label create-label">Pass mark (%)</label>
                <div className="field-shell">
                  <input
                    className="form-control create-input"
                    type="number"
                    min="0"
                    max="100"
                    value={form.passMark}
                    onChange={(e) => setForm((c) => ({ ...c, passMark: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label create-label">Reward</label>
                <div className="field-shell">
                  <CustomSelect
                    className="create-select"
                    value={form.rewardType}
                    options={rewardOptions}
                    onChange={(e) => setForm((c) => ({ ...c, rewardType: e.target.value }))}
                  />
                </div>
              </div>
              <div className="col-md-4">
                <label className="form-label create-label">Coins (if reward includes coins)</label>
                <div className="field-shell">
                  <input
                    className="form-control create-input"
                    type="number"
                    min="0"
                    max="100000"
                    value={form.rewardCoins}
                    onChange={(e) => setForm((c) => ({ ...c, rewardCoins: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="col-md-4">
                <label className="form-label create-label">Subtopics (comma separated)</label>
                <div className="field-shell">
                  <input
                    className="form-control create-input"
                    value={form.subtopics}
                    onChange={(e) => setForm((c) => ({ ...c, subtopics: e.target.value }))}
                    placeholder="Eg: Ages, Ratio, Calendar"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="form-label create-label">Test mode</label>
              <div className="row g-3">
                {examModes.map((mode) => (
                  <div key={mode.value} className="col-md-6">
                    <button
                      type="button"
                      className={`mode-choice ${form.examType === mode.value ? "active" : ""}`}
                      onClick={() => setForm((c) => ({ ...c, examType: mode.value }))}
                    >
                      <div className="mode-choice-title">{mode.title}</div>
                      <div className="mode-choice-text">{mode.text}</div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button className="btn btn-ak-primary" disabled={actionLoading}>
            {actionLoading ? "Publishing..." : "Publish test"}
          </button>
        </form>
      </Card>

      <Card title="Published Tests" subtitle="Users will see these in Tasks.">
        {tasks.length ? (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Topic</th>
                  <th>Pass</th>
                  <th>Reward</th>
                  <th>Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="fw-semibold">{task.title}</td>
                    <td>{task.topic}</td>
                    <td>{task.pass_mark}%</td>
                    <td>
                      {String(task.reward_type || "").toLowerCase() === "both"
                        ? `Certificate + ${task.reward_coins || 0} coins`
                        : String(task.reward_type || "").toLowerCase() === "coins"
                          ? `${task.reward_coins || 0} coins`
                          : String(task.reward_type || "").toLowerCase() === "certificate"
                            ? "Certificate"
                            : "—"}
                    </td>
                    <td>{task.published_at ? new Date(task.published_at).toLocaleString() : "—"}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleDelete(task.id)}
                        disabled={actionLoading}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted mb-0">No published tests yet.</p>
        )}
      </Card>
    </div>
  );
}
