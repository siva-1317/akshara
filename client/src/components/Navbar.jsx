import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import aksharaLogo from "../assets/akshara.png";
import { useToast } from "./ToastProvider";
import {
  clearNotifications,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  requestCoins
} from "../api";

const BellIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
    <path
      d="M12 3a4 4 0 0 0-4 4v1.1c0 .7-.2 1.4-.6 1.9L6 12.2c-.8 1-.2 2.5 1.1 2.5h9.8c1.3 0 1.9-1.5 1.1-2.5L16.6 10c-.4-.5-.6-1.2-.6-1.9V7a4 4 0 0 0-4-4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.8 18a2.5 2.5 0 0 0 4.4 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
    <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9 6.4 6.4M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
    <path
      d="M14.8 3.4a8.7 8.7 0 1 0 5.8 14.9A9.6 9.6 0 0 1 14.8 3.4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="mini-icon">
    <path
      d="m5 12.5 4.2 4.2L19 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ClearIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="mini-icon">
    <path
      d="M6 6 18 18M18 6 6 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const CoinIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
    <path
      d="M12 3.5c4.6 0 8.3 1.6 8.3 3.6S16.6 10.7 12 10.7 3.7 9.1 3.7 7.1 7.4 3.5 12 3.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M3.7 7.1v4.2c0 2 3.7 3.6 8.3 3.6s8.3-1.6 8.3-3.6V7.1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M3.7 11.3v4.2c0 2 3.7 3.6 8.3 3.6s8.3-1.6 8.3-3.6v-4.2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    />
  </svg>
);

export default function AppNavbar({ theme, onToggleTheme }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("aksharaUser") || "null");
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCoins, setShowCoins] = useState(false);
  const [showCoinRequest, setShowCoinRequest] = useState(false);
  const [coinForm, setCoinForm] = useState({ requestedCoins: 50, reason: "" });
  const [coinLoading, setCoinLoading] = useState(false);
  const [coinRequestTop, setCoinRequestTop] = useState(96);
  const panelRef = useRef(null);
  const coinPanelRef = useRef(null);
  const coinRequestRef = useRef(null);
  const navRef = useRef(null);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  useEffect(() => {
    const loadNotifications = async () => {
      if (!user) {
        setNotifications([]);
        return;
      }

      try {
        const { data } = await getNotifications();
        setNotifications(data.notifications || []);
      } catch (error) {
        console.error(error);
      }
    };

    loadNotifications();
  }, [user?.id, user?.role, user?.isBlocked]);

  useEffect(() => {
    if (!showNotifications) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!panelRef.current?.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showNotifications]);

  useEffect(() => {
    if (!showCoins) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!coinPanelRef.current?.contains(event.target)) {
        setShowCoins(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowCoins(false);
        setShowCoinRequest(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showCoins]);

  useEffect(() => {
    if (!showCoinRequest) {
      return undefined;
    }

    const updateTop = () => {
      const rect = navRef.current?.getBoundingClientRect();
      if (!rect) {
        setCoinRequestTop(96);
        return;
      }

      setCoinRequestTop(Math.max(12, rect.bottom + 12));
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowCoinRequest(false);
      }
    };

    const handlePointerDown = (event) => {
      if (!coinRequestRef.current?.contains(event.target)) {
        setShowCoinRequest(false);
      }
    };

    updateTop();
    window.addEventListener("resize", updateTop);
    window.addEventListener("scroll", updateTop, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", updateTop);
      window.removeEventListener("scroll", updateTop, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showCoinRequest]);

  const handleLogout = () => {
    localStorage.removeItem("aksharaUser");
    navigate("/login");
  };

  const handleSubmitCoinRequest = async (event) => {
    event.preventDefault();
    if (!user?.id) {
      return;
    }

    try {
      setCoinLoading(true);
      await requestCoins({
        userId: user.id,
        requestedCoins: Number(coinForm.requestedCoins),
        reason: coinForm.reason
      });
      toast.success("Coins request sent to admin.");
      setShowCoinRequest(false);
      setCoinForm({ requestedCoins: 50, reason: "" });
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to submit coins request.");
    } finally {
      setCoinLoading(false);
    }
  };

  const openNotification = async (notificationId) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item
        )
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (error) {
      console.error(error);
    }
  };

  const handleClearNotifications = async () => {
    try {
      await clearNotifications();
      setNotifications([]);
      setShowNotifications(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      {showCoinRequest
        ? createPortal(
            <>
              <button
                type="button"
                className="coin-request-backdrop"
                aria-label="Close coin request"
                onClick={() => setShowCoinRequest(false)}
              />
              <div
                className="coin-request-popover"
                style={{ top: `${coinRequestTop}px` }}
                role="dialog"
                aria-label="Request coins"
              >
                <div ref={coinRequestRef} className="ak-card coin-request-card">
                  <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                    <div>
                      <h5 className="fw-bold mb-1">Request Coins</h5>
                      <p className="text-muted mb-0">Tell admin how many coins you need and why.</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-ak btn-sm"
                      onClick={() => setShowCoinRequest(false)}
                    >
                      Close
                    </button>
                  </div>

                  <form onSubmit={handleSubmitCoinRequest} className="d-grid gap-3">
                    <div>
                      <label className="form-label">Coins</label>
                      <div className="field-shell">
                        <input
                          type="number"
                          min="1"
                          required
                          className="form-control create-input"
                          value={coinForm.requestedCoins}
                          onChange={(event) =>
                            setCoinForm((current) => ({
                              ...current,
                              requestedCoins: event.target.value
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Reason (optional)</label>
                      <div className="field-shell">
                        <textarea
                          className="form-control create-input"
                          rows="3"
                          value={coinForm.reason}
                          onChange={(event) =>
                            setCoinForm((current) => ({ ...current, reason: event.target.value }))
                          }
                          placeholder="Why do you need coins?"
                        />
                      </div>
                    </div>
                    <button className="btn btn-ak-primary" disabled={coinLoading}>
                      {coinLoading ? "Submitting..." : "Submit Request"}
                    </button>
                  </form>
                </div>
              </div>
            </>,
            document.body
          )
        : null}
      <nav ref={navRef} className="navbar navbar-expand-lg navbar-dark navbar-ak sticky-top">
        <div className="container">
          <Link
            className="navbar-brand d-flex align-items-center gap-2 fw-bold"
            to={user?.isBlocked ? "/blocked" : user ? "/dashboard" : "/"}
          >
            <img src={aksharaLogo} alt="AKSHARA logo" className="brand-logo-image" />
            <div className="d-flex flex-column lh-sm">
              <span className="brand-title">AKSHARA</span>
              <small className="brand-tagline">AI Powered Test & Learning Portal</small>
            </div>
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNavbar"
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div className="collapse navbar-collapse" id="mainNavbar">
            <div className="navbar-nav ms-auto align-items-lg-center gap-lg-2 position-relative">
              {user ? (
                user.isBlocked ? (
                  <>
                    <Link className="nav-link" to="/blocked">
                      Blocked Status
                    </Link>
                    <button
                      className="theme-toggle-btn ms-lg-2"
                      type="button"
                      onClick={onToggleTheme}
                      aria-label="Toggle theme"
                      title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                    >
                      {theme === "light" ? <MoonIcon /> : <SunIcon />}
                    </button>
                    <button className="btn btn-ak-nav btn-sm ms-lg-2" onClick={handleLogout}>
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link className="nav-link" to="/dashboard">
                      Dashboard
                    </Link>
                    <Link className="nav-link" to="/create-test">
                      Create Test
                    </Link>
                    <Link className="nav-link" to="/tasks">
                      Tasks
                    </Link>
                    <Link className="nav-link" to="/history">
                      History
                    </Link>
                    {user.role === "admin" ? (
                      <Link className="nav-link" to="/admin">
                        Admin
                      </Link>
                    ) : null}
                    <button
                      className="notification-btn ms-lg-2"
                      type="button"
                      onClick={() => {
                        setShowCoins((current) => !current);
                      }}
                      aria-label="Coins"
                      title="Coins"
                    >
                      <CoinIcon />
                      <span className="coin-count">{Number.isFinite(user?.coins) ? user.coins : 0}</span>
                    </button>
                  {showCoins ? (
                    <>
                      <button
                        type="button"
                        className="notification-backdrop"
                        aria-label="Close coins panel"
                        onClick={() => setShowCoins(false)}
                      />
                      <div ref={coinPanelRef} className="coin-panel">
                        <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                          <div>
                            <strong className="notification-panel-title">Coins</strong>
                            <small className="text-muted d-block">1 coin = 1 question</small>
                          </div>
                        </div>
                        <div className="coin-balance">
                          <span>Remaining</span>
                          <strong>{Number.isFinite(user?.coins) ? user.coins : 0}</strong>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ak-primary w-100"
                          onClick={() => {
                            setShowCoinRequest(true);
                            setShowCoins(false);
                          }}
                        >
                          Request Coins
                        </button>
                      </div>
                    </>
                  ) : null}

                  <button
                    className="notification-btn ms-lg-2"
                    type="button"
                    onClick={() => setShowNotifications((current) => !current)}
                    aria-label="Notifications"
                  >
                    <BellIcon />
                    {unreadCount ? <span className="notification-count">{unreadCount}</span> : null}
                  </button>
                  {showNotifications ? (
                    <>
                      <button
                        type="button"
                        className="notification-backdrop"
                        aria-label="Close notifications"
                        onClick={() => setShowNotifications(false)}
                      />
                      <div ref={panelRef} className="notification-panel">
                        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                          <div>
                            <strong className="notification-panel-title">Notifications</strong>
                            <small className="text-muted d-block">
                              {notifications.length ? `${notifications.length} items` : "No alerts"}
                            </small>
                          </div>
                          <div className="notification-actions">
                            <button
                              type="button"
                              className="notification-action-btn"
                              onClick={handleMarkAllRead}
                              disabled={!notifications.length || unreadCount === 0}
                              title="Mark all as read"
                            >
                              <span className="notification-action-icon">
                                <CheckIcon />
                              </span>
                              <span>Read</span>
                            </button>
                            <button
                              type="button"
                              className="notification-action-btn danger"
                              onClick={handleClearNotifications}
                              disabled={!notifications.length}
                              title="Clear all notifications"
                            >
                              <span className="notification-action-icon">
                                <ClearIcon />
                              </span>
                              <span>Clear</span>
                            </button>
                          </div>
                        </div>
                        <div className="notification-list">
                          {notifications.length ? (
                            notifications.map((item) => (
                              <button
                                type="button"
                                key={item.id}
                                className={`notification-item ${item.is_read ? "read" : ""}`}
                                onClick={() => openNotification(item.id)}
                              >
                                <div className="notification-item-head">
                                  <strong>{item.title}</strong>
                                  <span className={`notification-status ${item.is_read ? "read" : "unread"}`}>
                                    {item.is_read ? "Read" : "New"}
                                  </span>
                                </div>
                                <span>{item.message}</span>
                              </button>
                            ))
                          ) : (
                            <p className="text-muted mb-0">No notifications yet.</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}
                  <button
                    className="theme-toggle-btn ms-lg-2"
                    type="button"
                    onClick={onToggleTheme}
                    aria-label="Toggle theme"
                    title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                  >
                    {theme === "light" ? <MoonIcon /> : <SunIcon />}
                  </button>
                  <button className="btn btn-ak-nav btn-sm ms-lg-2" onClick={handleLogout}>
                    Logout
                  </button>
                </>
              )
            ) : (
              <>
                <Link className={`nav-link ${location.pathname === "/" ? "active" : ""}`} to="/">
                  Home
                </Link>
                <button
                  className="theme-toggle-btn ms-lg-2"
                  type="button"
                  onClick={onToggleTheme}
                  aria-label="Toggle theme"
                  title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
                >
                  {theme === "light" ? <MoonIcon /> : <SunIcon />}
                </button>
                <Link className="btn btn-light btn-sm ms-lg-3" to="/login">
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      </nav>
    </>
  );
}
