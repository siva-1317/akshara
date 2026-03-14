import { useMemo, useState } from "react";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function TimeSeriesChart({ data = [], height = 220 }) {
  const width = 720;
  const paddingX = 24;
  const paddingY = 18;
  const minBarHeight = 8;

  const normalized = useMemo(() => {
    const safe = (data || []).map((item) => ({
      key: item.key,
      label: item.label || item.key,
      count: Number(item.count) || 0
    }));
    const max = safe.reduce((current, item) => Math.max(current, item.count), 0);
    return { safe, max };
  }, [data]);

  const bars = useMemo(() => {
    const { safe, max } = normalized;
    if (!safe.length) {
      return [];
    }
    const innerWidth = width - paddingX * 2;
    const innerHeight = height - paddingY * 2;

    const step = innerWidth / safe.length;
    const barWidth = Math.max(6, step * 0.62);
    const gap = step - barWidth;

    return safe.map((item, index) => {
      const ratio = max ? item.count / max : 0;
      const rawHeight = innerHeight * ratio;
      const barHeight = item.count > 0 ? Math.max(minBarHeight, rawHeight) : minBarHeight;
      const x = paddingX + index * step + gap / 2;
      const y = paddingY + (innerHeight - barHeight);
      return {
        ...item,
        index,
        x,
        y,
        width: barWidth,
        height: barHeight,
        centerX: x + barWidth / 2
      };
    });
  }, [normalized, height]);

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

  const nearestBar = (svgEvent) => {
    const bounds = svgEvent.currentTarget.getBoundingClientRect();
    const cursorX = svgEvent.clientX - bounds.left;

    if (!bars.length) {
      return null;
    }

    let closest = bars[0];
    let smallest = Math.abs(bars[0].centerX - cursorX);

    for (let index = 1; index < bars.length; index += 1) {
      const distance = Math.abs(bars[index].centerX - cursorX);
      if (distance < smallest) {
        smallest = distance;
        closest = bars[index];
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
          const bar = nearestBar(event);
          if (!bar) {
            return;
          }
          setTooltip({ x: bar.centerX, y: bar.y, label: bar.label, count: bar.count });
        }}
        onMouseLeave={() => setTooltip(null)}
        role="img"
        aria-label="Time series chart"
      >
        <defs>
          <linearGradient id="akBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ak-primary)" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#ff9147" stopOpacity="0.92" />
          </linearGradient>
        </defs>

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

        <line
          x1={paddingX}
          x2={width - paddingX}
          y1={height - paddingY}
          y2={height - paddingY}
          stroke="var(--ak-border)"
          strokeWidth="1"
          opacity="0.8"
        />

        {bars.map((bar) => (
          <rect
            key={bar.key}
            className={`ak-timeseries-bar ${bar.count ? "" : "ak-timeseries-bar-zero"}`}
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={Math.max(0, bar.height)}
            rx={10}
            fill={bar.count ? "url(#akBarGradient)" : "var(--ak-chart-track)"}
            style={{ "--ak-bar-delay": `${bar.index * 55}ms` }}
            onMouseEnter={() => setTooltip({ x: bar.centerX, y: bar.y, label: bar.label, count: bar.count })}
            onMouseLeave={() => setTooltip(null)}
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
