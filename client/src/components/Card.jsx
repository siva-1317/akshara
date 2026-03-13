export default function Card({ title, subtitle, children, className = "" }) {
  return (
    <div className={`ak-card ${className}`}>
      {title ? <h5 className="fw-bold mb-1">{title}</h5> : null}
      {subtitle ? <p className="text-muted mb-3">{subtitle}</p> : null}
      {children}
    </div>
  );
}
