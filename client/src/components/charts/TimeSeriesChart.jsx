import { useMemo, useState } from "react";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildPath = (points) => {
  if (!points.length) {
    return "";
  }
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
};

export default function TimeSeriesChart({ data = [], height = 220 }) {
  const width = 720;
  const paddingX = 24;
  const paddingY = 18;

  const normalized = useMemo(() => {
    const safe = (data || []).map((item) => ({
      key: item.key,
      label: item.label || item.key,
      count: Number(item.count) || 0
    }));
    const max = safe.reduce((current, item) => Math.max(current, item.count), 0);
    return { safe, max };
  }, [data]);

  const points = useMemo(() => {
    const { safe, max } = normalized;
    if (!safe.length) {
      return [];
    }
    const innerWidth = width - paddingX * 2;
    const innerHeight = height - paddingY * 2;
    const denominator = Math.max(1, safe.length - 1);

    return safe.map((item, index) => {
      const x = paddingX + (innerWidth * index) / denominator;
      const ratio = max ? item.count / max : 0;
      const y = paddingY + innerHeight * (1 - ratio);
      return { ...item, x, y };
    });
  }, [normalized, height]);

  const pathD = useMemo(() => buildPath(points), [points]);

  const yTicks = useMemo(() => {
    const max = normalized.max;
    const steps = 4;
    const tickValues = Array.from({ length: steps + 1 }).map((_, index) =>
      Math.round((max * (steps - index)) / steps)
    );

    const innerHeight = height - paddingY * 2;
    return tickValues.map((value, index) => ({
      value,
      y: paddingY + (innerHeight * index) / steps
    }));
  }, [normalized.max, height]);

  const [tooltip, setTooltip] = useState(null);

  const nearestPoint = (svgEvent) => {
    const bounds = svgEvent.currentTarget.getBoundingClientRect();
    const cursorX = svgEvent.clientX - bounds.left;

    if (!points.length) {
      return null;
    }

    let closest = points[0];
    let smallest = Math.abs(points[0].x - cursorX);

    for (let index = 1; index < points.length; index += 1) {
      const distance = Math.abs(points[index].x - cursorX);
      if (distance < smallest) {
        smallest = distance;
        closest = points[index];
      }
    }

    return closest;
  };

  return (
    <div className="ak-timeseries">
      <svg
        className="ak-timeseries-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseMove={(event) => {
          const point = nearestPoint(event);
          if (!point) {
            return;
          }
          setTooltip({ x: point.x, y: point.y, label: point.label, count: point.count });
        }}
        onMouseLeave={() => setTooltip(null)}
        role="img"
        aria-label="Time series chart"
      >
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={paddingX}
              x2={width - paddingX}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--ak-border)"
              strokeWidth="1"
              opacity="0.6"
            />
            <text x={8} y={tick.y + 4} fill="var(--ak-muted)" fontSize="11">
              {tick.value}
            </text>
          </g>
        ))}

        <path className="ak-timeseries-line" d={pathD} fill="none" stroke="var(--ak-chart-indigo)" strokeWidth="3" />
        <path
          className="ak-timeseries-fill"
          d={`${pathD} L ${width - paddingX} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`}
          fill="var(--ak-chart-indigo)"
          opacity="0.12"
        />

        {points.map((point) => (
          <circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r="5"
            fill="var(--ak-bg)"
            stroke="var(--ak-chart-indigo)"
            strokeWidth="2"
          />
        ))}

        {tooltip ? (
          <g>
            <line
              x1={tooltip.x}
              x2={tooltip.x}
              y1={paddingY}
              y2={height - paddingY}
              stroke="var(--ak-chart-indigo)"
              strokeWidth="1"
              opacity="0.35"
            />
          </g>
        ) : null}
      </svg>

      {tooltip ? (
        <div
          className="ak-chart-tooltip ak-chart-tooltip-floating"
          style={{
            left: `${clamp((tooltip.x / width) * 100, 0, 100)}%`,
            top: `${clamp((tooltip.y / height) * 100, 0, 100)}%`
          }}
        >
          <div className="ak-chart-tooltip-title">{tooltip.label}</div>
          <div className="ak-chart-tooltip-value">{tooltip.count} users</div>
        </div>
      ) : null}
    </div>
  );
}

