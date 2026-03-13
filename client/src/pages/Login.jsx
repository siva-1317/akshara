import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { loginWithGoogle, loginWithPassword } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const persistUser = (user) => {
    localStorage.setItem("aksharaUser", JSON.stringify(user));
    if (user.isBlocked) {
      navigate("/blocked");
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
      setError(err.response?.data?.message || "Google login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = ({ target }) => {
    setForm((current) => ({
      ...current,
      [target.name]: target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      const { data } = await loginWithPassword(form);
      persistUser(data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-6">
            <div className="ak-card">
              <h2 className="fw-bold mb-3">Login to AKSHARA</h2>
              <p className="text-muted mb-4">
                Use admin credentials for the admin panel or Google login for the learner portal.
              </p>

              <div className="row g-4">
                <div className="col-md-6">
                  <div className="h-100 border rounded-4 p-4 bg-white">
                    <h5 className="fw-bold mb-3">Admin Login</h5>
                    <form onSubmit={handleSubmit} className="d-grid gap-3">
                      <div>
                        <label className="form-label">Username / Email</label>
                        <input
                          className="form-control"
                          name="email"
                          value={form.email}
                          onChange={handleChange}
                          placeholder="admin@gmail.com"
                        />
                      </div>
                      <div>
                        <label className="form-label">Password</label>
                        <input
                          className="form-control"
                          type="password"
                          name="password"
                          value={form.password}
                          onChange={handleChange}
                          placeholder="admin123"
                        />
                      </div>
                      <button className="btn btn-ak-primary" disabled={loading}>
                        {loading ? "Signing in..." : "Login with Password"}
                      </button>
                    </form>
                    <p className="text-muted small mb-0 mt-3">
                      Default admin: `admin@gmail.com` / `admin123`
                    </p>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="h-100 border rounded-4 p-4 bg-white text-center">
                    <h5 className="fw-bold mb-3">User Login</h5>
                    <p className="text-muted mb-4">
                      Continue with Google to access your learner dashboard, tests, and history.
                    </p>
                    {!googleClientId ? (
                      <div className="alert alert-warning text-start mb-0">
                        Add `VITE_GOOGLE_CLIENT_ID` to your client `.env` file before using
                        Google login.
                      </div>
                    ) : (
                      <>
                        <div className="d-flex justify-content-center mb-3">
                          <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => setError("Google sign-in could not be completed.")}
                            useOneTap
                          />
                        </div>
                        {loading ? <p className="text-muted mb-0">Signing you in...</p> : null}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {error ? <div className="alert alert-danger mt-3 mb-0">{error}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
