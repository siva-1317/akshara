import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import { downloadCertificatePdf, getNotifications, getTasks, markNotificationRead, startTask } from "../api";
import { useToast } from "../components/ToastProvider";
import aksharaLogo from "../assets/akshara-logo.svg";

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
  const [previewCertificate, setPreviewCertificate] = useState(null);

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
    const markTaskNotificationsRead = async () => {
      if (!user?.id) {
        return;
      }

      try {
        const { data } = await getNotifications();
        const taskNotifications = (data.notifications || []).filter(
          (item) => !item.is_read && String(item.type || "").toLowerCase() === "task"
        );

        if (!taskNotifications.length) {
          return;
        }

        await Promise.all(taskNotifications.map((item) => markNotificationRead(item.id)));
        window.dispatchEvent(new Event("akshara-notifications"));
      } catch {
        // Best effort only.
      }
    };

    markTaskNotificationsRead();
  }, [user?.id]);

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
                          <>
                            <button
                              type="button"
                              className="btn btn-outline-ak btn-sm"
                              onClick={() =>
                                setPreviewCertificate({
                                  title: task.title,
                                  topic: task.topic,
                                  userName: user?.name || "Learner",
                                  score,
                                  certificateId,
                                  issuedAt: completion.completed_at || null
                                })
                              }
                            >
                              Preview certificate
                            </button>
                            <button
                              type="button"
                              className="btn btn-ak-primary btn-sm"
                              disabled={actionId === certificateId}
                              onClick={() => handleDownload({ certificateId, title: task.title })}
                            >
                              {actionId === certificateId ? "Preparing..." : "Download certificate"}
                            </button>
                          </>
                        ) : canPreviewCertificate ? (
                          <span className="text-muted">Certificate not available.</span>
                        ) : null}
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
                            onClick={() =>
                              setPreviewCertificate({
                                title: task.title,
                                topic: task.topic,
                                userName: user?.name || "Learner",
                                score: null,
                                certificateId: null,
                                issuedAt: null
                              })
                            }
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

      {previewCertificate ? (
        <>
          <button
            type="button"
            className="modal-backdrop-ak"
            aria-label="Close certificate preview"
            onClick={() => setPreviewCertificate(null)}
          />
          <div className="modal-card-ak" role="dialog" aria-modal="true">
            <div className="ak-card" style={{ width: "min(980px, 94vw)" }}>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h5 className="fw-bold mb-1">Certificate Preview</h5>
                  <p className="text-muted mb-0">{previewCertificate.title}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-ak btn-sm"
                  onClick={() => setPreviewCertificate(null)}
                >
                  Close
                </button>
              </div>

              <div className="certificate-sheet">
                <div className="certificate-sheet-inner">
                  <div className="certificate-brand-row">
                    <img className="certificate-logo" src={aksharaLogo} alt="Akshara logo" />
                    <div className="certificate-brand">AKSHARA</div>
                  </div>

                  <div className="text-center mt-2">
                    <div className="certificate-title">Certificate of Completion</div>
                    <div className="certificate-subtitle">Presented to</div>
                    <div className="certificate-recipient">{previewCertificate.userName}</div>
                    <div className="certificate-body">
                      For successfully completing <strong>{previewCertificate.title}</strong>
                      {previewCertificate.topic ? ` (${previewCertificate.topic})` : ""} on AKSHARA.
                    </div>

                    <div className="certificate-score">
                      Score:{" "}
                      <strong>{previewCertificate.score != null ? `${previewCertificate.score}%` : "â€”"}</strong>
                    </div>
                  </div>

                  <div className="certificate-footer">
                    <div className="certificate-meta">
                      <div className="certificate-meta-label">Verification</div>
                      <div className="certificate-meta-value">
                        {previewCertificate.certificateId
                          ? `Certificate ID: ${previewCertificate.certificateId}`
                          : "Will be generated after you pass the task."}
                      </div>
                    </div>
                    <div className="certificate-meta text-end">
                      <div className="certificate-meta-label">Issued</div>
                      <div className="certificate-meta-value">
                        {previewCertificate.issuedAt
                          ? new Date(previewCertificate.issuedAt).toLocaleDateString()
                          : "â€”"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
