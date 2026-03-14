import { useEffect, useMemo, useState } from "react";

const clamp01 = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(1, n));
};

export default function CircularGauge({
  value = 0,
  label,
  caption,
  size = 120,
  strokeWidth = 10,
  color = "var(--ak-primary)",
  trackColor = "rgba(148, 163, 184, 0.25)"
}) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const normalized = clamp01(value);

  useEffect(() => {
    const id = window.setTimeout(() => setAnimatedValue(normalized), 50);
    return () => window.clearTimeout(id);
  }, [normalized]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const dash = useMemo(() => circumference * animatedValue, [animatedValue, circumference]);
  const gap = useMemo(() => Math.max(0, circumference - dash), [circumference, dash]);

  const percent = Math.round(normalized * 100);

  return (
    <div className="ak-gauge" style={{ width: size }}>
      <svg className="ak-gauge-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="ak-gauge-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          className="ak-gauge-bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${gap}`}
        />
      </svg>

      <div className="ak-gauge-center">
        <div className="ak-gauge-value">{percent}%</div>
        {label ? <div className="ak-gauge-label">{label}</div> : null}
        {caption ? <div className="ak-gauge-caption">{caption}</div> : null}
      </div>
    </div>
  );
}

