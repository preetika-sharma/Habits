import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadAll, updateSettings } from './db';
import { addDays, todayISO, weekStartOf } from './lib/dates';
import { Scorer, canEdit } from './lib/scoring';
import type { ISODate } from './lib/types';
import type { Account } from './AuthGate';
import { Icon } from './components/ui';
import { TodayView } from './components/TodayView';
import { WeekView } from './components/WeekView';
import { SummaryView } from './components/SummaryView';
import { HabitSheet } from './components/HabitSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { TemplateEditor } from './components/TemplateEditor';

type Tab = 'today' | 'week' | 'summary';

/** Current local date, refreshed every minute and when the app regains focus. */
function useToday(): ISODate {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const tick = () => setToday(todayISO());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return today;
}

export default function App({ account }: { account: Account }) {
  const data = useLiveQuery(loadAll, []);
  const today = useToday();
  const scorer = useMemo(() => (data ? new Scorer(data) : null), [data]);

  const [tab, setTab] = useState<Tab>('today');
  const [selected, setSelected] = useState(today);
  const [gridWeek, setGridWeek] = useState(weekStartOf(today));
  const [summaryWeek, setSummaryWeek] = useState(addDays(weekStartOf(today), -7));
  const [sheet, setSheet] = useState<{ habitId?: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  // When the day rolls over, move the Today view along with it.
  useEffect(() => {
    setSelected((s) => (canEdit(s, today) ? s : today));
    setGridWeek(weekStartOf(today));
  }, [today]);

  // Show last week's summary on the first open after a week ends.
  const summaryChecked = useRef<ISODate | null>(null);
  useEffect(() => {
    if (!data || summaryChecked.current === today) return;
    summaryChecked.current = today;
    const thisWeek = weekStartOf(today);
    const prev = addDays(thisWeek, -7);
    const hadHabits = data.habits.some((h) => h.createdOn < thisWeek);
    const seen = data.settings.lastSummarySeen;
    if (hadHabits && (!seen || seen < prev)) {
      setSummaryWeek(prev);
      setTab('summary');
      void updateSettings({ lastSummarySeen: prev });
    }
  }, [data, today]);

  if (!data || !scorer) return <div className="app loading" aria-busy="true" />;

  const openDay = (d: ISODate) => { setSelected(d); setTab('today'); };
  // Until a full week has passed, the summary shows the current week so far.
  const firstWeek = data.habits.map((h) => weekStartOf(h.createdOn)).sort()[0] ?? weekStartOf(today);
  const shownSummaryWeek = summaryWeek < firstWeek ? weekStartOf(today) : summaryWeek;

  return (
    <div className="app">
      <main className="screen">
        {tab === 'today' && (
          <TodayView data={data} scorer={scorer} today={today} selected={selected} onSelect={setSelected}
            onAdd={() => setSheet({})} onEdit={(habitId) => setSheet({ habitId })} onSettings={() => setSettingsOpen(true)} />
        )}
        {tab === 'week' && (
          <WeekView data={data} scorer={scorer} today={today} weekStart={gridWeek} onWeek={setGridWeek} onOpenDay={openDay} />
        )}
        {tab === 'summary' && (
          <SummaryView data={data} scorer={scorer} today={today} weekStart={shownSummaryWeek} onWeek={setSummaryWeek}
            onDone={() => setTab('today')} />
        )}
      </main>

      <nav className="tabbar" aria-label="Main">
        {([['today', 'Today'], ['week', 'Week'], ['summary', 'Summary']] as const).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}>
            <Icon name={id} size={22} stroke={tab === id ? 2.2 : 2} />
            {label}
          </button>
        ))}
      </nav>

      {sheet && <HabitSheet data={data} scorer={scorer} today={today} habitId={sheet.habitId} onClose={() => setSheet(null)} />}
      {settingsOpen && (
        <SettingsSheet settings={data.settings} account={account} onClose={() => setSettingsOpen(false)}
          onEditTemplate={() => { setSettingsOpen(false); setTemplateOpen(true); }} />
      )}
      {templateOpen && account.isAdmin && (
        <TemplateEditor data={data} scorer={scorer} today={today} userId={account.id} onClose={() => setTemplateOpen(false)} />
      )}
    </div>
  );
}
