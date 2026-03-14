import { useMemo } from "react";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildPages = (current, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const pages = new Set([1, totalPages, current, current - 1, current + 1]);
  const cleaned = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const withGaps = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    const p = cleaned[i];
    const prev = cleaned[i - 1];
    if (prev && p - prev > 1) {
      withGaps.push("gap");
    }
    withGaps.push(p);
  }
  return withGaps;
};

export default function Pagination({ page, pageSize, total, onPageChange, className = "" }) {
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / (Number(pageSize) || 10)));
  const current = clamp(Number(page) || 1, 1, totalPages);

  const items = useMemo(() => buildPages(current, totalPages), [current, totalPages]);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={`d-flex justify-content-between align-items-center flex-wrap gap-2 ${className}`.trim()}>
      <small className="text-muted mb-0">
        Page <strong>{current}</strong> / {totalPages}
      </small>

      <div className="d-flex gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-sm btn-outline-ak"
          disabled={current <= 1}
          onClick={() => onPageChange?.(current - 1)}
        >
          Prev
        </button>

        {items.map((item, idx) =>
          item === "gap" ? (
            <span key={`gap-${idx}`} className="text-muted px-2" aria-hidden="true">
              ...
            </span>
          ) : (
            <button
              key={`page-${item}`}
              type="button"
              className={`btn btn-sm ${item === current ? "btn-ak-primary" : "btn-outline-ak"}`}
              onClick={() => onPageChange?.(item)}
            >
              {item}
            </button>
          )
        )}

        <button
          type="button"
          className="btn btn-sm btn-outline-ak"
          disabled={current >= totalPages}
          onClick={() => onPageChange?.(current + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

