import { useEffect, useState } from 'react';
import { redirectUrl, supabase } from '../supabase';
import { Icon } from './ui';

const RESEND_SECONDS = 60;

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait(wait - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const send = async (address: string) => {
    setBusy(true);
    setError('');
    const { error: err } = await supabase!.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true },
    });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setSentTo(address);
    setWait(RESEND_SECONDS);
  };

  const verify = async () => {
    setBusy(true);
    setError('');
    const { error: err } = await supabase!.auth.verifyOtp({ email: sentTo!, token: code.trim(), type: 'email' });
    setBusy(false);
    if (err) setError(err.message.includes('expired') || err.message.includes('invalid') ? 'That code is wrong or has expired. Request a new one.' : err.message);
    // On success the auth listener in AuthGate takes over.
  };

  return (
    <div className="login">
      <div className="cover">
        <div className="cover-label" aria-hidden="true">
          <span className="script">Habits</span>
          <span className="typed small">a little journal</span>
        </div>
        <div className="login-card">
        {!sentTo ? (
          <form className="form" onSubmit={(e) => { e.preventDefault(); if (email.trim()) void send(email.trim()); }}>
            <div>
              <h1 className="script">Open your journal</h1>
              <p className="muted">Your habits sync across all your devices. We'll email you a sign-in link and code. No password needed.</p>
            </div>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input id="login-email" type="email" autoComplete="email" inputMode="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined} />
            </div>
            {error && <p id="login-error" className="error" role="alert">{error}</p>}
            <button type="submit" className="btn primary wide" disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        ) : (
          <form className="form" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void verify(); }}>
            <div>
              <h1 className="script">Check your email</h1>
              <p className="muted">We sent a sign-in link and code to <strong>{sentTo}</strong>. Click the link, or enter the code here.</p>
            </div>
            <div className="field">
              <label htmlFor="login-code">Sign-in code</label>
              <input id="login-code" className="code-input" type="text" inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]*" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456" autoFocus aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} />
            </div>
            {error && <p id="login-error" className="error" role="alert">{error}</p>}
            <button type="submit" className="btn primary wide" disabled={busy || code.length < 6}>
              {busy ? 'Checking…' : 'Sign in'}<Icon name="arrowRight" size={18} stroke={2.4} />
            </button>
            <div className="row center">
              <button type="button" className="link-btn" disabled={busy || wait > 0} onClick={() => void send(sentTo!)}>
                {wait > 0 ? `Resend in ${wait}s` : 'Resend email'}
              </button>
              <button type="button" className="link-btn" onClick={() => { setSentTo(null); setCode(''); setError(''); }}>
                Use a different email
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}

export function SetupNeeded() {
  return (
    <div className="login">
      <div className="login-card card">
        <h1>Sync isn't configured</h1>
        <p className="muted">
          This build has no Supabase settings. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see README), then rebuild.
        </p>
      </div>
    </div>
  );
}
