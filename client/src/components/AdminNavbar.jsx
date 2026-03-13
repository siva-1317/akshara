import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import aksharaLogo from "../assets/akshara.png";
import {
  clearNotifications,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
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

export default function AdminNavbar({ theme, onToggleTheme }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("aksharaUser") || "null");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const panelRef = useRef(null);

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

  const handleLogout = () => {
    localStorage.removeItem("aksharaUser");
    navigate("/login");
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

  // Keep the navbar style consistent, but show only admin-relevant nav items.
  return (
    <nav className="navbar navbar-expand-lg navbar-ak admin-navbar sticky-top">
      <div className="container">
        <Link
          className="navbar-brand d-flex align-items-center gap-2 fw-bold"
          to="/admin/dashboard"
          aria-label="AKSHARA Admin"
        >
          <span className="brand-badge">
            <img src={aksharaLogo} alt="AKSHARA" style={{ width: "1.5rem", height: "1.5rem" }} />
          </span>
          <span>
            <span className="brand-title">AKSHARA</span>
            <small className="brand-subtitle d-block">Admin Control</small>
          </span>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarAdmin"
          aria-controls="navbarAdmin"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="navbarAdmin">
          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-2">
            <li className="nav-item">
              <Link className="nav-link" to="/admin/dashboard">Dashboard</Link>
            </li>
            <li className="nav-item d-flex align-items-center">
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
            </li>
            <li className="nav-item d-flex align-items-center">
              <button
                className="theme-toggle-btn ms-lg-2"
                type="button"
                onClick={onToggleTheme}
                aria-label="Toggle theme"
                title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              >
                {theme === "light" ? <MoonIcon /> : <SunIcon />}
              </button>
            </li>
            <li className="nav-item">
              <button className="btn btn-ak-nav btn-sm ms-lg-2" onClick={handleLogout}>
                Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
