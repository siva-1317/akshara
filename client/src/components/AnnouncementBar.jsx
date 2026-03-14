export default function AnnouncementBar({ message, onDismiss }) {
  if (!message) {
    return null;
  }

  return (
    <div className="announcement-bar" role="status" aria-live="polite">
      <div className="announcement-inner">
        <div className="announcement-marquee" title={message}>
          <span className="announcement-text">{message}</span>
        </div>
        <button type="button" className="announcement-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}

