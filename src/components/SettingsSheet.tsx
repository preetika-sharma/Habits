import { useRef, useState } from 'react';
import { exportJSON, importJSON, updateSettings } from '../db';
import { todayISO } from '../lib/dates';
import type { Settings } from '../lib/types';
import { Sheet } from './ui';

export function SettingsSheet({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

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
    if (!confirm('Importing replaces all habits and history on this device with the backup. Continue?')) return;
    try {
      await importJSON(await file.text());
      setMessage('Backup restored.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed.');
    }
  };

  return (
    <Sheet title="Settings" onClose={onClose} actions={<button type="button" className="link-btn strong" onClick={onClose}>Done</button>}>
      <div className="form">
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
          <p className="hint tight">Your data stays in this browser only. Export a backup to keep it safe or move it to another device.</p>
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
