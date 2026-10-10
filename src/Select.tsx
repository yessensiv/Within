import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: string };
export default function Select({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  label: string;
  className?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const search = useRef({ text: "", time: 0 });
  const selected = options.findIndex((o) => o.value === value);
  function show() {
    setActive(Math.max(0, selected));
    setOpen(true);
  }
  function choose(index: number) {
    if (!options[index]) return;
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  }
  useLayoutEffect(() => {
    const el = popup.current;
    if (!open || !el) return;
    el.showPopover();
    function position() {
      if (!trigger.current || !el) return;
      const rect = trigger.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop || 0;
      const bottom = top + (viewport?.height || window.innerHeight);
      const width = Math.min(Math.max(rect.width, 190), window.innerWidth - 24);
      const below = bottom - rect.bottom - 16;
      const above = rect.top - top - 16;
      const upwards = below < 220 && above > below;
      el.style.width = `${width}px`;
      el.style.maxHeight = `${Math.max(44, Math.min(308, upwards ? above : below))}px`;
      el.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
      el.style.top = `${upwards ? rect.top - el.getBoundingClientRect().height - 7 : rect.bottom + 7}px`;
      el.dataset.placement = upwards ? "above" : "below";
    }
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    return () => {
      if (el.matches(":popover-open")) el.hidePopover();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    popup.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div ref={root} className={`custom-select ${className}`}>
      <button
        ref={trigger}
        type="button"
        className="select-trigger"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onBlur={(event) => {
          if (!root.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) show();
            else
              setActive((index) =>
                Math.max(
                  0,
                  Math.min(
                    options.length - 1,
                    index + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
          } else if (open && (event.key === "Home" || event.key === "End")) {
            event.preventDefault();
            setActive(event.key === "Home" ? 0 : options.length - 1);
          } else if (open && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            choose(active);
          } else if (
            event.key.length === 1 &&
            event.key !== " " &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            const now = Date.now();
            const text =
              (now - search.current.time < 700 ? search.current.text : "") +
              event.key.toLocaleLowerCase("ru");
            search.current = { text, time: now };
            const index = options.findIndex((o) =>
              o.label.toLocaleLowerCase("ru").startsWith(text),
            );
            if (index >= 0) {
              event.preventDefault();
              if (!open) setOpen(true);
              setActive(index);
            }
          }
        }}
      >
        <span>{options[selected]?.label || value}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <div
        ref={popup}
        id={id}
        popover="manual"
        className="select-popup"
        role="listbox"
        aria-label={label}
        onPointerDown={(event) => event.preventDefault()}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            id={`${id}-${index}`}
            role="option"
            aria-selected={option.value === value}
            data-index={index}
            className={`select-option ${active === index ? "is-active" : ""} ${option.value === value ? "is-selected" : ""}`}
            onPointerMove={() => setActive(index)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              choose(index);
            }}
          >
            <span>{option.label}</span>
            {option.value === value && <Check size={16} aria-hidden="true" />}
          </div>
        ))}
      </div>
    </div>
  );
}
