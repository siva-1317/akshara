import { Link } from "react-router-dom";
import aksharaLogo from "../assets/akshara.png";

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

export default function LandingNavbar({ theme, onToggleTheme }) {
  return (
    <nav className="navbar navbar-expand navbar-dark navbar-ak sticky-top">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2 fw-bold" to="/">
          <img src={aksharaLogo} alt="AKSHARA logo" className="brand-logo-image" />
          <div className="d-flex flex-column lh-sm">
            <span className="brand-title">AKSHARA</span>
            <small className="brand-tagline">AI Powered Test & Learning Portal</small>
          </div>
        </Link>

        <div className="d-flex align-items-center gap-2 ms-auto">
          <button
            className="theme-toggle-btn"
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
          <Link className="btn btn-ak-primary btn-sm" to="/login">
            Login
          </Link>
        </div>
      </div>
    </nav>
  );
}
