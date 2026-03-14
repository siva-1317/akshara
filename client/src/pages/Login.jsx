import { useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Link, useNavigate } from "react-router-dom";
import { loginWithGoogle } from "../api";
import { useToast } from "../components/ToastProvider";

export default function Login() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleWidth, setGoogleWidth] = useState(360);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isDark = typeof document !== "undefined" && document.body?.dataset?.theme === "dark";

  useEffect(() => {
    if (!error) {
      return;
    }
    toast.error(error);
    setError("");
  }, [error, toast]);

  useEffect(() => {
    const computeWidth = () => {
      const viewport = typeof window !== "undefined" ? window.innerWidth : 360;
      const proposed = Math.min(360, Math.max(240, viewport - 64));
      setGoogleWidth(proposed);
    };

    computeWidth();
    window.addEventListener("resize", computeWidth);
    return () => window.removeEventListener("resize", computeWidth);
  }, []);

  const persistUser = (user) => {
    localStorage.setItem("aksharaUser", JSON.stringify(user));
    if (user.isBlocked) {
      navigate("/blocked");
      return;
    }
    const approvalStatus = String(user.approvalStatus || "approved").toLowerCase();
    if (user.role !== "admin" && approvalStatus !== "approved") {
      navigate("/waiting");
      return;
    }
    navigate(user.role === "admin" ? "/admin" : "/dashboard");
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError("");
      const { data } = await loginWithGoogle(credentialResponse.credential);
      persistUser(data.user);
    } catch (err) {
      const serverMessage = err.response?.data?.message;
      if (serverMessage) {
        setError(serverMessage);
      } else if (String(err.message || "").toLowerCase().includes("network")) {
        setError("Cannot reach the server. Check VITE_API_URL and make sure the API is running.");
      } else {
        setError("Google login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card ak-card">
        <div className="d-flex justify-content-start mb-3">
          <Link className="btn btn-sm btn-outline-ak" to="/">
            Back to Home
          </Link>
        </div>
        <h2 className="fw-bold mb-2">Welcome back</h2>
        <p className="text-muted mb-4">
          Sign in to Akshara with your Google account.
        </p>

        <div className="login-provider">
          <div className="login-provider-head">
            <div>
              <h5 className="fw-bold mb-1">Continue with Google</h5>
              <small className="text-muted">Secure sign-in for learners</small>
            </div>
            {loading ? (
              <div className="login-loading" aria-live="polite" aria-label="Signing in">
                <span className="ak-spinner" aria-hidden="true" />
                <span className="text-muted small">Signing in...</span>
              </div>
            ) : null}
          </div>

          {!googleClientId ? (
            <p className="text-muted small mb-0">
              Add <strong>VITE_GOOGLE_CLIENT_ID</strong> to your client <strong>.env</strong> file before using Google
              login.
            </p>
          ) : (
            <div className={`login-google-wrap ${loading ? "is-loading" : ""}`}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError("Google sign-in could not be completed.")}
                useOneTap
                theme={isDark ? "filled_black" : "outline"}
                shape="pill"
                size="large"
                text="continue_with"
                width={String(googleWidth)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
