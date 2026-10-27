import { toggleCheck } from '../db';
import { addDays, DAY_LETTERS, DAY_SHORT, formatDay, formatWeekRange, isoWeek, weekDays, weekStartOf } from '../lib/dates';
import { canEdit, isActiveOn, type Scorer } from '../lib/scoring';
import type { AppData, Habit, ISODate } from '../lib/types';
import { Icon } from './ui';

interface Props {
  data: AppData;
  scorer: Scorer;
  today: ISODate;
  weekStart: ISODate;
  onWeek: (ws: ISODate) => void;
  onOpenDay: (d: ISODate) => void;
}

export function WeekView({ data, scorer, today, weekStart, onWeek, onOpenDay }: Props) {
  const days = weekDays(weekStart);
  const current = weekStartOf(today);
  const isCurrent = weekStart === current;
  const inWeek = (h: Habit) => days.some((d) => isActiveOn(h, d));
  const habits = [...data.habits].filter(inWeek).sort((a, b) => a.sortOrder - b.sortOrder);
  const daily = habits.filter((h) => h.type === 'daily');
  const weekly = habits.filter((h) => h.type === 'weekly');
  const daysHit = days.filter((d) => d <= today && scorer.dayHit(d)).length;
  const targetsHit = weekly.filter((h) => scorer.weeklyHit(h, weekStart)).length;
  const firstWeek = data.habits.map((h) => weekStartOf(h.createdOn)).sort()[0] ?? current;

  const cell = (h: Habit, d: ISODate, i: number) => {
    const label = `${h.name}, ${DAY_SHORT[i]}`;
    if (!isActiveOn(h, d)) return <span className="cell none" aria-hidden="true" />;
    if (d > today) return <span className="cell upcoming" role="img" aria-label={`${label}, upcoming`} />;
    const editable = canEdit(d, today);
    const { done, total } = scorer.subtaskProgress(h, d);
    const on = scorer.isDone(h, d);
    const shape = h.type === 'weekly' ? ' round' : '';
    if (total > 0) {
      // Habits with steps open that day in Today, where each step can be checked.
      return (
        <button type="button" className={`cell${on ? ' on' : done ? ' partial' : ''}${shape}`} disabled={!editable}
          aria-label={`${label}, ${done} of ${total} steps. Open day`} onClick={() => onOpenDay(d)}>
          {on ? <Icon name="check" size={14} stroke={3.2} /> : done > 0 ? `${done}/${total}` : ''}
        </button>
      );
    }
    return (
      <button type="button" className={`cell${on ? ' on' : ''}${shape}`} disabled={!editable} aria-pressed={on}
        aria-label={`${label}, ${on ? 'done' : 'not done'}`} onClick={() => toggleCheck(h.id, '', d)}>
        {on && <Icon name="check" size={14} stroke={3.2} />}
      </button>
    );
  };

  return (
    <div className="view">
      <header className="view-head stacked">
        <h1>{isCurrent ? 'This week' : `Week ${isoWeek(weekStart)}`}</h1>
        <div className="week-nav">
          <button type="button" className="icon-btn outline" aria-label="Previous week" disabled={weekStart <= firstWeek}
            onClick={() => onWeek(addDays(weekStart, -7))}><Icon name="chevronLeft" size={18} stroke={2.4} /></button>
          <div className="week-nav-label">
            <strong>{formatWeekRange(weekStart)}</strong>
            <span>Week {isoWeek(weekStart)} · {isCurrent ? 'editable' : 'read-only'}</span>
          </div>
          <button type="button" className="icon-btn outline" aria-label="Next week" disabled={isCurrent}
            onClick={() => onWeek(addDays(weekStart, 7))}><Icon name="chevronRight" size={18} stroke={2.4} /></button>
        </div>
      </header>

      <div className="stat-pair">
        <div className="card stat"><span className="label">Days hit</span><strong>{daysHit}<small> / 7</small></strong></div>
        <div className="card stat"><span className="label">Weekly targets</span><strong>{targetsHit}<small> / {weekly.length}</small></strong></div>
      </div>

      {habits.length === 0 ? (
        <div className="empty card"><p>No habits this week.</p></div>
      ) : (
        <div className="card grid-card">
          <div className="grid-row head">
            <span />
            {days.map((d, i) => (
              <span key={d} className={`grid-day${d === today ? ' today' : ''}${d > today ? ' future' : ''}`}>
                <span>{DAY_LETTERS[i]}</span><strong>{formatDay(d, { day: 'numeric' })}</strong>
              </span>
            ))}
          </div>

          {daily.length > 0 && <div className="grid-label">Daily</div>}
          {daily.map((h) => (
            <div key={h.id} className="grid-row">
              <span className="grid-name">{h.name}</span>
              {days.map((d, i) => <span key={d} className="grid-cell">{cell(h, d, i)}</span>)}
            </div>
          ))}
          {daily.length > 0 && (
            <div className="grid-row score">
              <span className="grid-name muted">Daily score</span>
              {days.map((d) => {
                const s = d <= today ? scorer.dailyScore(d) : null;
                return <span key={d} className={s !== null && scorer.dayHit(d) ? 'hit' : ''}>{s === null ? '–' : `${Math.round(s * 100)}%`}</span>;
              })}
            </div>
          )}

          {weekly.length > 0 && <div className="grid-label divider">Weekly targets</div>}
          {weekly.map((h) => {
            const count = scorer.weeklyCount(h, weekStart);
            const target = scorer.targetFor(h.id, weekStart);
            return (
              <div key={h.id} className="grid-row">
                <span className="grid-name">
                  {h.name}
                  <small className={count >= target ? 'hit' : ''}>{count} / {target}{count >= target ? ' · hit' : ''}</small>
                </span>
                {days.map((d, i) => <span key={d} className="grid-cell">{cell(h, d, i)}</span>)}
              </div>
            );
          })}
        </div>
      )}

      <div className="legend">
        <span><i className="sw on" />Done</span>
        <span><i className="sw partial" />Some steps done</span>
        <span><i className="sw upcoming" />Upcoming</span>
      </div>
      <p className="hint">{isCurrent ? 'Tap any day up to today to fix a missed check-off. ' : ''}Past weeks are read-only.</p>
    </div>
  );
}
