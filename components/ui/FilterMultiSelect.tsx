import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface FilterMultiSelectProps {
  label: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  resetText: string;
}

export const FilterMultiSelect: React.FC<FilterMultiSelectProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  resetText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const focusOptionsOnOpen = useRef(false);
  const listboxId = React.useId();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        if (containerRef.current?.contains(document.activeElement))
          containerRef.current.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (isOpen && focusOptionsOnOpen.current) {
      containerRef.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
      focusOptionsOnOpen.current = false;
    }
  }, [isOpen]);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  return (
    <div className="relative z-40" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            const first = containerRef.current?.querySelector<HTMLButtonElement>('[role="option"]');
            if (first) first.focus();
            else {
              focusOptionsOnOpen.current = true;
              setIsOpen(true);
            }
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className={`flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-sm transition-colors hover:border-[var(--line-strong)] ${selectedValues.length > 0 ? 'font-medium text-[var(--rail-teal-ink)]' : 'text-[var(--ink-soft)]'}`}
      >
        <span>
          {label} {selectedValues.length > 0 && `(${selectedValues.length})`}
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="filter-popover dialog-panel absolute z-50 mt-2 w-56 overflow-hidden rounded-xl animate-fade-in"
          onKeyDown={(event) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            const menu = event.currentTarget as HTMLDivElement;
            const options = [...menu.querySelectorAll<HTMLButtonElement>('[role="option"]')];
            if (!options.length) return;
            event.preventDefault();
            const current = options.indexOf(document.activeElement as HTMLButtonElement);
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? options.length - 1
                  : event.key === 'ArrowDown'
                    ? (current + 1) % options.length
                    : current < 0
                      ? options.length - 1
                      : (current - 1 + options.length) % options.length;
            options[next]?.focus();
          }}
        >
          <div className="filter-popover-heading">{label}</div>
          <div className="p-2 max-h-60 overflow-y-auto space-y-1">
            {options.map((opt) => (
              <button
                type="button"
                role="option"
                aria-selected={selectedValues.includes(opt.value)}
                key={opt.value}
                onClick={() => toggleOption(opt.value)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[var(--ink-soft)] hover:bg-[var(--surface-soft)]"
              >
                {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${selectedValues.includes(opt.value) ? 'border-[var(--rail-teal)] bg-[var(--rail-teal)] text-[var(--on-accent)]' : 'border-[var(--line-strong)]'}`}
                >
                  {selectedValues.includes(opt.value) && <Check size={10} strokeWidth={3} />}
                </div>
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </div>
          {selectedValues.length > 0 && (
            <div className="border-t border-[var(--line)] p-2">
              <button
                onClick={() => {
                  onChange([]);
                  setIsOpen(false);
                }}
                className="w-full rounded-lg bg-[var(--surface-soft)] py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
              >
                {resetText}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
