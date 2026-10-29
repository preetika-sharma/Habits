import type { CSSProperties } from 'react';
import { toggleCheck } from '../db';
import { addDays, DAY_LETTERS, DAY_SHORT, formatDay, formatWeekRange, isoWeek, weekDays, weekStartOf } from '../lib/dates';
import { canEdit, isActiveOn, type Scorer } from '../lib/scoring';
import { byOrder } from '../lib/order';
import type { AppData, Habit, ISODate } from '../lib/types';
import { HandBox, Icon, highlighter } from './ui';

interface Props {
  data: AppData;
  scorer: Scorer;
  today: ISODate;
  weekStart: ISODate;
  onWeek: (ws: ISODate) => void;
  onOpenDay: (d: ISODate) => void;
}

/** The week as an open two-page spread: daily habits on the left, weekly targets on the right. */
export function WeekView({ data, scorer, today, weekStart, onWeek, onOpenDay }: Props) {
  const days = weekDays(weekStart);
  const current = weekStartOf(today);
  const isCurrent = weekStart === current;
  const inWeek = (h: Habit) => days.some((d) => isActiveOn(h, d));
  const habits = [...data.habits].filter(inWeek).sort(byOrder);
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
    const style = { '--hl': highlighter(h.color) } as CSSProperties;
    if (total > 0) {
      // Habits with steps open that day's page, where each step can be checked.
      return (
        <button type="button" className={`cell${on ? ' on' : done ? ' partial' : ''}`} style={style} disabled={!editable}
          aria-label={`${label}, ${done} of ${total} steps. Open day`} onClick={() => onOpenDay(d)}>
          {on ? <HandBox checked small /> : done > 0 ? <span className="script">{done}/{total}</span> : <HandBox checked={false} small />}
        </button>
      );
    }
    return (
      <button type="button" className={`cell${on ? ' on' : ''}`} style={style} disabled={!editable} aria-pressed={on}
        aria-label={`${label}, ${on ? 'done' : 'not done'}`} onClick={() => toggleCheck(h.id, '', d)}>
        <HandBox checked={on} small />
      </button>
    );
  };

  const head = (
    <div className="grid-row head">
      <span />
      {days.map((d, i) => (
        <span key={d} className={`grid-day${d === today ? ' today' : ''}${d > today ? ' future' : ''}`}>
          <span className="typed">{DAY_LETTERS[i]}</span><strong className="script">{formatDay(d, { day: 'numeric' })}</strong>
        </span>
      ))}
    </div>
  );

  return (
    <div className="spread">
      <article className="journal-page">
        <header className="page-head">
          <button type="button" className="flip-btn" aria-label="Previous week" disabled={weekStart <= firstWeek}
            onClick={() => onWeek(addDays(weekStart, -7))}><Icon name="chevronLeft" size={22} stroke={2.2} /></button>
          <div className="page-date">
            <h1 className="script">{isCurrent ? 'This week' : `Week ${isoWeek(weekStart)}`}</h1>
            <div className="typed small">{formatWeekRange(weekStart)} · {isCurrent ? 'editable' : 'read-only'}</div>
          </div>
          <button type="button" className="flip-btn" aria-label="Next week" disabled={isCurrent}
            onClick={() => onWeek(addDays(weekStart, 7))}><Icon name="chevronRight" size={22} stroke={2.2} /></button>
        </header>

        <div className="scoreboard">
          <div><span className="script big">{daysHit}<small>/7</small></span><span className="typed small">days hit</span></div>
          <div><span className="script big">{targetsHit}<small>/{weekly.length}</small></span><span className="typed small">targets hit</span></div>
        </div>

        {habits.length === 0 && <p className="typed empty-note">No habits this week.</p>}

        {daily.length > 0 && (
          <section className="section">
            <h2 className="script underline">Daily</h2>
            <div className="grid">
              {head}
              {daily.map((h) => (
                <div key={h.id} className="grid-row">
                  <span className="grid-name typed">{h.name}</span>
                  {days.map((d, i) => <span key={d} className="grid-cell">{cell(h, d, i)}</span>)}
                </div>
              ))}
              <div className="grid-row score">
                <span className="grid-name typed faint">score</span>
                {days.map((d) => {
                  const s = d <= today ? scorer.dailyScore(d) : null;
                  return <span key={d} className={`script${s !== null && scorer.dayHit(d) ? ' hit' : ''}`}>{s === null ? '–' : `${Math.round(s * 100)}`}</span>;
                })}
              </div>
            </div>
          </section>
        )}
      </article>

      <article className="journal-page">
        {weekly.length > 0 && (
          <section className="section">
            <h2 className="script underline">Weekly targets</h2>
            <div className="grid">
              {head}
              {weekly.map((h) => {
                const count = scorer.weeklyCount(h, weekStart);
                const target = scorer.targetFor(h.id, weekStart);
                return (
                  <div key={h.id} className="grid-row">
                    <span className="grid-name typed">
                      {h.name}
                      <small className={count >= target ? 'hit' : ''}>{count}/{target}{count >= target ? ' ✓' : ''}</small>
                    </span>
                    {days.map((d, i) => <span key={d} className="grid-cell">{cell(h, d, i)}</span>)}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="section notes">
          <h2 className="script underline">Key</h2>
          <ul className="legend typed small">
            <li><span className="cell on demo" style={{ '--hl': highlighter('#FFE45C') } as CSSProperties}><HandBox checked small /></span>done</li>
            <li><span className="cell partial demo" style={{ '--hl': highlighter('#FFE45C') } as CSSProperties}><span className="script">1/3</span></span>some steps</li>
            <li><span className="cell upcoming demo" />upcoming</li>
          </ul>
          <p className="typed small faint">{isCurrent ? 'Tap any day up to today to fix a missed check-off. ' : ''}Past weeks are read-only.</p>
        </section>
      </article>
    </div>
  );
}
