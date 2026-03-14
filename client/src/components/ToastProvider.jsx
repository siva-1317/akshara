import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

const iconFor = (variant) => {
  switch (variant) {
    case "success":
      return "✓";
    case "error":
      return "!";
    case "warning":
      return "⚠";
    default:
      return "i";
  }
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    ({ variant = "info", title = "", message = "", duration = 4200 } = {}) => {
      const id = `toast-${Date.now()}-${(idRef.current += 1)}`;
      const payload = {
        id,
        variant,
        title: String(title || "").trim(),
        message: String(message || "").trim(),
        duration: Math.max(1200, Number(duration) || 0)
      };

      setToasts((current) => [payload, ...current].slice(0, 4));

      window.setTimeout(() => remove(id), payload.duration);
      return id;
    },
    [remove]
  );

  const api = useMemo(
    () => ({
      push,
      success: (message, options = {}) => push({ ...options, variant: "success", message }),
      error: (message, options = {}) => push({ ...options, variant: "error", message }),
      warning: (message, options = {}) => push({ ...options, variant: "warning", message }),
      info: (message, options = {}) => push({ ...options, variant: "info", message }),
      remove
    }),
    [push, remove]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ak-toast-container" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((toast) => (
          <div key={toast.id} className={`ak-toast ak-toast-${toast.variant}`}>
            <div className="ak-toast-icon" aria-hidden="true">
              {iconFor(toast.variant)}
            </div>
            <div className="ak-toast-body">
              {toast.title ? <div className="ak-toast-title">{toast.title}</div> : null}
              {toast.message ? <div className="ak-toast-message">{toast.message}</div> : null}
            </div>
            <button type="button" className="ak-toast-close" onClick={() => remove(toast.id)} aria-label="Close">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }
  return context;
}

