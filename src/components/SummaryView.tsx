import type { CSSProperties } from 'react';
import { addDays, DAY_LETTERS, formatWeekRange, isoWeek, weekDays, weekStartOf } from '../lib/dates';
import { isActiveOn, type Scorer } from '../lib/scoring';
import type { AppData, Habit, ISODate } from '../lib/types';
import { Flame, Highlight, Icon, highlighter, plural } from './ui';

interface Props {
  data: AppData;
  scorer: Scorer;
  today: ISODate;
  weekStart: ISODate;
  onWeek: (ws: ISODate) => void;
  onDone: () => void;
}

export function SummaryView({ data, scorer, today, weekStart, onWeek, onDone }: Props) {
  const days = weekDays(weekStart);
  const current = weekStartOf(today);
  const inProgress = weekStart === current;
  const elapsed = days.filter((d) => d <= today);
  const habits = data.habits.filter((h) => days.some((d) => isActiveOn(h, d))).sort((a, b) => a.sortOrder - b.sortOrder);
  const daily = habits.filter((h) => h.type === 'daily');
  const weekly = habits.filter((h) => h.type === 'weekly');
  const daysHit = elapsed.filter((d) => scorer.dayHit(d)).length;
  const targetsHit = weekly.filter((h) => scorer.weeklyHit(h, weekStart)).length;
  const firstWeek = data.habits.map((h) => weekStartOf(h.createdOn)).sort()[0] ?? current;

  // Consistency per daily habit: days done out of days it was due.
  const consistency = daily.map((h) => {
    const due = elapsed.filter((d) => isActiveOn(h, d));
    const done = due.filter((d) => scorer.isDone(h, d)).length;
    return { h, done, due: due.length, rate: due.length ? done / due.length : 1 };
  }).filter((c) => c.due > 0);
  const best = [...consistency].sort((a, b) => b.rate - a.rate || b.done - a.done)[0];
  const worst = [...consistency].sort((a, b) => a.rate - b.rate || b.due - a.due)[0];

  const streaks = data.habits.filter((h) => isActiveOn(h, today)).map((h) => h.type === 'daily'
    ? { h, current: scorer.dailyStreak(h, today), best: scorer.bestDailyStreak(h, today), unit: 'day' }
    : { h, current: scorer.weeklyStreak(h, today), best: scorer.bestWeeklyStreak(h, today), unit: 'week' })
    .sort((a, b) => b.current - a.current);

  return (
    <div className="spread">
      <article className="journal-page">
        <header className="page-head">
          <button type="button" className="flip-btn" aria-label="Previous week" disabled={weekStart <= firstWeek}
            onClick={() => onWeek(addDays(weekStart, -7))}><Icon name="chevronLeft" size={22} stroke={2.2} /></button>
          <div className="page-date">
            <h1 className="script">{inProgress ? 'Week so far' : 'Week in review'}</h1>
            <div className="typed small">week {isoWeek(weekStart)} · {formatWeekRange(weekStart)}</div>
          </div>
          <button type="button" className="flip-btn" aria-label="Next week" disabled={inProgress}
            onClick={() => onWeek(addDays(weekStart, 7))}><Icon name="chevronRight" size={22} stroke={2.2} /></button>
        </header>

        <div className="scoreboard">
          <div><span className="script big">{daysHit}<small>/7</small></span><span className="typed small">days hit</span></div>
          <div><span className="script big">{targetsHit}<small>/{weekly.length}</small></span><span className="typed small">targets hit</span></div>
        </div>

        <section className="section">
          <h2 className="script underline">How each day went</h2>
          <div className="bars" role="img" aria-label="Daily score by day">
            {days.map((d, i) => {
              const s = d <= today ? scorer.dailyScore(d) : null;
              return (
                <div key={d} className="bar-col">
                  <span className="bar-pct script">{s === null ? '' : `${Math.round(s * 100)}`}</span>
                  <span className={`bar${scorer.dayHit(d) ? ' hit' : ''}`} style={{ height: `${Math.max(s ?? 0, 0.03) * 90}px` }} />
                  <span className="bar-day typed">{DAY_LETTERS[i]}</span>
                </div>
              );
            })}
          </div>
          <p className="typed small faint">A day counts as hit at {data.settings.dailyThreshold}% of daily habits done.</p>
        </section>

        {best && worst && (
          <section className="section">
            <h2 className="script underline">Notes to self</h2>
            <ul className="notes-list typed">
              <li>★ Most consistent: <Highlight color={best.h.color} on>{best.h.name}</Highlight> ({best.done} of {plural(best.due, 'day')})</li>
              <li>
                ✎ {worst.rate < 1
                  ? <>Most missed: <strong>{worst.h.name}</strong> ({worst.done} of {plural(worst.due, 'day')})</>
                  : <>Nothing missed. Every daily habit done!</>}
              </li>
            </ul>
          </section>
        )}
      </article>

      <article className="journal-page">
        {habits.length > 0 && (
          <section className="section">
            <h2 className="script underline">Habits × days</h2>
            <div className="heat">
              <div className="heat-row head typed">
                <span />{DAY_LETTERS.map((l, i) => <span key={i}>{l}</span>)}<span />
              </div>
              {[...daily, ...weekly].map((h, idx) => (
                <HeatRow key={h.id} habit={h} days={days} today={today} scorer={scorer} weekStart={weekStart}
                  divider={idx === daily.length && daily.length > 0} />
              ))}
            </div>
          </section>
        )}

        {streaks.length > 0 && (
          <section className="section">
            <h2 className="script underline">Streaks</h2>
            <ul className="streak-list">
              {streaks.map(({ h, current: c, best: b, unit }) => (
                <li key={h.id}>
                  <Flame size={20} />
                  <span className="grow">
                    <span className="typed">{h.name}</span>
                    <span className="typed small faint">{h.type === 'daily' ? 'daily' : 'weekly'} · best {plural(b, unit)}</span>
                  </span>
                  <span className="script streak-num">{plural(c, unit)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button type="button" className="btn primary wide" onClick={onDone}>
          {weekStart < current ? `On to week ${isoWeek(current)}` : 'Back to today'}<Icon name="arrowRight" size={18} stroke={2.4} />
        </button>
      </article>
    </div>
  );
}

function HeatRow({ habit: h, days, today, scorer, weekStart, divider }: {
  habit: Habit; days: ISODate[]; today: ISODate; scorer: Scorer; weekStart: ISODate; divider: boolean;
}) {
  const daily = h.type === 'daily';
  const due = days.filter((d) => d <= today && isActiveOn(h, d));
  const done = due.filter((d) => scorer.isDone(h, d)).length;
  const target = daily ? due.length : scorer.targetFor(h.id, weekStart);
  const hit = done >= target;
  return (
    <div className={`heat-row${divider ? ' divider' : ''}`} style={{ '--hl': highlighter(h.color) } as CSSProperties}>
      <span className="grid-name typed">{h.name}</span>
      {days.map((d) => {
        const active = isActiveOn(h, d) && d <= today;
        const on = active && scorer.isDone(h, d);
        return <span key={d} className={`heat-cell${on ? ' on' : ''}${active ? '' : ' off'}`} />;
      })}
      <span className={`heat-score script${hit ? ' hit' : daily ? '' : ' warn'}`}>{done}/{target}</span>
    </div>
  );
}
