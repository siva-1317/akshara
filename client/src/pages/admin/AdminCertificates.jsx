import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
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
    examType: "mcq",
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
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Title</label>
              <input
                className="form-control create-input"
                value={form.title}
                onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                placeholder="Eg: Aptitude Weekly Test"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Topic</label>
              <input
                className="form-control create-input"
                list="admin-topic-list"
                value={form.topic}
                onChange={(e) => setForm((c) => ({ ...c, topic: e.target.value }))}
                placeholder="Eg: Aptitude"
                required
              />
              <datalist id="admin-topic-list">
                {topicOptions.map((value) => (
                  <option key={value} value={value} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="form-label">Rules / Description (shown to users)</label>
            <textarea
              className="form-control create-input unblock-textarea"
              rows="3"
              value={form.description}
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
              placeholder="Eg: 10 MCQs, no negative marks, attempt once."
            />
          </div>

          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">Difficulty</label>
              <select
                className="form-select create-input"
                value={form.difficulty}
                onChange={(e) => setForm((c) => ({ ...c, difficulty: e.target.value }))}
              >
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Questions</label>
              <input
                className="form-control create-input"
                type="number"
                min="1"
                max="50"
                value={form.questionCount}
                onChange={(e) => setForm((c) => ({ ...c, questionCount: Number(e.target.value) }))}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Time (min)</label>
              <input
                className="form-control create-input"
                type="number"
                min="1"
                max="240"
                value={form.totalTime}
                onChange={(e) => setForm((c) => ({ ...c, totalTime: Number(e.target.value) }))}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Pass mark (%)</label>
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

          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Reward</label>
              <select
                className="form-select create-input"
                value={form.rewardType}
                onChange={(e) => setForm((c) => ({ ...c, rewardType: e.target.value }))}
              >
                <option value="certificate">Certificate</option>
                <option value="coins">Coins</option>
                <option value="both">Both</option>
                <option value="none">None</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Coins (if reward includes coins)</label>
              <input
                className="form-control create-input"
                type="number"
                min="0"
                max="100000"
                value={form.rewardCoins}
                onChange={(e) => setForm((c) => ({ ...c, rewardCoins: Number(e.target.value) }))}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Subtopics (comma separated)</label>
              <input
                className="form-control create-input"
                value={form.subtopics}
                onChange={(e) => setForm((c) => ({ ...c, subtopics: e.target.value }))}
                placeholder="Eg: Ages, Ratio, Calendar"
              />
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
