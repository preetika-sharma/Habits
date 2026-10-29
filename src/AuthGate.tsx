import { useEffect, useState } from 'react';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import App from './App';
import { LoginScreen, SetupNeeded } from './components/LoginScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { clearLocal } from './db';
import { supabase } from './supabase';
import { syncEngine } from './sync';
import { checkIsAdmin } from './template';

export interface Account {
  id: string;
  email: string;
  /** May edit the default habit list. */
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

type User = { id: string; email: string; onboarded: boolean };

type RawUser = { id: string; email?: string; user_metadata?: { onboarded?: unknown } };
const toUser = (u: RawUser): User => ({ id: u.id, email: u.email ?? '', onboarded: u.user_metadata?.onboarded === true });
const fromSession = (s: Session | null): User | null => (s ? toUser(s.user) : null);

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
        if (u?.id) return toUser(u);
      }
    }
  } catch { /* storage unavailable */ }
  return null;
}

export function AuthGate() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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
    checkIsAdmin(userId).then((a) => { if (live) setIsAdmin(a); });
    return () => { live = false; syncEngine.stop(); setIsAdmin(false); };
  }, [userId]);

  if (!supabase) return <SetupNeeded />;
  if (user === undefined || (user && readyFor !== user.id)) return <div className="app loading" aria-busy="true" />;
  if (!user) return <LoginScreen />;

  // New accounts choose between the default habit list and a blank journal, once.
  if (!user.onboarded) return <OnboardingScreen onDone={() => setUser({ ...user, onboarded: true })} />;

  const signOut = async () => {
    syncEngine.stop();
    await clearLocal();
    await supabase!.auth.signOut({ scope: 'local' });
    setReadyFor(null);
  };

  return <App account={{ id: user.id, email: user.email, isAdmin, signOut }} />;
}
