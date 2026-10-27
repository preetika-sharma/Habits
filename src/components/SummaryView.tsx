import { addDays, DAY_LETTERS, formatWeekRange, isoWeek, weekDays, weekStartOf } from '../lib/dates';
import { isActiveOn, type Scorer } from '../lib/scoring';
import type { AppData, Habit, ISODate } from '../lib/types';
import { Icon, plural } from './ui';

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
    <div className="view">
      <header className="view-head">
        <div>
          <div className="eyebrow">Week {isoWeek(weekStart)} · {formatWeekRange(weekStart)}</div>
          <h1>{inProgress ? 'Week so far' : 'Week recap'}</h1>
        </div>
        <div className="head-actions">
          <button type="button" className="icon-btn outline" aria-label="Previous week" disabled={weekStart <= firstWeek}
            onClick={() => onWeek(addDays(weekStart, -7))}><Icon name="chevronLeft" size={18} stroke={2.4} /></button>
          <button type="button" className="icon-btn outline" aria-label="Next week" disabled={inProgress}
            onClick={() => onWeek(addDays(weekStart, 7))}><Icon name="chevronRight" size={18} stroke={2.4} /></button>
        </div>
      </header>

      <div className="hero card dark">
        <div className="stat-pair">
          <div className="stat"><span className="label">Days hit</span><strong>{daysHit}<small> / 7</small></strong></div>
          <div className="stat"><span className="label">Weekly targets</span><strong>{targetsHit}<small> / {weekly.length}</small></strong></div>
        </div>
        <div className="bars" role="img" aria-label="Daily score by day">
          {days.map((d, i) => {
            const s = d <= today ? scorer.dailyScore(d) : null;
            return (
              <div key={d} className="bar-col">
                <span className="bar-pct">{s === null ? '–' : `${Math.round(s * 100)}%`}</span>
                <span className={`bar${scorer.dayHit(d) ? ' hit' : ''}`} style={{ height: `${Math.max(s ?? 0, 0.04) * 58}px` }} />
                <span className="bar-day">{DAY_LETTERS[i]}</span>
              </div>
            );
          })}
        </div>
        <p className="hero-note">A day counts as hit at {data.settings.dailyThreshold}% of daily habits done.</p>
      </div>

      {best && worst && (
        <div className="stat-pair">
          <div className="card highlight">
            <span className="label good">Most consistent</span>
            <strong>{best.h.name}</strong>
            <span className="muted">{best.done} of {plural(best.due, 'day')}</span>
          </div>
          <div className="card highlight">
            <span className="label warn">Most missed</span>
            {worst.rate < 1 ? (
              <><strong>{worst.h.name}</strong><span className="muted">{worst.done} of {plural(worst.due, 'day')}</span></>
            ) : (
              <><strong>Nothing missed</strong><span className="muted">Every daily habit done</span></>
            )}
          </div>
        </div>
      )}

      {habits.length > 0 && (
        <div className="card heat">
          <h2>Habits × days</h2>
          <div className="heat-row head">
            <span />{DAY_LETTERS.map((l, i) => <span key={i}>{l}</span>)}<span />
          </div>
          {[...daily, ...weekly].map((h, idx) => (
            <HeatRow key={h.id} habit={h} days={days} today={today} scorer={scorer} weekStart={weekStart}
              divider={idx === daily.length && daily.length > 0} />
          ))}
        </div>
      )}

      {streaks.length > 0 && (
        <div className="card streak-list">
          <h2>Current streaks</h2>
          <ul>
            {streaks.map(({ h, current: c, best: b, unit }) => (
              <li key={h.id}>
                <span className="flame-tile"><Icon name="flame" size={16} /></span>
                <span className="grow">
                  <strong>{h.name}</strong>
                  <span className="muted">{h.type === 'daily' ? 'Daily' : 'Weekly'} · best {plural(b, unit)}</span>
                </span>
                <strong className="streak-num">{plural(c, unit)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" className="btn primary wide" onClick={onDone}>
        {weekStart < current ? `Go to week ${isoWeek(current)}` : 'Back to today'}<Icon name="arrowRight" size={18} stroke={2.4} />
      </button>
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
    <div className={`heat-row${divider ? ' divider' : ''}`}>
      <span className="grid-name">{h.name}</span>
      {days.map((d) => {
        const active = isActiveOn(h, d) && d <= today;
        const on = active && scorer.isDone(h, d);
        return <span key={d} className={`heat-cell${daily ? '' : ' round'}${on ? ' on' : ''}${active ? '' : ' off'}`} />;
      })}
      <span className={`heat-score${hit ? ' hit' : daily ? '' : ' warn'}`}>{done}/{target}</span>
    </div>
  );
}
