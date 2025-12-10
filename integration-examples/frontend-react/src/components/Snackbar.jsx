import { useEffect } from "react";

/**
 * Snackbar - Auto-dismissing notification component for errors
 */
export function Snackbar({ message, type = "error", onClose, duration = 5000 }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className={`snackbar snackbar-${type}`}>
      <div className="snackbar-content">
        <span className="snackbar-icon">
          {type === "error" ? "⚠" : "ℹ"}
        </span>
        <span className="snackbar-message">{message}</span>
        <button className="snackbar-close" onClick={onClose} title="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}
