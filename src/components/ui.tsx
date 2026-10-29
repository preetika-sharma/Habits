import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/** Habit colours are highlighter inks. */
export const COLORS = [
  { name: 'Yellow', hex: '#FFE45C' },
  { name: 'Pink', hex: '#FF9BCB' },
  { name: 'Mint', hex: '#8EE6BE' },
  { name: 'Blue', hex: '#9BD4FF' },
  { name: 'Orange', hex: '#FFBE7A' },
  { name: 'Lavender', hex: '#C9B2FF' },
];

/** Colours saved before the journal redesign, mapped to their closest highlighter. */
const LEGACY: Record<string, string> = {
  '#0E7A5F': '#8EE6BE',
  '#2F5BD3': '#9BD4FF',
  '#C2410C': '#FFBE7A',
  '#7A3FC4': '#C9B2FF',
  '#C2306E': '#FF9BCB',
  '#4B5563': '#FFE45C',
};
export const highlighter = (color: string) => LEGACY[color.toUpperCase()] ?? color;

type IconName = 'check' | 'plus' | 'minus' | 'chevronDown' | 'chevronLeft' | 'chevronRight'
  | 'today' | 'week' | 'summary' | 'settings' | 'close' | 'up' | 'down' | 'arrowRight';

// Slightly wobbly strokes so icons look drawn with a pen rather than a ruler.
const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M5 12.8c1.6 1.2 3 2.7 4.2 4.4C11.8 12.4 15 8.6 19.4 6" />,
  plus: <path d="M12.2 5.2c-.3 4.6-.1 9 .1 13.6M5.2 12.3c4.6-.4 9.1-.2 13.6.1" />,
  minus: <path d="M5.2 12.3c4.6-.4 9.1-.2 13.6.1" />,
  chevronDown: <path d="M6 9.4c2.2 1.7 4.1 3.6 6 5.6 1.8-2.1 3.7-4 6-5.8" />,
  chevronLeft: <path d="M15 5.8c-2 2.1-4 4-6 6.3 2 1.8 4 3.8 5.8 6" />,
  chevronRight: <path d="M9 5.8c2 2.1 4 4 6 6.3-2 1.8-4 3.8-5.8 6" />,
  today: <><path d="M4.5 6.2c4.9-.6 10-.4 15 0 .4 4.6.3 9 0 13.6-5 .4-10 .3-15 0-.3-4.6-.3-9 0-13.6z" /><path d="M8.2 3.6v4M15.8 3.6v4M8.6 13.4c1 .8 1.8 1.8 2.5 2.8 1.6-2.6 3-4.4 5-5.8" /></>,
  week: <><path d="M3.6 5c5.6-.5 11.2-.4 16.8 0 .4 4.8.3 9.6 0 14.6-5.6.4-11.2.3-16.8 0-.4-4.9-.3-9.8 0-14.6z" /><path d="M3.8 10.2c5.4-.3 10.8-.2 16.4 0M9.2 5.2c-.2 4.8-.1 9.6.1 14.2M14.8 5.2c.2 4.8.1 9.6-.1 14.2" /></>,
  summary: <path d="M5.2 20c-.2-3-.1-6 .1-9M12 20.2c-.3-5-.2-10 .1-15M18.8 20c-.2-2.2-.1-4.2.1-6.2M3.4 20.4c5.8-.4 11.4-.3 17.2 0" />,
  settings: <><path d="M4 7.2c5.4-.3 10.6-.2 16 .1M4 16.8c5.4-.3 10.6-.2 16 .1" /><circle cx="9" cy="7.2" r="2.3" fill="var(--paper)" /><circle cx="15.2" cy="16.9" r="2.3" fill="var(--paper)" /></>,
  close: <path d="M6.2 6c4 3.8 7.8 7.8 11.6 12M18 6.2c-4 3.8-8 7.6-11.8 11.6" />,
  up: <path d="M6 15c2.2-1.8 4-3.7 6-5.8 1.8 2 3.8 4 6 5.6" />,
  down: <path d="M6 9.4c2.2 1.7 4.1 3.6 6 5.6 1.8-2.1 3.7-4 6-5.8" />,
  arrowRight: <path d="M4.8 12.3c4.6-.4 9.2-.2 14 .1M13.4 6.4c2 2 4 3.9 5.6 5.9-1.8 2-3.6 3.8-5.8 5.6" />,
};

export function Icon({ name, size = 20, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** A little doodled flame for streaks. */
export function Flame({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flame">
      <path d="M12.4 2.6c.6 3.8 5.6 6 5.4 11.2-.2 4.2-3 6.8-6 6.6-3.2-.2-5.6-2.8-5.4-6 .1-2.6 1.6-4.2 2.8-5.2.2 1.8 1 2.8 2.2 3.4.4-3.4-.6-6.2 1-10z"
        fill="var(--flame-fill)" stroke="var(--flame)" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

// A hand-drawn circle, used for the day rings. pathLength=100 makes the dash maths a percentage.
const WOBBLY_CIRCLE = 'M18 3.4C26.6 3.1 33 9.7 32.7 18.3 32.4 26.8 25.9 32.9 17.6 32.7 9.3 32.5 3.3 26.3 3.4 18 3.6 10.1 9.6 3.9 18.8 3.7';

/** Doodled progress ring, 0–1. `null` draws only a faint dotted outline. */
export function Ring({ value, size = 38, children }: { value: number | null; size?: number; children?: ReactNode }) {
  const full = value !== null && value >= 1;
  return (
    <span className={`ring${full ? ' full' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
        <path d={WOBBLY_CIRCLE} pathLength={100} fill="none" stroke="var(--ink-faint)" strokeWidth="1.4" strokeDasharray="1.5 3.5" strokeLinecap="round" />
        {value !== null && value > 0 && (
          <path d={WOBBLY_CIRCLE} pathLength={100} fill="none" stroke="var(--pen)" strokeWidth="2.4" strokeLinecap="round"
            strokeDasharray={`${Math.min(value, 1) * 100} 100`} />
        )}
      </svg>
      {children !== undefined && <span className="ring-label">{children}</span>}
    </span>
  );
}

const BOX = 'M3.6 4.3C8.2 3.5 13.9 3.9 19.3 3.7c.4 5.2.2 10.4.5 15.6-5.6.5-11 .2-16 .5-.4-5.2.1-10.3-.2-15.5z';
const TICK = 'M6.4 12.2c1.7 1.4 3 3.1 4 4.9 2.6-5.2 6-9.6 10.6-13.4';

/** A hand-drawn checkbox with an inked tick. */
export function HandBox({ checked, small = false }: { checked: boolean; small?: boolean }) {
  const size = small ? 20 : 26;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`handbox${checked ? ' on' : ''}`}>
      <path d={BOX} stroke="var(--ink)" strokeWidth={small ? 1.6 : 1.8} strokeLinejoin="round" />
      {checked && <path className="tick" d={TICK} pathLength={1} stroke="var(--pen)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

export function CheckButton({ checked, label, onClick, small = false, disabled = false }: {
  checked: boolean; label: string; onClick: () => void; small?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" className={`check-btn${small ? ' small' : ''}`} aria-pressed={checked}
      aria-label={label} onClick={onClick} disabled={disabled}>
      <HandBox checked={checked} small={small} />
    </button>
  );
}

/** Text with a highlighter stroke behind it when `on`. */
export function Highlight({ color, on, children, className = '' }: { color: string; on: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={`hl${on ? ' on' : ''} ${className}`} style={{ '--hl': highlighter(color) } as CSSProperties}>
      {children}
    </span>
  );
}

export function StreakBadge({ text }: { text: string }) {
  return <span className="streak"><Flame size={14} />{text}</span>;
}

/** Modal index card built on <dialog> for focus trapping and Esc handling. */
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
        <div className="tape" aria-hidden="true" />
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
