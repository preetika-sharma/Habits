import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { toggleCheck } from '../db';
import { addDays, DAY_LETTERS, formatDay, isoWeek, parseISO, weekDays, weekStartOf } from '../lib/dates';
import type { Scorer } from '../lib/scoring';
import type { AppData, Habit, ISODate } from '../lib/types';
import { CheckButton, Flame, HandBox, Highlight, Icon, Ring, StreakBadge, highlighter, plural } from './ui';

interface Props {
  data: AppData;
  scorer: Scorer;
  today: ISODate;
  selected: ISODate;
  onSelect: (d: ISODate) => void;
  onAdd: () => void;
  onEdit: (habitId: string) => void;
  onSettings: () => void;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Today is a journal page; other days this week are the pages around it. */
export function TodayView(props: Props) {
  const { today, selected, onSelect } = props;
  const [turn, setTurn] = useState<{ from: ISODate; to: ISODate; dir: 1 | -1 } | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const first = weekStartOf(today);
  const canGo = (d: ISODate) => d >= first && d <= today;

  const go = (d: ISODate) => {
    if (d === selected || !canGo(d)) return;
    if (!reducedMotion()) setTurn({ from: selected, to: d, dir: d > selected ? 1 : -1 });
    onSelect(d);
  };

  // Forward: the old page lifts away to the left, revealing the new one beneath.
  // Backward: the new page swings back in from the left over the old one.
  const base = turn ? (turn.dir === 1 ? turn.to : turn.from) : selected;
  const overlay = turn ? (turn.dir === 1 ? turn.from : turn.to) : null;

  return (
    <div className="page-stack"
      onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
      onPointerUp={(e) => {
        const s = swipe.current;
        swipe.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(addDays(selected, dx < 0 ? 1 : -1));
      }}>
      <DayPage {...props} date={base} go={go} canGo={canGo} />
      {turn && overlay && (
        <div className={`turning ${turn.dir === 1 ? 'forward' : 'backward'}`} aria-hidden="true" onAnimationEnd={() => setTurn(null)}>
          <DayPage {...props} date={overlay} go={go} canGo={canGo} inert />
        </div>
      )}
    </div>
  );
}

function DayPage({ scorer, today, date, onAdd, onEdit, onSettings, go, canGo, inert = false }: Props & {
  date: ISODate; go: (d: ISODate) => void; canGo: (d: ISODate) => boolean; inert?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggleOpen = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const ws = weekStartOf(today);
  const days = weekDays(ws);
  const daily = scorer.habitsOn(date, 'daily');
  const weekly = scorer.habitsOn(date, 'weekly');
  const dailyDone = daily.filter((h) => scorer.isDone(h, date)).length;
  const score = scorer.dailyScore(date);
  const weeklyHit = weekly.filter((h) => scorer.weeklyHit(h, ws)).length;
  const daysLeft = 7 - days.indexOf(today);
  const isToday = date === today;
  const dayWord = isToday ? 'today' : formatDay(date, { weekday: 'short' });
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const pageNo = Math.round((parseISO(date).getTime() - new Date(parseISO(date).getFullYear(), 0, 1).getTime()) / 864e5) + 1;
  const tab = inert ? -1 : undefined;

  return (
    <article className="journal-page day-page" aria-label={formatDay(date, { weekday: 'long', month: 'long', day: 'numeric' })}>
      <header className="page-head">
        <button type="button" className="flip-btn" aria-label="Previous day" disabled={!canGo(prev)} tabIndex={tab} onClick={() => go(prev)}>
          <Icon name="chevronLeft" size={22} stroke={2.2} />
        </button>
        <div className="page-date">
          <h1 className="script">{isToday ? 'Today' : formatDay(date, { weekday: 'long' })}</h1>
          <div className="typed small">{formatDay(date, { weekday: 'short', month: 'short', day: 'numeric' })} · week {isoWeek(date)}</div>
        </div>
        <button type="button" className="flip-btn" aria-label="Next day" disabled={!canGo(next)} tabIndex={tab} onClick={() => go(next)}>
          <Icon name="chevronRight" size={22} stroke={2.2} />
        </button>
      </header>

      <div className="page-tools">
        <span className="streak-note script" title="Days in a row at your daily target">
          <Flame size={18} />{plural(scorer.dayStreak(today), 'day')} in a row
        </span>
        <span className="tool-row">
          <button type="button" className="ink-btn" aria-label="Settings" tabIndex={tab} onClick={onSettings}><Icon name="settings" size={20} /></button>
          <button type="button" className="ink-btn solid" aria-label="Add habit" tabIndex={tab} onClick={onAdd}><Icon name="plus" size={20} stroke={2.4} /></button>
        </span>
      </div>

      <div className="day-strip" role="group" aria-label="Days this week">
        {days.map((d, i) => {
          const s = d <= today ? scorer.dailyScore(d) : null;
          const future = d > today;
          return (
            <button key={d} type="button" className={`day${d === date ? ' selected' : ''}`} disabled={future} tabIndex={tab}
              aria-pressed={d === date} aria-label={`${formatDay(d, { weekday: 'long' })}${s !== null ? `, ${Math.round(s * 100)}%` : ''}`}
              onClick={() => go(d)}>
              <span className="day-letter typed">{DAY_LETTERS[i]}</span>
              <Ring value={s}><span className="script">{formatDay(d, { day: 'numeric' })}</span></Ring>
            </button>
          );
        })}
      </div>

      {daily.length + weekly.length === 0 && (
        <div className="empty">
          <h2 className="script">A fresh page!</h2>
          <p className="typed">Add a daily habit like “Drink 3L water”, or a weekly target like “Run 3× a week”.</p>
          <button type="button" className="btn primary" tabIndex={tab} onClick={onAdd}><Icon name="plus" size={18} stroke={2.4} />Add a habit</button>
        </div>
      )}

      {daily.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="script underline">Daily</h2>
            <span className="typed small">{dailyDone}/{daily.length} done{score !== null ? ` · ${Math.round(score * 100)}%` : ''}</span>
          </div>
          <ul className="lines">
            {daily.map((h) => (
              <HabitLine key={h.id} habit={h} scorer={scorer} date={date} open={!!open[h.id]} tab={tab}
                onToggleOpen={() => toggleOpen(h.id)} onEdit={() => onEdit(h.id)}
                meta={<><StreakBadge text={plural(scorer.dailyStreak(h, today), 'day')} /><span className="faint">best {scorer.bestDailyStreak(h, today)}</span></>} />
            ))}
          </ul>
        </section>
      )}

      {weekly.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="script underline">This week’s targets</h2>
            <span className="typed small">{weeklyHit}/{weekly.length} hit</span>
          </div>
          <ul className="lines">
            {weekly.map((h) => {
              const target = scorer.targetFor(h.id, ws);
              const count = scorer.weeklyCount(h, ws);
              const hit = count >= target;
              const doneSel = scorer.isDone(h, date);
              const hasSubs = scorer.activeSubtasks(h.id, date).length > 0;
              return (
                <li key={h.id} className="weekly-line">
                  <div className="weekly-top">
                    <button type="button" className="habit-name-btn" tabIndex={tab} onClick={() => onEdit(h.id)}>
                      <Highlight color={h.color} on={hit} className="habit-name">{h.name}</Highlight>
                      <span className="habit-meta typed">{target}× a week · <StreakBadge text={plural(scorer.weeklyStreak(h, today), 'wk', 'wks')} /> <span className="faint">best {scorer.bestWeeklyStreak(h, today)}</span></span>
                    </button>
                    <span className="tally script" aria-label={`${count} of ${target} this week`}>{count}<small>/{target}</small></span>
                  </div>
                  <div className="tally-boxes" aria-hidden="true">
                    {Array.from({ length: Math.max(target, count) }, (_, i) => (
                      <span key={i} className={`tally-box${i < count ? ' on' : ''}${i >= target ? ' bonus' : ''}`}
                        style={{ '--hl': highlighter(h.color) } as CSSProperties}>
                        <HandBox checked={i < count} small />
                      </span>
                    ))}
                    <span className={`status typed small${hit ? ' hit' : ''}`}>{statusText(hit, count, target, daysLeft)}</span>
                  </div>
                  {hasSubs ? (
                    <SubtaskBlock habit={h} scorer={scorer} date={date} open={!!open[h.id]} tab={tab} onToggleOpen={() => toggleOpen(h.id)} />
                  ) : (
                    <button type="button" className={`stamp${doneSel ? ' on' : ''}`} aria-pressed={doneSel} tabIndex={tab}
                      onClick={() => toggleCheck(h.id, '', date)}>
                      {doneSel ? <><Icon name="check" size={16} stroke={2.6} />Done {dayWord}</> : <><Icon name="plus" size={16} stroke={2.4} />Log {dayWord}</>}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="page-no script" aria-hidden="true">~ {pageNo} ~</footer>
    </article>
  );
}

function statusText(hit: boolean, count: number, target: number, daysLeft: number): string {
  if (hit) return count > target ? `hit! +${count - target} bonus` : 'target hit!';
  return `${target - count} to go · ${plural(daysLeft, 'day')} left`;
}

function HabitLine({ habit: h, scorer, date, open, tab, onToggleOpen, onEdit, meta }: {
  habit: Habit; scorer: Scorer; date: ISODate; open: boolean; tab?: number;
  onToggleOpen: () => void; onEdit: () => void; meta: ReactNode;
}) {
  const { done, total } = scorer.subtaskProgress(h, date);
  const isDone = scorer.isDone(h, date);
  return (
    <li className="habit-line">
      <div className="habit-row">
        {total === 0 ? (
          <CheckButton checked={isDone} label={`${isDone ? 'Uncheck' : 'Check'} ${h.name}`} onClick={() => toggleCheck(h.id, '', date)} />
        ) : (
          <span className="step-count script" role="img" aria-label={`${done} of ${total} steps done`}>
            {isDone ? <HandBox checked /> : <>{done}/{total}</>}
          </span>
        )}
        <button type="button" className="habit-name-btn" tabIndex={tab} onClick={onEdit}>
          <Highlight color={h.color} on={isDone} className="habit-name">{h.name}</Highlight>
          <span className="habit-meta typed">{total > 0 && <>{done} of {total} steps · </>}{meta}</span>
        </button>
        {total > 0 && (
          <button type="button" className="ink-btn" aria-label={open ? 'Hide steps' : 'Show steps'} aria-expanded={open} tabIndex={tab} onClick={onToggleOpen}>
            <span className={open ? 'flip' : ''}><Icon name="chevronDown" size={18} stroke={2.2} /></span>
          </button>
        )}
      </div>
      {total > 0 && open && <SubtaskList habit={h} scorer={scorer} date={date} tab={tab} />}
    </li>
  );
}

function SubtaskList({ habit: h, scorer, date, tab }: { habit: Habit; scorer: Scorer; date: ISODate; tab?: number }) {
  return (
    <ul className="subtasks">
      {scorer.activeSubtasks(h.id, date).map((s) => {
        const on = scorer.isChecked(h.id, s.id, date);
        return (
          <li key={s.id}>
            <span className="twig" aria-hidden="true">↳</span>
            <button type="button" className="check-btn small" aria-pressed={on} aria-label={`${on ? 'Uncheck' : 'Check'} ${s.name}`}
              tabIndex={tab} onClick={() => toggleCheck(h.id, s.id, date)}>
              <HandBox checked={on} small />
            </button>
            <Highlight color={h.color} on={on} className="sub-name typed">{s.name}</Highlight>
          </li>
        );
      })}
    </ul>
  );
}

function SubtaskBlock({ habit, scorer, date, open, tab, onToggleOpen }: {
  habit: Habit; scorer: Scorer; date: ISODate; open: boolean; tab?: number; onToggleOpen: () => void;
}) {
  const { done, total } = scorer.subtaskProgress(habit, date);
  return (
    <>
      <button type="button" className="stamp" aria-expanded={open} tabIndex={tab} onClick={onToggleOpen}>
        {done}/{total} steps <span className={open ? 'flip' : ''}><Icon name="chevronDown" size={15} stroke={2.4} /></span>
      </button>
      {open && <SubtaskList habit={habit} scorer={scorer} date={date} tab={tab} />}
    </>
  );
}
