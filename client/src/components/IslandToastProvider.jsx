import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

const normalizeToast = (toast) => {
  const type = ["success", "error", "warning", "info"].includes(toast.type) ? toast.type : "info";
  const title = String(toast.title || "").trim();
  const message = String(toast.message || "").trim();
  const durationMs = Math.max(1500, Math.min(12000, Number(toast.durationMs ?? 4500) || 4500));

  return {
    id: toast.id,
    type,
    title,
    message,
    durationMs
  };
};

export const useIslandToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useIslandToast must be used within IslandToastProvider.");
  }
  return ctx;
};

export default function IslandToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (toast) => {
      const id = toast?.id || `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const normalized = normalizeToast({ ...toast, id });

      setToasts((current) => [normalized, ...current].slice(0, 4));

      const timer = window.setTimeout(() => removeToast(id), normalized.durationMs);
      timersRef.current.set(id, timer);

      return id;
    },
    [removeToast]
  );

  const api = useMemo(
    () => ({
      notify,
      remove: removeToast,
      success: (message, opts = {}) => notify({ type: "success", message, ...opts }),
      error: (message, opts = {}) => notify({ type: "error", message, ...opts }),
      info: (message, opts = {}) => notify({ type: "info", message, ...opts }),
      warning: (message, opts = {}) => notify({ type: "warning", message, ...opts })
    }),
    [notify, removeToast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="island-toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div key={toast.id} className={`island-toast ${toast.type}`} role="status">
            <div className="island-toast-body">
              {toast.title ? <strong className="island-toast-title">{toast.title}</strong> : null}
              {toast.message ? <span className="island-toast-message">{toast.message}</span> : null}
            </div>
            <button
              type="button"
              className="island-toast-close"
              aria-label="Dismiss notification"
              onClick={() => removeToast(toast.id)}
            >
              ×
            </button>
            <div
              className="island-toast-progress"
              style={{ animationDuration: `${toast.durationMs}ms` }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

