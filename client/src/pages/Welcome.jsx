import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOnboarding } from "../api";
import { useToast } from "../components/ToastProvider";

export default function Welcome() {
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!error) {
      return;
    }
    toast.error(error);
    setError("");
  }, [error, toast]);

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await getOnboarding();
        if (data?.completed) {
          navigate("/dashboard", { replace: true });
          return;
        }
        navigate("/first-time", { replace: true });
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load onboarding status.");
      }
    };

    run();
  }, [navigate]);

  return (
    <div className="page-shell">
      <div className="container">
        <div className="ak-card">
          <h3 className="fw-bold mb-2">Getting things ready…</h3>
          <p className="text-muted mb-0">
            We’re checking your profile setup.
          </p>
        </div>
      </div>
    </div>
  );
}
