import { useEffect, useState } from 'react';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import App from './App';
import { LoginScreen, SetupNeeded } from './components/LoginScreen';
import { clearLocal } from './db';
import { supabase } from './supabase';
import { syncEngine } from './sync';

export interface Account {
  id: string;
  email: string;
  signOut: () => Promise<void>;
}

type User = { id: string; email: string };

const fromSession = (s: Session | null): User | null => (s ? { id: s.user.id, email: s.user.email ?? '' } : null);

/**
 * The session supabase-js saved last time. Used when the app starts offline with an
 * expired access token: the refresh can't reach the server, but the user is still
 * signed in and the local-first app should open.
 */
function storedUser(): User | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const u = JSON.parse(localStorage.getItem(k)!)?.user;
        if (u?.id) return { id: u.id, email: u.email ?? '' };
      }
    }
  } catch { /* storage unavailable */ }
  return null;
}

export function AuthGate() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => {
      if (data.session) setUser(fromSession(data.session));
      else setUser(error && isAuthRetryableFetchError(error) ? storedUser() : null);
    });
    // Only set state here: calling supabase from inside this callback can deadlock.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setUser(null);
      else if (session) setUser(fromSession(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    syncEngine.start(userId).then(() => { if (live) setReadyFor(userId); }, () => { if (live) setReadyFor(userId); });
    return () => { live = false; syncEngine.stop(); };
  }, [userId]);

  if (!supabase) return <SetupNeeded />;
  if (user === undefined || (user && readyFor !== user.id)) return <div className="app loading" aria-busy="true" />;
  if (!user) return <LoginScreen />;

  const signOut = async () => {
    syncEngine.stop();
    await clearLocal();
    await supabase!.auth.signOut({ scope: 'local' });
    setReadyFor(null);
  };

  return <App account={{ ...user, signOut }} />;
}
