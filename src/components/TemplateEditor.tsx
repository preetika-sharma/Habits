import { useEffect, useState } from 'react';
import { describeTemplateHabit, normalizeTemplate, type TemplateHabit } from '../lib/template';
import type { AppData } from '../lib/types';
import type { Scorer } from '../lib/scoring';
import { fetchDefaultTemplate, saveDefaultTemplate } from '../template';
import { Icon, Sheet } from './ui';

/** Admin-only: edit the default habit list that new accounts can start with. */
export function TemplateEditor({ data, scorer, today, userId, onClose }: {
  data: AppData; scorer: Scorer; today: string; userId: string; onClose: () => void;
}) {
  const [list, setList] = useState<TemplateHabit[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDefaultTemplate().then(setList, (e) => { setList([]); setStatus(`Couldn't load the default list: ${e.message}`); });
  }, []);

  const update = (i: number, patch: Partial<TemplateHabit>) => setList(list!.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list!.length) return;
    const next = [...list!];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    setOpen(open === i ? j : open === j ? i : open);
  };
  const add = () => { setList([...list!, { name: '', type: 'daily', target: 3, steps: [] }]); setOpen(list!.length); };
  const remove = (i: number) => { setList(list!.filter((_, j) => j !== i)); setOpen(null); };

  // Seed from your own active habits (names, types, targets and steps; never check-ins).
  const copyMine = () => {
    const mine = [...scorer.habitsOn(today, 'daily'), ...scorer.habitsOn(today, 'weekly')].map((h) => ({
      name: h.name, type: h.type, target: scorer.targetFor(h.id, today),
      steps: scorer.activeSubtasks(h.id, today).map((s) => s.name),
    }));
    if (list!.length && !confirm('Replace the default list with a copy of your current habits?')) return;
    setList(mine);
    setOpen(null);
  };

  const save = async () => {
    const clean = normalizeTemplate(list);
    if (clean.length < list!.length && !confirm('Habits without a name will be removed. Save anyway?')) return;
    setSaving(true);
    setStatus('');
    try {
      await saveDefaultTemplate(clean, userId);
      setList(clean);
      setStatus(`Saved. New accounts will be offered these ${clean.length} habits.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Save failed.');
    }
    setSaving(false);
  };

  return (
    <Sheet title="Default habits" onClose={onClose}
      actions={<button type="button" className="link-btn strong" disabled={!list || saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button>}>
      <div className="form">
        <p className="hint tight">
          New accounts can start with this list, or start blank. Changes here don't touch anyone's existing habits,
          including yours. People who choose "Start over" in Settings get the latest saved version.
        </p>

        {!list ? <p className="hint tight" aria-busy="true">Loading…</p> : (
          <>
            <ul className="step-list template-list">
              {list.map((h, i) => (
                <li key={i} className="template-item">
                  <div className="template-row">
                    <button type="button" className="habit-name-btn" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                      <span className="habit-name">{h.name || 'Untitled habit'}</span>
                      <span className="habit-meta">{describeTemplateHabit(h)}</span>
                    </button>
                    <button type="button" className="icon-btn ghost" aria-label={`Move ${h.name || 'habit'} up`} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={16} /></button>
                    <button type="button" className="icon-btn ghost" aria-label={`Move ${h.name || 'habit'} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={16} /></button>
                  </div>
                  {open === i && (
                    <div className="template-fields">
                      <div className="field">
                        <label htmlFor={`t-name-${i}`}>Name</label>
                        <input id={`t-name-${i}`} type="text" value={h.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Drink 3L water" />
                      </div>
                      <div className="segmented" role="radiogroup" aria-label="Habit type">
                        {(['daily', 'weekly'] as const).map((t) => (
                          <button key={t} type="button" role="radio" aria-checked={h.type === t} className={h.type === t ? 'on' : ''} onClick={() => update(i, { type: t })}>
                            {t === 'daily' ? 'Daily' : 'Weekly target'}
                          </button>
                        ))}
                      </div>
                      {h.type === 'weekly' && (
                        <div className="stepper">
                          <div><strong>Target per week</strong></div>
                          <div className="stepper-ctl">
                            <button type="button" className="icon-btn outline" aria-label="Fewer times per week" disabled={h.target <= 1} onClick={() => update(i, { target: h.target - 1 })}><Icon name="minus" size={18} stroke={2.6} /></button>
                            <output aria-live="polite">{h.target}×</output>
                            <button type="button" className="icon-btn outline" aria-label="More times per week" disabled={h.target >= 7} onClick={() => update(i, { target: h.target + 1 })}><Icon name="plus" size={18} stroke={2.6} /></button>
                          </div>
                        </div>
                      )}
                      <div className="field">
                        <label htmlFor={`t-steps-${i}`}>Steps (optional, one per line)</label>
                        <textarea id={`t-steps-${i}`} rows={3} value={h.steps.join('\n')} placeholder={'Make bed\nStretch 10 min'}
                          onChange={(e) => update(i, { steps: e.target.value.split('\n') })} />
                      </div>
                      <button type="button" className="btn danger" onClick={() => remove(i)}>Remove from default list</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="row">
              <button type="button" className="btn outline" onClick={add}><Icon name="plus" size={16} stroke={2.4} />Add a habit</button>
              <button type="button" className="btn outline" onClick={copyMine} disabled={!data.habits.length}>Copy my habits</button>
            </div>
          </>
        )}
        {status && <p className="hint tight" role="status">{status}</p>}
      </div>
    </Sheet>
  );
}
