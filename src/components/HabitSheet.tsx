import { useState } from 'react';
import { archiveHabit, createHabit, deleteHabit, moveHabit, updateHabit, type HabitInput } from '../db';
import { weekStartOf } from '../lib/dates';
import type { Scorer } from '../lib/scoring';
import type { AppData, HabitType, ISODate } from '../lib/types';
import { COLORS, HandBox, Highlight, Icon, Sheet } from './ui';

interface Props {
  data: AppData;
  scorer: Scorer;
  today: ISODate;
  habitId?: string;
  onClose: () => void;
}

export function HabitSheet({ data, scorer, today, habitId, onClose }: Props) {
  const existing = habitId ? data.habits.find((h) => h.id === habitId) : undefined;
  const [type, setType] = useState<HabitType>(existing?.type ?? 'daily');
  const [name, setName] = useState(existing?.name ?? '');
  const color = existing?.color ?? COLORS[0].hex;
  const [target, setTarget] = useState(existing ? scorer.targetFor(existing.id, weekStartOf(today)) : 3);
  const [subs, setSubs] = useState<{ id?: string; name: string }[]>(
    existing ? scorer.activeSubtasks(existing.id, today).map((s) => ({ id: s.id, name: s.name })) : [],
  );
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const addSub = () => {
    const t = draft.trim();
    if (!t) return;
    setSubs([...subs, { name: t }]);
    setDraft('');
  };
  const moveSub = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= subs.length) return;
    const next = [...subs];
    [next[i], next[j]] = [next[j], next[i]];
    setSubs(next);
  };

  const save = async () => {
    if (!name.trim()) { setError('Give the habit a name.'); return; }
    const pending = draft.trim() ? [...subs, { name: draft.trim() }] : subs;
    const input: HabitInput = { name, color, type, target, subtasks: pending.filter((s) => s.name.trim()) };
    if (existing) await updateHabit(existing.id, input, today);
    else await createHabit(input, today);
    onClose();
  };

  const archive = async () => {
    if (!existing) return;
    if (!confirm(`Archive “${existing.name}”? It will be hidden from today on. Its history is kept.`)) return;
    await archiveHabit(existing.id, today);
    onClose();
  };
  const remove = async () => {
    if (!existing) return;
    if (!confirm(`Delete “${existing.name}” and all of its history? This can't be undone.`)) return;
    await deleteHabit(existing.id);
    onClose();
  };

  const daily = type === 'daily';
  const stepsText = subs.length ? `${subs.length} steps` : 'No steps';

  return (
    <Sheet title={existing ? 'Edit habit' : 'New habit'} onClose={onClose}
      actions={<button type="button" className="link-btn strong" onClick={save}>Save</button>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="segmented" role="radiogroup" aria-label="Habit type">
          {(['daily', 'weekly'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} disabled={!!existing && type !== t}
              className={type === t ? 'on' : ''} onClick={() => setType(t)}>
              {t === 'daily' ? 'Daily' : 'Weekly target'}
            </button>
          ))}
        </div>
        <p className="hint tight">
          {daily ? 'Due every day. Counts toward your daily score and day streak.' : 'Hit a number of check-ins on any days. Scored per week, with a weekly streak.'}
          {existing && ' The type can’t be changed after creating a habit.'}
        </p>

        <div className="field">
          <label htmlFor="habit-name">Name</label>
          <input id="habit-name" type="text" value={name} data-autofocus={existing ? undefined : ''} placeholder={daily ? 'e.g. Drink 3L water' : 'e.g. Run'}
            onChange={(e) => { setName(e.target.value); setError(''); }} aria-invalid={!!error} aria-describedby={error ? 'name-error' : undefined} />
          {error && <span id="name-error" className="error">{error}</span>}
        </div>

        {!daily && (
          <div className="stepper card soft">
            <div>
              <strong>Target per week</strong>
              <span className="muted">At most one check-in a day{existing ? '. Changes apply from this week.' : ''}</span>
            </div>
            <div className="stepper-ctl">
              <button type="button" className="icon-btn outline" aria-label="Fewer times per week" disabled={target <= 1}
                onClick={() => setTarget(Math.max(1, target - 1))}><Icon name="minus" size={18} stroke={2.6} /></button>
              <output aria-live="polite">{target}×</output>
              <button type="button" className="icon-btn outline" aria-label="More times per week" disabled={target >= 7}
                onClick={() => setTarget(Math.min(7, target + 1))}><Icon name="plus" size={18} stroke={2.6} /></button>
            </div>
          </div>
        )}

        <div className="field">
          <div className="field-head"><span className="label-text">Steps (optional)</span><span className="muted">All must be done</span></div>
          <ul className="step-list">
            {subs.map((s, i) => (
              <li key={s.id ?? `new-${i}`}>
                <input type="text" value={s.name} aria-label={`Step ${i + 1}`}
                  onChange={(e) => setSubs(subs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <button type="button" className="icon-btn ghost" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => moveSub(i, -1)}><Icon name="up" size={16} /></button>
                <button type="button" className="icon-btn ghost" aria-label={`Move ${s.name} down`} disabled={i === subs.length - 1} onClick={() => moveSub(i, 1)}><Icon name="down" size={16} /></button>
                <button type="button" className="icon-btn ghost" aria-label={`Remove ${s.name}`} onClick={() => setSubs(subs.filter((_, j) => j !== i))}><Icon name="close" size={16} /></button>
              </li>
            ))}
            <li className="add-step">
              <input type="text" value={draft} placeholder="Add a step" aria-label="New step"
                onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} />
              <button type="button" className="icon-btn soft accent" aria-label="Add step" onClick={addSub}><Icon name="plus" size={18} stroke={2.6} /></button>
            </li>
          </ul>
          <p className="hint tight">With steps, the habit counts as done for a day only when every step is checked.{existing ? ' Step changes apply from today; past days keep their result.' : ''}</p>
        </div>

        <div className="field">
          <span className="label-text">Preview</span>
          <div className="card preview">
            <HandBox checked />
            <span className="grow">
              <Highlight color={color} on className="habit-name">{name.trim() || 'Untitled habit'}</Highlight>
              <span className="muted">{daily ? 'Every day' : `${target}× a week`} · {stepsText}</span>
            </span>
          </div>
        </div>

        {existing && (
          <div className="danger-zone">
            <div className="row">
              <button type="button" className="btn outline" onClick={() => moveHabit(existing.id, -1, today)}><Icon name="up" size={16} />Move up</button>
              <button type="button" className="btn outline" onClick={() => moveHabit(existing.id, 1, today)}><Icon name="down" size={16} />Move down</button>
            </div>
            <button type="button" className="btn outline" onClick={archive}>Archive habit</button>
            <button type="button" className="btn danger" onClick={remove}>Delete habit and history</button>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
