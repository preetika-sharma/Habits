import { useRef, useState } from 'react';
import type { Account } from '../AuthGate';
import { exportJSON, importJSON, updateSettings } from '../db';
import { todayISO } from '../lib/dates';
import type { Settings } from '../lib/types';
import { syncEngine, useSyncState, type SyncState } from '../sync';
import { Sheet, plural } from './ui';

export function SettingsSheet({ settings, account, onClose }: { settings: Settings; account: Account; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const sync = useSyncState();

  const doExport = async () => {
    const blob = new Blob([await exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `habit-tracker-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage('Backup downloaded.');
  };

  const doImport = async (file: File) => {
    if (!confirm('Importing replaces all habits and history in your account, on every device, with the backup. Continue?')) return;
    try {
      await importJSON(await file.text());
      setMessage('Backup restored.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed.');
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    await syncEngine.sync(); // send anything still waiting before this device's copy is removed
    const left = syncEngine.getState().pending;
    if (left > 0 && !confirm(`${plural(left, 'change')} on this device haven't synced yet and will be lost if you sign out now. Sign out anyway?`)) {
      setSigningOut(false);
      return;
    }
    await account.signOut();
  };

  return (
    <Sheet title="Settings" onClose={onClose} actions={<button type="button" className="link-btn strong" onClick={onClose}>Done</button>}>
      <div className="form">
        <div className="field">
          <span className="label-text">Account</span>
          <div className="card soft account">
            <div className="grow">
              <strong className="ellipsis">{account.email || 'Signed in'}</strong>
              <span className={`sync-status ${sync.phase}`} role="status">{syncText(sync)}</span>
            </div>
            <button type="button" className="btn outline small" disabled={sync.phase === 'syncing'} onClick={() => void syncEngine.sync()}>
              Sync now
            </button>
          </div>
          <button type="button" className="btn outline" disabled={signingOut} onClick={() => void signOut()}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
          <p className="hint tight">Signing out removes your habits from this device. They stay in your account.</p>
        </div>

        <div className="field">
          <div className="field-head">
            <label htmlFor="threshold" className="label-text">A day counts as hit at</label>
            <output htmlFor="threshold"><strong>{settings.dailyThreshold}%</strong></output>
          </div>
          <input id="threshold" type="range" min={50} max={100} step={5} value={settings.dailyThreshold}
            onChange={(e) => updateSettings({ dailyThreshold: Number(e.target.value) })} />
          <p className="hint tight">The share of daily habits you need to finish for the day to count toward your day streak.</p>
        </div>

        <div className="field">
          <span className="label-text">Week starts on</span>
          <p className="hint tight">Monday</p>
        </div>

        <div className="field">
          <span className="label-text">Backup</span>
          <p className="hint tight">Your habits are saved to your account. You can also keep a backup file.</p>
          <div className="row">
            <button type="button" className="btn outline" onClick={doExport}>Export JSON</button>
            <button type="button" className="btn outline" onClick={() => fileRef.current?.click()}>Import JSON</button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void doImport(f); }} />
          {message && <p className="hint tight" role="status">{message}</p>}
        </div>
      </div>
    </Sheet>
  );
}

function syncText(s: SyncState): string {
  const waiting = s.pending > 0 ? ` · ${plural(s.pending, 'change')} waiting` : '';
  if (s.phase === 'syncing') return 'Syncing…';
  if (s.phase === 'offline') return `Offline${waiting}`;
  if (s.phase === 'error') return `Sync failed: ${s.error ?? 'unknown error'}${waiting}`;
  if (!s.lastSyncedAt) return `Not synced yet${waiting}`;
  return `Synced ${timeAgo(s.lastSyncedAt)}${waiting}`;
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
