import { useEffect, useMemo, useState } from "react";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeSegments = (segments) => {
  const cleaned = (segments || [])
    .map((segment) => ({
      ...segment,
      value: Math.max(0, toNumber(segment.value))
    }))
    .filter((segment) => segment.value > 0);

  const total = cleaned.reduce((sum, segment) => sum + segment.value, 0);
  if (!total) {
    return { total: 0, segments: [] };
  }

  return {
    total,
    segments: cleaned.map((segment) => ({ ...segment, ratio: segment.value / total }))
  };
};

export default function CircularSegments({
  segments,
  title,
  subtitle,
  size = 160,
  strokeWidth = 12,
  trackColor = "rgba(148, 163, 184, 0.22)"
}) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setAnimate(true), 50);
    return () => window.clearTimeout(id);
  }, []);

  const { total, segments: normalized } = useMemo(() => normalizeSegments(segments), [segments]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = circumference * 0.25; // start at 12 o'clock

  return (
    <div className="ak-segments">
      <div className="ak-segments-chart" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {normalized.map((segment) => {
            const dash = circumference * (animate ? segment.ratio : 0);
            const gap = Math.max(0, circumference - dash);
            const dashOffset = offset;
            offset -= circumference * segment.ratio;

            return (
              <circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={dashOffset}
                className="ak-segments-ring"
              />
            );
          })}
        </svg>
        <div className="ak-segments-center">
          <div className="ak-segments-total">{total}</div>
          <div className="ak-segments-label">{title}</div>
          {subtitle ? <div className="ak-segments-caption">{subtitle}</div> : null}
        </div>
      </div>

      <div className="ak-segments-legend">
        {normalized.length ? (
          normalized.map((segment) => (
            <div key={segment.key} className="ak-legend-row">
              <span className="ak-legend-dot" style={{ background: segment.color }} />
              <span className="ak-legend-name">{segment.label}</span>
              <span className="ak-legend-value">{segment.value}</span>
            </div>
          ))
        ) : (
          <div className="text-muted">No data.</div>
        )}
      </div>
    </div>
  );
}

