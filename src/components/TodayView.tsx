import { useState, type ReactNode } from 'react';
import { toggleCheck } from '../db';
import { DAY_LETTERS, formatDay, isoWeek, weekDays, weekStartOf } from '../lib/dates';
import type { Scorer } from '../lib/scoring';
import type { AppData, Habit, ISODate } from '../lib/types';
import { CheckButton, Icon, Ring, StreakBadge, plural } from './ui';

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

export function TodayView({ scorer, today, selected, onSelect, onAdd, onEdit, onSettings }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggleOpen = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const ws = weekStartOf(today);
  const days = weekDays(ws);
  const daily = scorer.habitsOn(selected, 'daily');
  const weekly = scorer.habitsOn(selected, 'weekly');
  const dailyDone = daily.filter((h) => scorer.isDone(h, selected)).length;
  const score = scorer.dailyScore(selected);
  const weeklyHit = weekly.filter((h) => scorer.weeklyHit(h, ws)).length;
  const daysLeft = 7 - days.indexOf(today);
  const isToday = selected === today;
  const dayWord = isToday ? 'today' : formatDay(selected, { weekday: 'short' });

  return (
    <div className="view">
      <header className="view-head">
        <div>
          <div className="eyebrow">{formatDay(selected, { weekday: 'short', month: 'short', day: 'numeric' })} · Week {isoWeek(selected)}</div>
          <h1>{isToday ? 'Today' : formatDay(selected, { weekday: 'long' })}</h1>
        </div>
        <div className="head-actions">
          <span className="streak-chip" title="Days in a row at your daily target">
            <Icon name="flame" size={16} stroke={2.2} />{plural(scorer.dayStreak(today), 'day')}
          </span>
          <button type="button" className="icon-btn" aria-label="Settings" onClick={onSettings}><Icon name="settings" /></button>
          <button type="button" className="icon-btn primary" aria-label="Add habit" onClick={onAdd}><Icon name="plus" stroke={2.4} /></button>
        </div>
      </header>

      <div className="day-strip card" role="group" aria-label="Days this week">
        {days.map((d, i) => {
          const s = d <= today ? scorer.dailyScore(d) : null;
          const future = d > today;
          return (
            <button key={d} type="button" className={`day${d === selected ? ' selected' : ''}`} disabled={future}
              aria-pressed={d === selected} aria-label={`${formatDay(d, { weekday: 'long' })}${s !== null ? `, ${Math.round(s * 100)}%` : ''}`}
              onClick={() => onSelect(d)}>
              <span className="day-letter">{DAY_LETTERS[i]}</span>
              <Ring value={s}><span className={future ? 'muted' : ''}>{formatDay(d, { day: 'numeric' })}</span></Ring>
              <span className="day-pct">{s === null ? '–' : `${Math.round(s * 100)}%`}</span>
            </button>
          );
        })}
      </div>

      {daily.length + weekly.length === 0 && (
        <div className="empty card">
          <h2>Start with one habit</h2>
          <p>Add a daily habit like “Drink 3L water”, or a weekly target like “Run 3× a week”.</p>
          <button type="button" className="btn primary" onClick={onAdd}><Icon name="plus" size={18} stroke={2.4} />Add a habit</button>
        </div>
      )}

      {daily.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Daily</h2>
            <span>{dailyDone} of {daily.length} done{score !== null ? ` · ${Math.round(score * 100)}%` : ''}</span>
          </div>
          {daily.map((h) => (
            <HabitCard key={h.id} habit={h} scorer={scorer} date={selected} today={today} open={!!open[h.id]}
              onToggleOpen={() => toggleOpen(h.id)} onEdit={() => onEdit(h.id)}
              meta={<StreakBadge text={plural(scorer.dailyStreak(h, today), 'day')} />}
              best={plural(scorer.bestDailyStreak(h, today), 'day')} />
          ))}
        </section>
      )}

      {weekly.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Weekly targets</h2>
            <span>{weeklyHit} of {weekly.length} hit</span>
          </div>
          {weekly.map((h) => {
            const target = scorer.targetFor(h.id, ws);
            const count = scorer.weeklyCount(h, ws);
            const hit = count >= target;
            const doneSel = scorer.isDone(h, selected);
            const hasSubs = scorer.activeSubtasks(h.id, selected).length > 0;
            return (
              <div key={h.id} className="card weekly">
                <div className="weekly-top">
                  <button type="button" className="habit-name-btn" onClick={() => onEdit(h.id)}>
                    <span className="habit-name"><span className="dot" style={{ background: h.color }} />{h.name}</span>
                    <span className="habit-meta">{target}× a week · <StreakBadge text={plural(scorer.weeklyStreak(h, today), 'wk', 'wks')} /> <span className="faint">best {scorer.bestWeeklyStreak(h, today)}</span></span>
                  </button>
                  <div className="big-count">{count}<span> / {target}</span></div>
                </div>
                <div className="segs" role="img" aria-label={`${count} of ${target} this week`}>
                  {Array.from({ length: Math.max(target, count) }, (_, i) => (
                    <span key={i} className={i < count ? (i >= target ? 'seg bonus' : 'seg on') : 'seg'} />
                  ))}
                </div>
                {hasSubs ? (
                  <SubtaskBlock habit={h} scorer={scorer} date={selected} today={today} open={!!open[h.id]} onToggleOpen={() => toggleOpen(h.id)}
                    status={<span className={hit ? 'status hit' : 'status'}>{statusText(hit, count, target, daysLeft)}</span>} />
                ) : (
                  <div className="weekly-bottom">
                    <span className={hit ? 'status hit' : 'status'}>{statusText(hit, count, target, daysLeft)}</span>
                    <button type="button" className={`pill${doneSel ? ' on' : ''}`} aria-pressed={doneSel}
                      onClick={() => toggleCheck(h.id, '', selected)}>
                      {doneSel && <Icon name="check" size={15} stroke={3} />}
                      {doneSel ? `Done ${dayWord}` : `Check in ${dayWord}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function statusText(hit: boolean, count: number, target: number, daysLeft: number): string {
  if (hit) return count > target ? `Target hit · +${count - target} bonus` : 'Target hit';
  return `${target - count} more to go · ${plural(daysLeft, 'day')} left`;
}

interface CardProps {
  habit: Habit;
  scorer: Scorer;
  date: ISODate;
  today: ISODate;
  open: boolean;
  onToggleOpen: () => void;
  onEdit: () => void;
  meta: ReactNode;
  best: string;
}

function HabitCard({ habit: h, scorer, date, today, open, onToggleOpen, onEdit, meta, best }: CardProps) {
  const { done, total } = scorer.subtaskProgress(h, date);
  const isDone = scorer.isDone(h, date);
  return (
    <div className="card habit">
      <div className="habit-row">
        {total === 0 ? (
          <CheckButton checked={isDone} label={`${isDone ? 'Uncheck' : 'Check'} ${h.name}`} onClick={() => toggleCheck(h.id, '', date)} />
        ) : (
          <span className="sub-ring" role="img" aria-label={`${done} of ${total} steps done`}>
            <Ring value={done / total} size={30} stroke={4} full={isDone}>
              <span className={isDone ? 'on-accent' : ''}>{isDone ? <Icon name="check" size={14} stroke={3} /> : `${done}/${total}`}</span>
            </Ring>
          </span>
        )}
        <button type="button" className="habit-name-btn" onClick={onEdit}>
          <span className="habit-name"><span className="dot" style={{ background: h.color }} />{h.name}</span>
          <span className="habit-meta">{total > 0 && <>{done} of {total} steps · </>}{meta} <span className="faint">best {best}</span></span>
        </button>
        {total > 0 && (
          <button type="button" className="icon-btn soft" aria-label={open ? 'Hide steps' : 'Show steps'} aria-expanded={open} onClick={onToggleOpen}>
            <span className={open ? 'flip' : ''}><Icon name="chevronDown" size={18} stroke={2.4} /></span>
          </button>
        )}
      </div>
      {total > 0 && open && <SubtaskList habit={h} scorer={scorer} date={date} today={today} />}
    </div>
  );
}

function SubtaskList({ habit: h, scorer, date }: { habit: Habit; scorer: Scorer; date: ISODate; today: ISODate }) {
  return (
    <ul className="subtasks">
      {scorer.activeSubtasks(h.id, date).map((s) => {
        const on = scorer.isChecked(h.id, s.id, date);
        return (
          <li key={s.id}>
            <CheckButton small checked={on} label={`${on ? 'Uncheck' : 'Check'} ${s.name}`} onClick={() => toggleCheck(h.id, s.id, date)} />
            <span className={on ? 'sub-name done' : 'sub-name'}>{s.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

function SubtaskBlock({ habit, scorer, date, today, open, onToggleOpen, status }: {
  habit: Habit; scorer: Scorer; date: ISODate; today: ISODate; open: boolean; onToggleOpen: () => void; status: ReactNode;
}) {
  const { done, total } = scorer.subtaskProgress(habit, date);
  return (
    <>
      <div className="weekly-bottom">
        {status}
        <button type="button" className="pill" aria-expanded={open} onClick={onToggleOpen}>
          {done}/{total} steps <span className={open ? 'flip' : ''}><Icon name="chevronDown" size={15} stroke={2.6} /></span>
        </button>
      </div>
      {open && <SubtaskList habit={habit} scorer={scorer} date={date} today={today} />}
    </>
  );
}
