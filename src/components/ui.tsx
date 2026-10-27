import { useEffect, useRef, type ReactNode } from 'react';

export const COLORS = [
  { name: 'Green', hex: '#0E7A5F' },
  { name: 'Blue', hex: '#2F5BD3' },
  { name: 'Orange', hex: '#C2410C' },
  { name: 'Purple', hex: '#7A3FC4' },
  { name: 'Pink', hex: '#C2306E' },
  { name: 'Slate', hex: '#4B5563' },
];

type IconName = 'check' | 'plus' | 'minus' | 'flame' | 'chevronDown' | 'chevronLeft' | 'chevronRight'
  | 'today' | 'week' | 'summary' | 'settings' | 'close' | 'up' | 'down' | 'arrowRight';

const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  flame: <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1.2 2.5 2.5 3 0-3-1-5.5 0-8z" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  today: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>,
  week: <><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 10h18M9 4v17M15 4v17" /></>,
  summary: <path d="M5 20V11M12 20V5M19 20v-6" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export function Icon({ name, size = 20, stroke = 2.2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

const C = 2 * Math.PI * 15;

/** Progress ring, 0–1. `null` draws only the track. */
export function Ring({ value, size = 36, stroke = 3.5, full = false, children }: {
  value: number | null; size?: number; stroke?: number; full?: boolean; children?: ReactNode;
}) {
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15" fill={full ? 'var(--accent)' : 'none'} stroke="var(--track)" strokeWidth={stroke} />
        {value !== null && value > 0 && (
          <circle cx="18" cy="18" r="15" fill="none" stroke={value >= 1 ? 'var(--accent)' : 'var(--accent-soft)'}
            strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${value * C} ${C}`} transform="rotate(-90 18 18)" />
        )}
      </svg>
      {children !== undefined && <span className="ring-label">{children}</span>}
    </span>
  );
}

export function CheckButton({ checked, label, onClick, small = false, disabled = false }: {
  checked: boolean; label: string; onClick: () => void; small?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" className={`check-btn${small ? ' small' : ''}`} aria-pressed={checked}
      aria-label={label} onClick={onClick} disabled={disabled}>
      <span className={`check-mark${checked ? ' on' : ''}`}>{checked && <Icon name="check" size={small ? 13 : 16} stroke={3} />}</span>
    </button>
  );
}

export function StreakBadge({ text }: { text: string }) {
  return <span className="streak"><Icon name="flame" size={13} stroke={2.4} />{text}</span>;
}

/** Modal bottom sheet built on <dialog> for focus trapping and Esc handling. */
export function Sheet({ title, onClose, children, actions }: {
  title: string; onClose: () => void; children: ReactNode; actions?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      d.showModal();
      // showModal() focuses the first control; move focus to the field marked for it instead.
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
  }, []);
  return (
    <dialog ref={ref} className="sheet" aria-label={title} onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="sheet-body">
        <div className="sheet-handle" />
        <header className="sheet-head">
          <button type="button" className="link-btn muted" onClick={onClose}>Cancel</button>
          <h1>{title}</h1>
          <div className="sheet-actions">{actions}</div>
        </header>
        <div className="sheet-content">{children}</div>
      </div>
    </dialog>
  );
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
