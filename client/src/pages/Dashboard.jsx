import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { askAssistant, getCurrentUser, getDashboard, getTasks, submitFeedback, updateCurrentUser } from "../api";
import Card from "../components/Card";
import CustomSelect from "../components/CustomSelect";
import aksharaLogo from "../assets/akshara.png";
import { useToast } from "../components/ToastProvider";

const scoreTone = (score) => {
  if (score >= 80) {
    return "bg-success-subtle text-success";
  }
  if (score >= 60) {
    return "bg-warning-subtle text-warning-emphasis";
  }
  return "bg-danger-subtle text-danger";
};

const contributionTone = (count, maxCount) => {
  if (!count) {
    return "level-0";
  }

  if (maxCount <= 1) {
    return "level-4";
  }

  const ratio = count / maxCount;
  if (ratio >= 0.75) {
    return "level-4";
  }
  if (ratio >= 0.5) {
    return "level-3";
  }
  if (ratio >= 0.25) {
    return "level-2";
  }
  return "level-1";
};

const formatCountdown = (milliseconds) => {
  if (milliseconds == null) {
    return "Lifetime";
  }

  const value = Number(milliseconds);
  if (!Number.isFinite(value)) {
    return "-";
  }

  if (value <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.floor(value / 1000);
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

export default function Dashboard() {
  const storedUser = JSON.parse(localStorage.getItem("aksharaUser") || "null");
  const toast = useToast();
  const lastAnnouncementRef = useRef("");
  const [currentUser, setCurrentUser] = useState(storedUser);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: storedUser?.name || "",
    phoneNumber: storedUser?.phoneNumber || "",
    profession: storedUser?.profession || ""
  });
  const [feedback, setFeedback] = useState({ category: "feedback", message: "" });
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [taskAnnouncement, setTaskAnnouncement] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [offerNowMs, setOfferNowMs] = useState(Date.now());

  useEffect(() => {
    if (!error) {
      return;
    }
    toast.error(error);
    setError("");
  }, [error, toast]);

  useEffect(() => {
    if (!feedbackMessage) {
      return;
    }
    toast.success(feedbackMessage);
    setFeedbackMessage("");
  }, [feedbackMessage, toast]);

  useEffect(() => {
    if (!taskAnnouncement?.title) {
      return;
    }
    const signature = String(taskAnnouncement.title);
    if (lastAnnouncementRef.current === signature) {
      return;
    }
    lastAnnouncementRef.current = signature;
    toast.info(`New test available — ${taskAnnouncement.title}`, { title: "Announcement", duration: 6500 });
  }, [taskAnnouncement, toast]);
  const feedbackOptions = [
    { value: "feedback", label: "Feedback" },
    { value: "query", label: "Query" },
    { value: "bug", label: "Bug Report" }
  ];

  const professionOptions = useMemo(
    () => [
      { value: "", label: "Select profession" },
      { value: "student", label: "Student" },
      { value: "employee", label: "Employee" },
      { value: "freelancer", label: "Freelancer" },
      { value: "job_seeker", label: "Job seeker" },
      { value: "teacher", label: "Teacher" },
      { value: "entrepreneur", label: "Entrepreneur" },
      { value: "other", label: "Other" }
    ],
    []
  );

  const mergeUser = (baseUser, nextUser) => {
    const merged = { ...(baseUser || {}), ...(nextUser || {}) };

    // /me and profile updates don't currently return avatarUrl; keep what we got at login.
    if (!merged.avatarUrl) {
      merged.avatarUrl = baseUser?.avatarUrl || null;
    }

    return merged;
  };

  const persistUser = (nextUser) => {
    const merged = mergeUser(currentUser, nextUser);
    localStorage.setItem("aksharaUser", JSON.stringify(merged));
    setCurrentUser(merged);
  };

  const avatarFallback = useMemo(() => {
    const seed = (currentUser?.email || currentUser?.name || "").trim().toLowerCase();
    const labelSource = (currentUser?.name || currentUser?.email || "User").trim();
    const initial = labelSource ? labelSource[0].toUpperCase() : "U";

    // Fast deterministic hash for UI-only color (not security related).
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) | 0;
    }
    const hue = Math.abs(hash) % 360;

    return {
      initial,
      style: {
        background: `linear-gradient(135deg, hsl(${hue} 80% 55%) 0%, hsl(${(hue + 40) % 360} 85% 60%) 100%)`
      }
    };
  }, [currentUser?.email, currentUser?.name]);

  useEffect(() => {
    const loadDashboard = async ({ showLoader = false } = {}) => {
      try {
        if (showLoader) {
          setLoading(true);
        }
        const { data } = await getDashboard(storedUser?.id);
        setDashboard(data);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load dashboard.");
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    };

    if (storedUser?.id) {
      loadDashboard({ showLoader: true });
    } else {
      setLoading(false);
    }

    const handleFocus = () => {
      if (storedUser?.id) {
        loadDashboard();
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [storedUser?.id]);

  useEffect(() => {
    const offer = dashboard?.offer;
    if (!offer?.id) {
      return undefined;
    }

    const serverTimeMs = offer?.serverTime ? Date.parse(offer.serverTime) : NaN;
    const offsetMs = Number.isFinite(serverTimeMs) ? Date.now() - serverTimeMs : 0;

    const tick = () => {
      setOfferNowMs(Date.now() - offsetMs);
    };

    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, [dashboard?.offer?.id, dashboard?.offer?.serverTime]);

  useEffect(() => {
    const loadTaskAnnouncement = async () => {
      if (!storedUser?.id) {
        setTaskAnnouncement(null);
        return;
      }

      try {
        const { data } = await getTasks();
        const next = (data?.tasks || []).find((task) => !task?.completion) || null;
        setTaskAnnouncement(next);
      } catch {
        setTaskAnnouncement(null);
      }
    };

    loadTaskAnnouncement();
  }, [storedUser?.id]);

  useEffect(() => {
    const hydrateUser = async () => {
      if (!storedUser?.id) {
        return;
      }

      try {
        const { data } = await getCurrentUser();
        if (data?.user) {
          persistUser(data.user);
          setProfileForm({
            name: data.user.name || "",
            phoneNumber: data.user.phoneNumber || "",
            profession: data.user.profession || ""
          });
        }
      } catch (err) {
        // Dashboard should remain usable even if profile refresh fails.
      }
    };

    hydrateUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const userName = currentUser?.name || "Learner";
    setChatMessages([
      {
        id: "welcome-message",
        role: "assistant",
        content: `Hi ${userName}, welcome to AKSHARA. I can help with tests, dashboard, history, reviews, and account questions.`
      }
    ]);
  }, [currentUser?.name]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="container">
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const trendBars = dashboard?.recentScores?.length ? dashboard.recentScores : [0, 0, 0, 0, 0];
  const topicBars = dashboard?.topicBreakdown?.length
    ? dashboard.topicBreakdown.slice(0, 4)
    : [{ topic: "No topic data", average: 0 }];
  const contributionDays = dashboard?.contributionGraph?.days || [];
  const contributionColumns = [];

  for (let index = 0; index < contributionDays.length; index += 7) {
    contributionColumns.push(contributionDays.slice(index, index + 7));
  }

  const contributionMonths = contributionColumns.map((week, weekIndex) => {
    const labelDay = week.find((day) => day.dayOfMonth <= 7) || week[0];
    const previousWeek = contributionColumns[weekIndex - 1];
    const previousLabelDay = previousWeek
      ? previousWeek.find((day) => day.dayOfMonth <= 7) || previousWeek[0]
      : null;
    const monthKey = labelDay ? `${labelDay.monthLabel}-${labelDay.yearLabel}` : "";
    const previousMonthKey = previousLabelDay
      ? `${previousLabelDay.monthLabel}-${previousLabelDay.yearLabel}`
      : "";

    return {
      key: `month-${weekIndex}`,
      label: monthKey !== previousMonthKey ? `${labelDay?.monthLabel} ${labelDay?.yearLabel}` : "",
      show: monthKey !== previousMonthKey
    };
  });

  const handleProfileSave = async () => {
    if (!currentUser?.email) {
      setError("Unable to update profile without an email address.");
      return;
    }

    try {
      setProfileSaving(true);
      setError("");
      const { data } = await updateCurrentUser({
        name: profileForm.name,
        email: currentUser.email,
        phoneNumber: profileForm.phoneNumber,
        profession: profileForm.profession
      });
      if (data?.user) {
        persistUser(data.user);
      }
      setProfileEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    try {
      setFeedbackLoading(true);
      setFeedbackMessage("");
      await submitFeedback({
        userId: currentUser?.id,
        category: feedback.category,
        message: feedback.message
      });
      setFeedback({ category: "feedback", message: "" });
      setFeedbackMessage("Feedback sent to admin successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to submit feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleAssistantSubmit = async (event) => {
    event.preventDefault();
    if (!assistantQuestion.trim()) {
      return;
    }

    const question = assistantQuestion.trim();

    try {
      setAssistantLoading(true);
      setChatMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: question
        }
      ]);
      const { data } = await askAssistant({ question });
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.answer
        }
      ]);
      setAssistantQuestion("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to get assistant response.");
    } finally {
      setAssistantLoading(false);
    }
  };

  const activeOffer = dashboard?.offer?.status === "active" ? dashboard.offer : null;
  const offerEndsAtMs = activeOffer?.endsAt ? Date.parse(activeOffer.endsAt) : null;
  const offerRemainingMs =
    offerEndsAtMs == null || !Number.isFinite(offerEndsAtMs) ? null : offerEndsAtMs - offerNowMs;

  return (
      <div className="page-shell">
      <div className="container">
        <div className="dashboard-hero ak-card mb-4">
          <div className="row g-4 align-items-center">
            <div className="col-lg-7">
              <span className="status-pill mb-3">Learner Dashboard</span>
              <h2 className="section-title mb-2">Welcome back, {currentUser?.name}</h2>
              <p className="text-muted mb-4">
                Review your progress, spot weaknesses, and turn recent results into smarter next
                steps.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <Link to="/create-test" className="btn btn-ak-primary">
                  Create New Test
                </Link>
                <Link to="/history" className="btn btn-outline-ak">
                  View Full History
                </Link>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="row g-3">
                <div className="col-6">
                  <div className="mini-stat-card">
                    <small>Total Tests</small>
                    <strong>{dashboard?.totalTests || 0}</strong>
                  </div>
                </div>
                <div className="col-6">
                  <div className="mini-stat-card">
                    <small>Avg Score</small>
                    <strong>{dashboard?.averageScore || 0}%</strong>
                  </div>
                </div>
                <div className="col-6">
                  <div className="mini-stat-card">
                    <small>Strongest Topic</small>
                    <strong>{dashboard?.strongestTopic || "N/A"}</strong>
                  </div>
                </div>
                <div className="col-6">
                  <div className="mini-stat-card">
                    <small>Suggested Test</small>
                    <strong>{dashboard?.suggestedTest || "Starter test"}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {activeOffer ? (
          <div className="row g-4 mb-4">
            <div className="col-12">
              <Card title="Offer Active" subtitle="Attend tests without using coins">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                  <div>
                    <div className="text-muted small">Offer type</div>
                    <strong className="text-capitalize">{activeOffer.type || "offer"}</strong>
                  </div>
                  <div className="text-end">
                    <div className="text-muted small">Remaining</div>
                    <strong>{formatCountdown(offerRemainingMs)}</strong>
                  </div>
                </div>

                <div className="mt-3 d-flex flex-wrap gap-2">
                  {activeOffer.fixedQuestionCount != null ? (
                    <span className="badge text-bg-light border">
                      Questions: {activeOffer.fixedQuestionCount}
                    </span>
                  ) : (
                    <span className="badge text-bg-light border">Questions: your choice</span>
                  )}
                  {activeOffer.fixedDifficulty ? (
                    <span className="badge text-bg-light border">
                      Difficulty: {activeOffer.fixedDifficulty}
                    </span>
                  ) : (
                    <span className="badge text-bg-light border">Difficulty: your choice</span>
                  )}
                  {activeOffer.fixedExamType ? (
                    <span className="badge text-bg-light border">
                      Mode: {activeOffer.fixedExamType}
                    </span>
                  ) : (
                    <span className="badge text-bg-light border">Mode: your choice</span>
                  )}
                </div>

                <small className="text-muted d-block mt-3">
                  Use "Use Offer" in Create Test to keep your coin balance unchanged until the offer ends.
                </small>
              </Card>
            </div>
          </div>
        ) : null}

        <div className="row g-4 mb-4">
          <div className="col-md-3">
            <Card title="Improvement">
              <div className={`dashboard-badge ${dashboard?.improvement >= 0 ? "positive" : "negative"}`}>
                {dashboard?.improvement >= 0 ? "+" : ""}
                {dashboard?.improvement || 0} pts
              </div>
              <p className="text-muted mb-0 mt-2">Change compared with your recent average.</p>
            </Card>
          </div>
          <div className="col-md-3">
            <Card title="Consistency">
              <div className="metric-value">{dashboard?.consistency || 0}%</div>
              <p className="text-muted mb-0">Stability across your recent tests.</p>
            </Card>
          </div>
          <div className="col-md-3">
            <Card title="Completion">
              <div className="metric-value">{dashboard?.completionRate || 0}%</div>
              <p className="text-muted mb-0">Learning momentum based on your activity.</p>
            </Card>
          </div>
          <div className="col-md-3">
            <Card title="Weak Topics">
              <p className="mb-0">
                {dashboard?.weakTopics?.length ? dashboard.weakTopics.join(", ") : "No weak topics yet"}
              </p>
            </Card>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-12">
            <Card
              title="Test Attendance Graph"
              subtitle="Your day-by-day test activity like a contribution chart"
            >
              <div className="contribution-summary">
                <strong>{dashboard?.contributionGraph?.totalContributions || 0} tests attended</strong>
                <span>
                  on {dashboard?.contributionGraph?.activeDays || 0} active day
                  {dashboard?.contributionGraph?.activeDays === 1 ? "" : "s"} in the last 18 weeks
                </span>
              </div>

              <div className="contribution-board">
                {contributionColumns.length ? (
                  contributionColumns.map((week, weekIndex) => (
                    <div className="contribution-column" key={`week-${weekIndex}`}>
                      <div className="contribution-month-label">
                        {contributionMonths[weekIndex]?.show ? contributionMonths[weekIndex].label : ""}
                      </div>
                      <div className="contribution-week">
                        {week.map((day) => (
                          <div
                            key={day.date}
                            className={`contribution-cell ${contributionTone(
                              day.count,
                              dashboard?.contributionGraph?.maxCount || 0
                            )}`}
                            title={`${day.date}: ${day.count} test${day.count === 1 ? "" : "s"} attended`}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted mb-0">No attendance data yet.</p>
                )}
              </div>

              <div className="contribution-footer">
                <small>Less</small>
                <div className="contribution-legend">
                  <span className="contribution-cell level-0" />
                  <span className="contribution-cell level-1" />
                  <span className="contribution-cell level-2" />
                  <span className="contribution-cell level-3" />
                  <span className="contribution-cell level-4" />
                </div>
                <small>More</small>
              </div>
            </Card>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-lg-7">
            <Card title="Score Trend" subtitle="Recent performance pattern">
              <div className="trend-chart">
                {trendBars.map((score, index) => (
                  <div className="trend-bar-wrap" key={`${score}-${index}`}>
                    <div className="trend-bar-track">
                      <div className="trend-bar-fill" style={{ height: `${Math.max(score, 8)}%` }} />
                    </div>
                    <span className="trend-score">{score}%</span>
                    <small className="text-muted">T{index + 1}</small>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="col-lg-5">
            <Card title="Topic Analysis" subtitle="Average score by topic">
              <div className="d-grid gap-3">
                {topicBars.map((topic) => (
                  <div key={topic.topic}>
                    <div className="d-flex justify-content-between mb-1">
                      <span>{topic.topic}</span>
                      <strong>{topic.average}%</strong>
                    </div>
                    <div className="progress dashboard-progress" role="progressbar">
                      <div className="progress-bar bg-warning" style={{ width: `${topic.average}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-lg-5">
            <Card title="User Profile" subtitle="Your learner account">
              <div className="profile-card">
                <div className="profile-header">
                  <div className="profile-avatar" aria-hidden="true">
                    {currentUser?.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt="" />
                    ) : (
                      <div className="profile-avatar-fallback" style={avatarFallback.style}>
                        {avatarFallback.initial}
                      </div>
                    )}
                  </div>

                  <div className="profile-meta">
                    <strong className="profile-name">{currentUser?.name || "Learner"}</strong>
                    <span className="profile-subtitle">
                      {currentUser?.profession
                        ? currentUser.profession.replace(/_/g, " ")
                        : "Profession not set"}
                    </span>
                  </div>

                  <div className="profile-actions">
                    {!profileEditing ? (
                      <button
                        type="button"
                        className="btn btn-outline-ak btn-sm"
                        onClick={() => {
                          setProfileEditing(true);
                          setProfileForm({
                            name: currentUser?.name || "",
                            phoneNumber: currentUser?.phoneNumber || "",
                            profession: currentUser?.profession || ""
                          });
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <div className="d-flex gap-2 justify-content-end">
                        <button
                          type="button"
                          className="btn btn-ak-primary btn-sm"
                          onClick={handleProfileSave}
                          disabled={profileSaving}
                        >
                          {profileSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-ak btn-sm"
                          onClick={() => {
                            setProfileEditing(false);
                            setProfileForm({
                              name: currentUser?.name || "",
                              phoneNumber: currentUser?.phoneNumber || "",
                              profession: currentUser?.profession || ""
                            });
                          }}
                          disabled={profileSaving}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="profile-body">
                  <div className="profile-row">
                    <span className="profile-label">Email</span>
                    <span className="profile-value">{currentUser?.email || "-"}</span>
                  </div>

                  {!profileEditing ? (
                    <>
                      <div className="profile-row">
                        <span className="profile-label">Phone number</span>
                        <span className="profile-value">{currentUser?.phoneNumber || "-"}</span>
                      </div>
                      <div className="profile-row">
                        <span className="profile-label">Profession</span>
                        <span className="profile-value">
                          {currentUser?.profession
                            ? currentUser.profession.replace(/_/g, " ")
                            : "-"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="d-grid gap-3 mt-3">
                      <div>
                        <label className="form-label">Name</label>
                        <div className="field-shell">
                          <input
                            className="form-control create-input"
                            value={profileForm.name}
                            onChange={(event) =>
                              setProfileForm((current) => ({ ...current, name: event.target.value }))
                            }
                            placeholder="Your name"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="form-label">Phone number</label>
                        <div className="field-shell">
                          <input
                            className="form-control create-input"
                            value={profileForm.phoneNumber}
                            onChange={(event) =>
                              setProfileForm((current) => ({
                                ...current,
                                phoneNumber: event.target.value
                              }))
                            }
                            placeholder="e.g. +91 98765 43210"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="form-label">Profession</label>
                        <select
                          className="form-select"
                          value={profileForm.profession}
                          onChange={(event) =>
                            setProfileForm((current) => ({
                              ...current,
                              profession: event.target.value
                            }))
                          }
                        >
                          {professionOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
          <div className="col-lg-7">
            <Card title="Suggestions & Improvements" subtitle="What to do next">
              <div className="d-grid gap-3">
                {(dashboard?.suggestions || []).map((item, index) => (
                  <div className="suggestion-card" key={item}>
                    <span className="suggestion-index">0{index + 1}</span>
                    <p className="mb-0">{item}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-lg-7">
            <Card title="Recent History" subtitle="Latest tests and performance snapshots">
              <div className="table-responsive">
                <table className="table table-ak align-middle">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Difficulty</th>
                      <th>Score</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard?.history?.length ? (
                      dashboard.history.map((item) => (
                        <tr key={item.id}>
                          <td>{item.topic}</td>
                          <td className="text-capitalize">{item.difficulty}</td>
                          <td>
                            <span className={`badge rounded-pill ${scoreTone(item.score || 0)}`}>
                              {item.score || 0}%
                            </span>
                          </td>
                          <td>{new Date(item.date).toLocaleDateString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="text-center text-muted py-4">
                          No tests taken yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <div className="col-lg-5">
            <div className="d-grid gap-4">
              <Card title="Feedback Form" subtitle="Share app feedback or report a query">
                <form onSubmit={handleFeedbackSubmit} className="d-grid gap-3">
                  <div className="field-shell">
                    <CustomSelect
                      className="create-select"
                      value={feedback.category}
                      options={feedbackOptions}
                      onChange={(event) =>
                        setFeedback((current) => ({ ...current, category: event.target.value }))
                      }
                    />
                  </div>
                  <div className="field-shell">
                    <textarea
                      className="form-control create-input unblock-textarea"
                      rows="4"
                      placeholder="Tell us what you want to improve or ask."
                      value={feedback.message}
                      onChange={(event) =>
                        setFeedback((current) => ({ ...current, message: event.target.value }))
                      }
                    />
                  </div>
                  <button className="btn btn-ak-primary" disabled={feedbackLoading}>
                    {feedbackLoading ? "Sending..." : "Send Feedback"}
                  </button>
                </form>
              </Card>

              <Card title="Learning Support" subtitle="Send feedback while the chat assistant stays ready">
                <p className="text-muted mb-0">
                  Use the floating AKSHARA chat button for quick help with tests, history, reviews,
                  and account guidance.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className={`dashboard-chat ${chatOpen ? "open" : ""}`}>
        {chatOpen ? (
          <div className="dashboard-chat-panel">
            <div className="dashboard-chat-header">
              <div>
                <strong>AKSHARA Assistant</strong>
                <small>{currentUser?.name || "Learner"} support conversation</small>
              </div>
              <button
                type="button"
                className="dashboard-chat-close"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
              >
                ×
              </button>
            </div>

            <div className="dashboard-chat-messages">
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`dashboard-chat-bubble ${message.role === "user" ? "user" : "assistant"}`}
                >
                  <span className="dashboard-chat-role">
                    {message.role === "user" ? "You" : "AKSHARA"}
                  </span>
                  <p className="mb-0">{message.content}</p>
                </div>
              ))}
              {assistantLoading ? (
                <div className="dashboard-chat-bubble assistant">
                  <span className="dashboard-chat-role">AKSHARA</span>
                  <p className="mb-0">Typing...</p>
                </div>
              ) : null}
            </div>

            <form onSubmit={handleAssistantSubmit} className="dashboard-chat-form">
              <textarea
                className="form-control create-input dashboard-chat-input"
                rows="2"
                placeholder="Ask about tests, dashboard, history, review, or account help."
                value={assistantQuestion}
                onChange={(event) => setAssistantQuestion(event.target.value)}
              />
              <button className="btn btn-ak-primary" disabled={assistantLoading}>
                Send
              </button>
            </form>
          </div>
        ) : null}

        <button
          type="button"
          className="dashboard-chat-fab"
          onClick={() => setChatOpen((current) => !current)}
          aria-label="Open AKSHARA assistant"
        >
          <img src={aksharaLogo} alt="AKSHARA assistant" className="dashboard-chat-fab-logo" />
        </button>
      </div>
    </div>
  );
}
