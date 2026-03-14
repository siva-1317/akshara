import { useEffect, useMemo, useState } from "react";

export default function RadialProgress({
  size = 160,
  thickness = 14,
  value,
  label,
  sublabel,
  color = "var(--ak-chart-indigo)"
}) {
  const radius = useMemo(() => (size - thickness) / 2, [size, thickness]);
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const normalized = useMemo(() => {
    if (value == null) {
      return null;
    }
    const asNumber = Number(value);
    if (!Number.isFinite(asNumber)) {
      return null;
    }
    return Math.max(0, Math.min(1, asNumber));
  }, [value]);

  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const next = normalized == null ? 0 : normalized;
    const frame = window.requestAnimationFrame(() => setAnimated(next));
    return () => window.cancelAnimationFrame(frame);
  }, [normalized]);

  const dashOffset = circumference * (1 - animated);

  return (
    <div className="ak-radial" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="ak-radial-svg" role="img" aria-label={sublabel || "Progress"}>
        <circle
          className="ak-radial-track"
          stroke="var(--ak-border)"
          strokeWidth={thickness}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="ak-radial-progress"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>

      <div className="ak-radial-center">
        <div className="ak-radial-label">{label}</div>
        {sublabel ? <div className="ak-radial-sublabel">{sublabel}</div> : null}
      </div>
    </div>
  );
}

