import { useEffect, useState } from 'react';
import { addTemplateHabits } from '../db';
import { todayISO } from '../lib/dates';
import { describeTemplateHabit, summarizeTemplate, type TemplateHabit } from '../lib/template';
import { fetchDefaultTemplate, markOnboarded } from '../template';
import { HandBox, Icon } from './ui';

/** First sign-in on a new account: start from the default habit list, or with a blank journal. */
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [list, setList] = useState<TemplateHabit[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<'default' | 'blank' | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setLoadError('');
    fetchDefaultTemplate().then(setList, () => setLoadError("Couldn't load the default habits. Check your connection and try again."));
  };
  useEffect(load, []);

  const choose = async (choice: 'default' | 'blank') => {
    setBusy(choice);
    setError('');
    try {
      // Record the choice first: if that fails nothing has changed, so trying again can't add the habits twice.
      await markOnboarded();
      if (choice === 'default' && list?.length) await addTemplateHabits(list, todayISO());
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setBusy(null);
    }
  };

  const daily = list?.filter((h) => h.type === 'daily') ?? [];
  const weekly = list?.filter((h) => h.type === 'weekly') ?? [];
  const hasDefault = !!list?.length;

  return (
    <div className="login">
      <div className="cover onboarding">
        <div className="cover-label">
          <span className="script">your journal</span>
          <span className="typed small">let's get started</span>
        </div>
        <p className="typed">How would you like to begin? You can add, edit, or remove habits any time.</p>

        {loadError && (
          <div className="choice">
            <p className="error" role="alert">{loadError}</p>
            <button type="button" className="btn outline" onClick={load}>Try again</button>
          </div>
        )}
        {!list && !loadError && <p className="typed muted" aria-busy="true">Loading the default habits…</p>}

        {hasDefault && (
          <section className="choice" aria-labelledby="choice-default">
            <h2 id="choice-default">Start with the default habits</h2>
            <p className="typed small muted">You'll get {summarizeTemplate(list!)}, ready to tick off today:</p>
            {[['daily', daily], ['weekly targets', weekly]].map(([label, group]) => (group as TemplateHabit[]).length > 0 && (
              <ul key={label as string} className="choice-list" aria-label={label as string}>
                {(group as TemplateHabit[]).map((h, i) => (
                  <li key={i}>
                    <HandBox checked={false} small />
                    <span className="grow">
                      <strong>{h.name}</strong>
                      <span className="typed small muted">{describeTemplateHabit(h)}{h.steps.length ? `: ${h.steps.join(', ')}` : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ))}
            <button type="button" className="btn primary wide" disabled={!!busy} onClick={() => void choose('default')}>
              {busy === 'default' ? 'Setting up…' : 'Use these habits'}<Icon name="arrowRight" size={18} stroke={2.4} />
            </button>
          </section>
        )}

        {(list || loadError) && (
          <section className="choice" aria-labelledby="choice-blank">
            <h2 id="choice-blank">Start blank</h2>
            <p className="typed small muted">An empty journal. You add your own habits, one at a time, with the + button.</p>
            <button type="button" className={`btn ${hasDefault ? 'outline' : 'primary'} wide`} disabled={!!busy} onClick={() => void choose('blank')}>
              {busy === 'blank' ? 'Setting up…' : 'Start blank'}
            </button>
          </section>
        )}

        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
