import { useEffect, useMemo, useRef, useState } from "react";

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  name
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSelect = (nextValue) => {
    onChange({
      target: {
        name,
        value: nextValue
      }
    });
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`custom-select-shell ${open ? "open" : ""} ${disabled ? "disabled" : ""} ${className}`.trim()}
    >
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => !disabled && setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <span className="custom-select-caret" aria-hidden="true" />
      </button>

      {open ? (
        <div className="custom-select-menu" role="listbox">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`custom-select-option ${option.value === value ? "selected" : ""}`}
              onClick={() => handleSelect(option.value)}
              role="option"
              aria-selected={option.value === value}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
