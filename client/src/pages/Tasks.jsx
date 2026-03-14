import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import { downloadCertificatePdf, getTasks, startTask } from "../api";
import { useToast } from "../components/ToastProvider";

const formatReward = (task) => {
  const rewardType = String(task?.reward_type || "").toLowerCase();
  const coins = Math.max(0, Math.floor(Number(task?.reward_coins) || 0));

  if (rewardType === "both") {
    return coins ? `Certificate + ${coins} coins` : "Certificate";
  }
  if (rewardType === "coins") {
    return coins ? `${coins} coins` : "Coins";
  }
  if (rewardType === "certificate") {
    return "Certificate";
  }
  return "—";
};

export default function Tasks() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("aksharaUser") || "null");
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");
  const [previewTask, setPreviewTask] = useState(null);

  const sortedTasks = useMemo(() => {
    const list = Array.isArray(tasks) ? [...tasks] : [];
    return list.sort((a, b) => {
      const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
      const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [tasks]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await getTasks();
      setTasks(data.tasks || []);
    } catch (err) {
      const message = err.response?.data?.message || "Unable to load tasks.";
      setError(message);
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

  const handleStart = async (taskId) => {
    try {
      setActionId(taskId);
      setError("");
      const { data } = await startTask(taskId);
      navigate(`/test/${data.testId}`);
    } catch (err) {
      const message = err.response?.data?.message || "Unable to start task.";
      setError(message);
    } finally {
      setActionId("");
    }
  };

  const handleDownload = async ({ certificateId, title }) => {
    try {
      setActionId(certificateId);
      setError("");
      const response = await downloadCertificatePdf(certificateId);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const safeTitle = String(title || "certificate").replace(/[^a-z0-9-_ ]/gi, "").trim();
      anchor.download = `${safeTitle || "certificate"}-${certificateId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = err.response?.data?.message || "Unable to download certificate.";
      setError(message);
    } finally {
      setActionId("");
    }
  };

  return (
    <div className="page-shell">
      <div className="container">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
          <div>
            <h2 className="fw-bold mb-1">Tasks</h2>
            <p className="text-muted mb-0">Admin published tests appear here. Pass to earn rewards.</p>
          </div>
          <button className="btn btn-ak-outline" type="button" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>

        {loading ? <div className="loading-pill mb-3">Loading tasks...</div> : null}

        <div className="d-grid gap-3">
          {sortedTasks.length ? (
            sortedTasks.map((task) => {
              const completion = task.completion;
              const completed = Boolean(completion?.completed_at);
              const passMark = Number.isFinite(Number(task.pass_mark)) ? Number(task.pass_mark) : 60;
              const score = Number.isFinite(Number(completion?.score)) ? Number(completion.score) : null;
              const certificateId = completion?.certificate_id || null;
              const rewardType = String(task?.reward_type || "").toLowerCase();
              const canPreviewCertificate = ["certificate", "both"].includes(rewardType);

              return (
                <Card
                  key={task.id}
                  title={task.title}
                  subtitle={task.description || `${task.topic} • ${task.difficulty}`}
                  className="task-card"
                >
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <span className="badge rounded-pill text-bg-secondary">{task.topic}</span>
                    <span className="badge rounded-pill text-bg-light border">Difficulty: {task.difficulty}</span>
                    <span className="badge rounded-pill text-bg-light border">Pass mark: {passMark}%</span>
                    <span className="badge rounded-pill text-bg-light border">
                      Reward: {formatReward(task)}
                    </span>
                  </div>

                  {completed ? (
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div className="text-muted">
                        Completed{score != null ? ` • Score: ${score}%` : ""} •{" "}
                        {completion.completed_at ? new Date(completion.completed_at).toLocaleString() : ""}
                      </div>
                      <div className="d-flex gap-2">
                        {certificateId ? (
                          <button
                            type="button"
                            className="btn btn-ak-primary btn-sm"
                            disabled={actionId === certificateId}
                            onClick={() => handleDownload({ certificateId, title: task.title })}
                          >
                            {actionId === certificateId ? "Preparing..." : "Download certificate"}
                          </button>
                        ) : (
                          <span className="text-muted">Certificate not available.</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div className="text-muted">
                        {task.question_count} questions
                        {task.total_time ? ` • ${task.total_time} min` : ""}
                        {task.exam_type ? ` • ${task.exam_type}` : ""}
                      </div>
                      <div className="d-flex gap-2">
                        {canPreviewCertificate ? (
                          <button
                            type="button"
                            className="btn btn-outline-ak btn-sm"
                            onClick={() => setPreviewTask(task)}
                          >
                            Preview certificate
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-ak-primary btn-sm"
                          disabled={actionId === task.id}
                          onClick={() => handleStart(task.id)}
                        >
                          {actionId === task.id ? "Starting..." : "Start"}
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          ) : (
            <Card title="No tasks yet" subtitle="Ask the admin to publish a test.">
              <p className="text-muted mb-0">When a task is published, it will show up here.</p>
            </Card>
          )}
        </div>
      </div>

      {previewTask ? (
        <>
          <button
            type="button"
            className="notification-backdrop"
            aria-label="Close certificate preview"
            onClick={() => setPreviewTask(null)}
          />
          <div className="notification-panel certificate-preview-panel">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <strong className="notification-panel-title">Certificate Preview</strong>
                <small className="text-muted d-block">{previewTask.title}</small>
              </div>
              <button type="button" className="notification-action-btn" onClick={() => setPreviewTask(null)}>
                Close
              </button>
            </div>

            <div className="ak-card mb-0">
              <div className="text-center">
                <small className="text-muted d-block mb-1">AKSHARA</small>
                <h4 className="fw-bold mb-2">Certificate of Completion</h4>
                <p className="text-muted mb-2">Presented to</p>
                <h5 className="fw-bold mb-3">{user?.name || "Learner"}</h5>
                <p className="mb-0 text-muted">
                  For successfully completing "{previewTask.title}" ({previewTask.topic}) on AKSHARA.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
