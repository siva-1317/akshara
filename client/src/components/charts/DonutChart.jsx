import { useEffect, useMemo, useState } from "react";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function DonutChart({
  size = 180,
  thickness = 18,
  segments = [],
  centerLabelTop = "",
  centerLabelBottom = ""
}) {
  const radius = useMemo(() => (size - thickness) / 2, [size, thickness]);
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const total = useMemo(
    () => segments.reduce((sum, segment) => sum + (Number(segment.value) || 0), 0),
    [segments]
  );

  const normalized = useMemo(() => {
    if (!total) {
      return [];
    }
    return segments
      .map((segment) => ({
        ...segment,
        value: Number(segment.value) || 0,
        ratio: clamp((Number(segment.value) || 0) / total, 0, 1)
      }))
      .filter((segment) => segment.value > 0);
  }, [segments, total]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const [tooltip, setTooltip] = useState(null);

  const rings = useMemo(() => {
    let offset = 0;
    return normalized.map((segment) => {
      const length = circumference * (mounted ? segment.ratio : 0);
      const ring = {
        ...segment,
        length,
        offset
      };
      offset += circumference * segment.ratio;
      return ring;
    });
  }, [normalized, circumference, mounted]);

  const empty = total === 0;

  return (
    <div className="ak-donut" style={{ width: size, height: size }}>
      <svg
        className="ak-donut-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Donut chart"
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            className="ak-donut-track"
            stroke="var(--ak-chart-track)"
            strokeWidth={thickness}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {empty ? null : rings.map((segment) => (
            <circle
              key={segment.key || segment.label}
              className="ak-donut-segment"
              stroke={segment.color || "var(--ak-chart-indigo)"}
              strokeWidth={thickness}
              strokeLinecap="round"
              fill="transparent"
              r={radius}
              cx={size / 2}
              cy={size / 2}
              strokeDasharray={`${segment.length} ${circumference}`}
              strokeDashoffset={-segment.offset}
              onMouseMove={(event) => {
                const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                if (!bounds) {
                  return;
                }
                setTooltip({
                  x: event.clientX - bounds.left,
                  y: event.clientY - bounds.top,
                  label: segment.label,
                  value: segment.value
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </g>
      </svg>

      <div className="ak-donut-center">
        <div className="ak-donut-top">{centerLabelTop}</div>
        <div className="ak-donut-bottom">{centerLabelBottom}</div>
      </div>

      {!empty && tooltip ? (
        <div
          className="ak-chart-tooltip"
          style={{
            left: clamp(tooltip.x, 12, size - 12),
            top: clamp(tooltip.y, 12, size - 12)
          }}
        >
          <div className="ak-chart-tooltip-title">{tooltip.label}</div>
          <div className="ak-chart-tooltip-value">{tooltip.value}</div>
        </div>
      ) : null}
    </div>
  );
}
