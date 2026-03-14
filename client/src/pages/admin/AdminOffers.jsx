import { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import {
  cancelAdminOffers,
  createAdminOffers,
  deleteAdminOfferTemplate,
  getAdminOffers,
  getAdminOfferTemplates,
  updateAdminOffer,
  upsertAdminOfferTemplate
} from "../../api";
import CustomSelect from "../../components/CustomSelect";
import { useToast } from "../../components/ToastProvider";
import Pagination from "../../components/Pagination";

const clampPage = (value, totalPages) => Math.max(1, Math.min(Number(value) || 1, totalPages));

const isOfferActive = (offer) => {
  if (!offer || offer.status !== "active") {
    return false;
  }

  const now = Date.now();
  const startsAt = offer.starts_at ? new Date(offer.starts_at).getTime() : now;
  const endsAt = offer.ends_at ? new Date(offer.ends_at).getTime() : null;

  if (Number.isFinite(startsAt) && startsAt > now) {
    return false;
  }

  return endsAt == null || (Number.isFinite(endsAt) && endsAt > now);
};

const formatRemaining = (endsAt) => {
  if (!endsAt) {
    return "Lifetime";
  }

  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) {
    return "-";
  }

  const diff = end - Date.now();
  if (diff <= 0) {
    return "Expired";
  }

  const seconds = Math.floor(diff / 1000);
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};

export default function AdminOffers({ users }) {
  const toast = useToast();
  const [tab, setTab] = useState("active");
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState("manual");
  const [selected, setSelected] = useState(() => new Set());
  const [offers, setOffers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [offersOpen, setOffersOpen] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState("");
  const [editEndsAtLocal, setEditEndsAtLocal] = useState("");
  const [editFixedQuestionCount, setEditFixedQuestionCount] = useState("");
  const [editFixedDifficulty, setEditFixedDifficulty] = useState("");
  const [editFixedExamType, setEditFixedExamType] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [offersPage, setOffersPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [offerType, setOfferType] = useState("time");
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [days, setDays] = useState(7);
  const [fixedQuestionCount, setFixedQuestionCount] = useState("");
  const [fixedDifficulty, setFixedDifficulty] = useState("");
  const [fixedExamType, setFixedExamType] = useState("");

  const offerTypeOptions = useMemo(
    () => [
      { value: "time", label: "Time based (end date/time)" },
      { value: "days", label: "Days based (from now)" },
      { value: "lifetime", label: "Lifetime access free" }
    ],
    []
  );

  const templateOptions = useMemo(() => {
    const opts = [{ value: "", label: "No template" }];
    (templates || []).forEach((template) => {
      opts.push({ value: template.id, label: template.name });
    });
    return opts;
  }, [templates]);

  const difficultyOptions = useMemo(
    () => [
      { value: "", label: "User can choose" },
      { value: "easy", label: "Easy" },
      { value: "medium", label: "Medium" },
      { value: "hard", label: "Hard" }
    ],
    []
  );

  const examTypeOptions = useMemo(
    () => [
      { value: "", label: "User can choose" },
      { value: "no return", label: "No Return" },
      { value: "return allowed", label: "Return Allowed" },
      { value: "per question timer", label: "Per Question Timer" },
      { value: "total timer", label: "Total Timer" }
    ],
    []
  );

  const selectModeOptions = useMemo(
    () => [
      { value: "manual", label: "Select by condition" },
      { value: "active-users", label: "All active users" },
      { value: "blocked-users", label: "All blocked users" },
      { value: "all-filtered", label: "All filtered users" }
    ],
    []
  );

  const userList = useMemo(
    () => (users || []).filter((user) => user.role !== "admin"),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const base = tab === "blocked"
      ? userList.filter((user) => user.is_blocked)
      : tab === "all"
        ? userList
        : userList.filter((user) => !user.is_blocked);

    const needle = String(search || "").trim().toLowerCase();
    if (!needle) {
      return base;
    }

    return base.filter((user) => {
      const name = String(user.name || "").toLowerCase();
      const email = String(user.email || "").toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });
  }, [search, tab, userList]);

  useEffect(() => {
    setUserPage(1);
  }, [search, tab]);

  const userTotal = filteredUsers.length;
  const userPageSize = 10;
  const userTotalPages = Math.max(1, Math.ceil(userTotal / userPageSize));
  const currentUserPage = clampPage(userPage, userTotalPages);
  const pagedUsers = useMemo(() => {
    const start = (currentUserPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [currentUserPage, filteredUsers]);

  useEffect(() => {
    if (userPage !== currentUserPage) {
      setUserPage(currentUserPage);
    }
  }, [currentUserPage, userPage]);

  const offersTotal = (offers || []).length;
  const offersPageSize = 10;
  const offersTotalPages = Math.max(1, Math.ceil(offersTotal / offersPageSize));
  const currentOffersPage = clampPage(offersPage, offersTotalPages);
  const pagedOffers = useMemo(() => {
    const start = (currentOffersPage - 1) * offersPageSize;
    return (offers || []).slice(start, start + offersPageSize);
  }, [currentOffersPage, offers]);

  useEffect(() => {
    if (offersPage !== currentOffersPage) {
      setOffersPage(currentOffersPage);
    }
  }, [currentOffersPage, offersPage]);

  const activeOffers = useMemo(() => (offers || []).filter(isOfferActive), [offers]);
  const activeOfferUserIds = useMemo(
    () => new Set(activeOffers.map((offer) => offer.user_id)),
    [activeOffers]
  );

  const activeOfferByType = useMemo(() => {
    return activeOffers.reduce(
      (accumulator, offer) => {
        const key = String(offer.offer_type || "").toLowerCase();
        if (key === "time") {
          accumulator.time += 1;
        } else if (key === "days") {
          accumulator.days += 1;
        } else if (key === "lifetime") {
          accumulator.lifetime += 1;
        } else {
          accumulator.other += 1;
        }
        accumulator.usersByType[key] = accumulator.usersByType[key] || new Set();
        accumulator.usersByType[key].add(offer.user_id);
        return accumulator;
      },
      { time: 0, days: 0, lifetime: 0, other: 0, usersByType: {} }
    );
  }, [activeOffers]);

  const selectedCount = selected.size;

  const loadOffers = async () => {
    try {
      setLoading(true);
      setError("");
      const [offersResponse, templatesResponse] = await Promise.all([
        getAdminOffers(),
        getAdminOfferTemplates()
      ]);
      setOffers(offersResponse.data.offers || []);
      setTemplates(templatesResponse.data.templates || []);
    } catch (err) {
      const message = err.response?.data?.message || "Unable to load offers.";
      setError(message);
      toast.error(message, { title: "Offers" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  useEffect(() => {
    if (!templateId) {
      return;
    }

    const matched = (templates || []).find((item) => item.id === templateId) || null;
    if (!matched) {
      return;
    }

    setTemplateName(matched.name || "");
    setOfferType(matched.offer_type || "time");
    setDays(matched.days || 7);
    setFixedQuestionCount(matched.fixed_question_count == null ? "" : String(matched.fixed_question_count));
    setFixedDifficulty(matched.fixed_difficulty || "");
    setFixedExamType(matched.fixed_exam_type || "");
  }, [templateId, templates]);

  useEffect(() => {
    if (selectMode === "manual") {
      return;
    }

    const next = new Set(selected);
    if (selectMode === "active-users") {
      userList.filter((user) => !user.is_blocked).forEach((user) => next.add(user.id));
    } else if (selectMode === "blocked-users") {
      userList.filter((user) => user.is_blocked).forEach((user) => next.add(user.id));
    } else if (selectMode === "all-filtered") {
      filteredUsers.forEach((user) => next.add(user.id));
    }

    setSelected(next);
    setSelectMode("manual");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectMode]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setOffers((current) => [...current]);
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const toggleUser = (userId) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected((current) => {
      const next = new Set(current);
      filteredUsers.forEach((user) => next.add(user.id));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const applyOffer = async () => {
    if (!selectedCount) {
      const message = "Select at least one user.";
      setError(message);
      toast.warning(message, { title: "Offers" });
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const payload = {
        userIds: Array.from(selected),
        offerType,
        fixedQuestionCount: (() => {
          const raw = String(fixedQuestionCount ?? "").trim();
          if (!raw) {
            return null;
          }
          const parsed = Math.floor(Number(raw));
          return Number.isFinite(parsed) ? parsed : null;
        })(),
        fixedDifficulty: fixedDifficulty || null,
        fixedExamType: fixedExamType || null
      };

      if (offerType === "time") {
        const parsed = new Date(endsAtLocal);
        if (Number.isNaN(parsed.getTime())) {
          const message = "Pick a valid end date/time.";
          setError(message);
          toast.warning(message, { title: "Offers" });
          return;
        }
        payload.endsAt = parsed.toISOString();
      }

      if (offerType === "days") {
        payload.days = days;
      }

      await createAdminOffers(payload);
      await loadOffers();
      toast.success("Offer applied to selected users.", { title: "Offers" });
    } catch (err) {
      const message = err.response?.data?.message || "Unable to create offer.";
      setError(message);
      toast.error(message, { title: "Offers" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    const name = String(templateName || "").trim();
    if (!name) {
      const message = "Template name is required.";
      setError(message);
      toast.warning(message, { title: "Templates" });
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      await upsertAdminOfferTemplate({
        name,
        offerType,
        days: offerType === "days" ? days : null,
        fixedQuestionCount: (() => {
          const raw = String(fixedQuestionCount ?? "").trim();
          if (!raw) {
            return null;
          }
          const parsed = Math.floor(Number(raw));
          return Number.isFinite(parsed) ? parsed : null;
        })(),
        fixedDifficulty: fixedDifficulty || null,
        fixedExamType: fixedExamType || null
      });
      await loadOffers();
      toast.success("Template saved.", { title: "Templates" });
    } catch (err) {
      const message = err.response?.data?.message || "Unable to save template.";
      setError(message);
      toast.error(message, { title: "Templates" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateId) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      await deleteAdminOfferTemplate(templateId);
      setTemplateId("");
      await loadOffers();
      toast.success("Template deleted.", { title: "Templates" });
    } catch (err) {
      const message = err.response?.data?.message || "Unable to delete template.";
      setError(message);
      toast.error(message, { title: "Templates" });
    } finally {
      setActionLoading(false);
    }
  };

  const cancelOfferForUsers = async (userIds) => {
    const list = Array.isArray(userIds) ? userIds : [];
    if (!list.length) {
      const message = "Select at least one user.";
      setError(message);
      toast.warning(message, { title: "Offers" });
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      await cancelAdminOffers({ userIds: list });
      await loadOffers();
      toast.success("Offer cancelled.", { title: "Offers" });
    } catch (err) {
      const message = err.response?.data?.message || "Unable to cancel offers.";
      setError(message);
      toast.error(message, { title: "Offers" });
    } finally {
      setActionLoading(false);
    }
  };

  const openEditOffer = (offer) => {
    setEditingOfferId(offer.id);
    setEditEndsAtLocal(offer.ends_at ? new Date(offer.ends_at).toISOString().slice(0, 16) : "");
    setEditFixedQuestionCount(
      offer.fixed_question_count == null ? "" : String(offer.fixed_question_count)
    );
    setEditFixedDifficulty(offer.fixed_difficulty || "");
    setEditFixedExamType(offer.fixed_exam_type || "");
  };

  const saveOfferEdit = async () => {
    if (!editingOfferId) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const payload = {
        endsAt: editEndsAtLocal ? new Date(editEndsAtLocal).toISOString() : editEndsAtLocal === "" ? "" : undefined,
        fixedQuestionCount: editFixedQuestionCount === "" ? "" : Number(editFixedQuestionCount),
        fixedDifficulty: editFixedDifficulty || "",
        fixedExamType: editFixedExamType || ""
      };

      await updateAdminOffer(editingOfferId, payload);
      await loadOffers();
      toast.success("Offer updated.", { title: "Offers" });
      setEditingOfferId("");
    } catch (err) {
      const message = err.response?.data?.message || "Unable to update offer.";
      setError(message);
      toast.error(message, { title: "Offers" });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h2 className="section-title mb-1">Offers</h2>
          <p className="text-muted mb-0">
            Grant users unlimited tests without consuming coins for a limited time, days, or lifetime.
          </p>
        </div>
      </div>

      {null}
      {loading || actionLoading ? <div className="loading-pill mb-3">Updating...</div> : null}

      <Card title="Active offers" subtitle="Snapshot across all users" className="h-auto mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <small className="text-muted mb-0">Live totals</small>
          <button
            type="button"
            className="btn btn-link p-0"
            onClick={() => {
              setOffersPage(1);
              setOffersOpen(true);
            }}
            style={{ fontWeight: 800, color: "var(--ak-primary)" }}
          >
            View offers
          </button>
        </div>

        <div className="row g-3">
          <div className="col-lg-3 col-sm-6">
            <div className="mini-stat-card">
              <small>Total active offers</small>
              <strong>{activeOffers.length}</strong>
            </div>
          </div>
          <div className="col-lg-3 col-sm-6">
            <div className="mini-stat-card">
              <small>Users on offer</small>
              <strong>{activeOfferUserIds.size}</strong>
            </div>
          </div>
          <div className="col-lg-2 col-sm-4">
            <div className="mini-stat-card">
              <small>Time based</small>
              <strong>{activeOfferByType.time}</strong>
            </div>
          </div>
          <div className="col-lg-2 col-sm-4">
            <div className="mini-stat-card">
              <small>Days based</small>
              <strong>{activeOfferByType.days}</strong>
            </div>
          </div>
          <div className="col-lg-2 col-sm-4">
            <div className="mini-stat-card">
              <small>Lifetime</small>
              <strong>{activeOfferByType.lifetime}</strong>
            </div>
          </div>
        </div>
      </Card>

      <div className="row g-4 align-items-start">
        <div className="col-lg-7">
          <Card title="User selection" subtitle="Filter, search, and select users for offers" className="h-auto">
            <div className="d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap">
              <div className="admin-tabs">
                <button
                  type="button"
                  className={`admin-tab-btn ${tab === "active" ? "active" : ""}`}
                  onClick={() => setTab("active")}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={`admin-tab-btn ${tab === "blocked" ? "active" : ""}`}
                  onClick={() => setTab("blocked")}
                >
                  Blocked
                </button>
                <button
                  type="button"
                  className={`admin-tab-btn ${tab === "all" ? "active" : ""}`}
                  onClick={() => setTab("all")}
                >
                  All
                </button>
              </div>

              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div className="field-shell" style={{ minWidth: 240 }}>
                  <input
                    className="form-control create-input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name or email"
                  />
                </div>
                <small className="text-muted mb-0">{filteredUsers.length} users</small>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
              <div className="d-flex gap-2 flex-wrap">
                <button type="button" className="btn btn-outline-ak btn-sm" onClick={selectAllFiltered}>
                  Select filtered
                </button>
                <button type="button" className="btn btn-outline-ak btn-sm" onClick={clearSelection}>
                  Clear selection
                </button>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <small className="text-muted">Selected: {selectedCount}</small>
                <div className="field-shell" style={{ width: 240 }}>
                  <CustomSelect
                    className="create-select"
                    value={selectMode}
                    options={selectModeOptions}
                    onChange={(event) => setSelectMode(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-ak align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>Select</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.length ? (
                    pagedUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <label className={`ak-checkbox ${selected.has(user.id) ? "checked" : ""}`}>
                            <input
                              type="checkbox"
                              className="ak-checkbox-input"
                              checked={selected.has(user.id)}
                              onChange={() => toggleUser(user.id)}
                              aria-label={`Select ${user.name || "user"}`}
                            />
                            <span className="ak-checkbox-box" aria-hidden="true" />
                          </label>
                        </td>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`status-tag ${user.is_blocked ? "blocked" : "active"}`}>
                            {user.is_blocked ? "Blocked" : "Active"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center text-muted py-4">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              className="mt-3"
              page={currentUserPage}
              pageSize={userPageSize}
              total={userTotal}
              onPageChange={setUserPage}
            />
          </Card>
        </div>

        <div className="col-lg-5">
          <Card title="Create offer" subtitle="Users can attend unlimited tests without coins" className="h-auto">
            <div className="d-grid gap-3">
              <div>
                <label className="form-label create-label">Template</label>
                <div className="field-shell">
                  <CustomSelect
                    className="create-select"
                    value={templateId}
                    options={templateOptions}
                    onChange={(event) => setTemplateId(event.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label create-label">Offer type</label>
                <div className="field-shell">
                  <CustomSelect
                    className="create-select"
                    value={offerType}
                    options={offerTypeOptions}
                    onChange={(event) => setOfferType(event.target.value)}
                  />
                </div>
              </div>

              <Card title="Offer template" subtitle="Save this configuration for reuse" className="p-3">
                <div className="d-grid gap-2">
                  <div className="field-shell">
                    <input
                      className="form-control create-input"
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                      placeholder="Template name"
                    />
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-outline-ak"
                      disabled={actionLoading}
                      onClick={handleSaveTemplate}
                    >
                      Save Template
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-ak-danger"
                      disabled={actionLoading || !templateId}
                      onClick={handleDeleteTemplate}
                    >
                      Delete Template
                    </button>
                  </div>
                </div>
              </Card>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label create-label">Fixed question count</label>
                  <div className="field-shell">
                    <input
                      type="number"
                      min="1"
                      className="form-control create-input"
                      value={fixedQuestionCount}
                      onChange={(event) => setFixedQuestionCount(event.target.value)}
                      placeholder="User can choose"
                    />
                  </div>
                  <small className="text-muted d-block mt-2">
                    Leave empty to let user pick count when using offer.
                  </small>
                </div>
                <div className="col-md-6">
                  <label className="form-label create-label">Fixed difficulty</label>
                  <div className="field-shell">
                    <CustomSelect
                      className="create-select"
                      value={fixedDifficulty}
                      options={difficultyOptions}
                      onChange={(event) => setFixedDifficulty(event.target.value)}
                    />
                  </div>
                  <small className="text-muted d-block mt-2">
                    Set to restrict difficulty for offer tests.
                  </small>
                </div>
                <div className="col-12">
                  <label className="form-label create-label">Fixed exam mode</label>
                  <div className="field-shell">
                    <CustomSelect
                      className="create-select"
                      value={fixedExamType}
                      options={examTypeOptions}
                      onChange={(event) => setFixedExamType(event.target.value)}
                    />
                  </div>
                  <small className="text-muted d-block mt-2">
                    Set to restrict exam mode for offer tests.
                  </small>
                </div>
              </div>

              {offerType === "time" ? (
                <div>
                  <label className="form-label create-label">End date & time</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={endsAtLocal}
                    onChange={(event) => setEndsAtLocal(event.target.value)}
                  />
                </div>
              ) : null}

              {offerType === "days" ? (
                <div>
                  <label className="form-label create-label">Days</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={days}
                    onChange={(event) => setDays(Number(event.target.value))}
                  />
                </div>
              ) : null}

              <button
                type="button"
                className="btn btn-ak-primary"
                disabled={actionLoading || !selectedCount}
                onClick={applyOffer}
              >
                Apply offer to selected users
              </button>

              <button
                type="button"
                className="btn btn-outline-ak-danger"
                disabled={actionLoading || !selectedCount}
                onClick={() => cancelOfferForUsers(Array.from(selected))}
              >
                Cancel offer for selected users
              </button>
            </div>
          </Card>

          {null}
        </div>
      </div>

      {offersOpen ? (
        <>
          <button
            type="button"
            className="modal-backdrop-ak"
            aria-label="Close offers list"
            onClick={() => {
              setOffersOpen(false);
              setEditingOfferId("");
            }}
          />
          <div className="modal-card-ak" role="dialog" aria-modal="true">
            <div className="ak-card" style={{ width: "min(980px, 94vw)" }}>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h5 className="fw-bold mb-1">All offers</h5>
                  <p className="text-muted mb-0">View, edit, and cancel offers.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-ak btn-sm"
                  onClick={() => {
                    setOffersOpen(false);
                    setEditingOfferId("");
                  }}
                >
                  Close
                </button>
              </div>

              {error ? <div className="text-muted small mb-2">{error}</div> : null}

              <div className="table-responsive" style={{ maxHeight: "70vh", overflow: "auto" }}>
                <table className="table table-ak align-middle mb-0">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Type</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Restrictions</th>
                      <th>Status</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedOffers.length ? (
                      pagedOffers.map((offer) => {
                        const isEditing = editingOfferId === offer.id;
                        const restrictions = [
                          offer.fixed_question_count != null ? `${offer.fixed_question_count}Q` : null,
                          offer.fixed_difficulty ? offer.fixed_difficulty : null,
                          offer.fixed_exam_type ? offer.fixed_exam_type : null
                        ].filter(Boolean).join(" • ");

                        return (
                          <tr key={offer.id}>
                            <td>
                              <div className="fw-bold">{offer.submitter?.name || offer.user_id}</div>
                              <small className="text-muted">{offer.submitter?.email || ""}</small>
                            </td>
                            <td className="text-capitalize">{offer.offer_type}</td>
                            <td>{offer.starts_at ? new Date(offer.starts_at).toLocaleString() : "-"}</td>
                            <td>{offer.ends_at ? new Date(offer.ends_at).toLocaleString() : "Lifetime"}</td>
                            <td>{restrictions || "-"}</td>
                            <td className="text-capitalize">{offer.status}</td>
                            <td className="text-end">
                              {isOfferActive(offer) ? (
                                <div className="d-flex justify-content-end gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-ak"
                                    disabled={actionLoading}
                                    onClick={() => openEditOffer(offer)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-ak-danger"
                                    disabled={actionLoading}
                                    onClick={() => cancelOfferForUsers([offer.user_id])}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <span className="text-muted small">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-4">
                          No offers yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                className="mt-3"
                page={currentOffersPage}
                pageSize={offersPageSize}
                total={offersTotal}
                onPageChange={setOffersPage}
              />

              {editingOfferId ? (
                <div className="mt-3">
                  <Card title="Edit offer" subtitle="Update end time and restrictions" className="h-auto">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label create-label">End date & time</label>
                        <input
                          type="datetime-local"
                          className="form-control"
                          value={editEndsAtLocal}
                          onChange={(event) => setEditEndsAtLocal(event.target.value)}
                        />
                        <small className="text-muted d-block mt-2">
                          Clear only works for lifetime offers.
                        </small>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label create-label">Fixed question count</label>
                        <div className="field-shell">
                          <input
                            type="number"
                            min="1"
                            className="form-control create-input"
                            value={editFixedQuestionCount}
                            onChange={(event) => setEditFixedQuestionCount(event.target.value)}
                            placeholder="User can choose"
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label create-label">Fixed difficulty</label>
                        <div className="field-shell">
                          <CustomSelect
                            className="create-select"
                            value={editFixedDifficulty}
                            options={difficultyOptions}
                            onChange={(event) => setEditFixedDifficulty(event.target.value)}
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label create-label">Fixed exam mode</label>
                        <div className="field-shell">
                          <CustomSelect
                            className="create-select"
                            value={editFixedExamType}
                            options={examTypeOptions}
                            onChange={(event) => setEditFixedExamType(event.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="d-flex justify-content-end gap-2 mt-3 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-outline-ak"
                        disabled={actionLoading}
                        onClick={() => setEditingOfferId("")}
                      >
                        Cancel edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ak-primary"
                        disabled={actionLoading}
                        onClick={saveOfferEdit}
                      >
                        Save changes
                      </button>
                    </div>
                  </Card>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
