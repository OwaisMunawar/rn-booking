import { DEMO_USERS, DomainError, demoProfiles } from '@rn-booking/shared';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

import { dataMode } from './config';
import { getSupabase } from './supabase';

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
}

interface SessionValue {
  mode: typeof dataMode;
  user: SessionUser | null;
  ready: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const demoCustomer = demoProfiles.find((p) => p.id === DEMO_USERS.customer);
const DEMO_USER: SessionUser = {
  id: DEMO_USERS.customer,
  name: demoCustomer?.fullName ?? 'Demo customer',
  email: demoCustomer?.email ?? null,
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(dataMode === 'demo' ? DEMO_USER : null);
  const [ready, setReady] = useState(dataMode === 'demo');

  useEffect(() => {
    if (dataMode === 'demo') return;
    const supabase = getSupabase();
    const toUser = (
      u: { id: string; email?: string; user_metadata: Record<string, unknown> } | null | undefined,
    ) =>
      u
        ? {
            id: u.id,
            email: u.email ?? null,
            name:
              typeof u.user_metadata.full_name === 'string'
                ? u.user_metadata.full_name
                : (u.email ?? 'Customer'),
          }
        : null;

    void supabase.auth.getSession().then(({ data }) => {
      setUser(toUser(data.session?.user));
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setUser(toUser(session?.user)),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      mode: dataMode,
      user,
      ready,
      async signIn(email, password) {
        if (dataMode === 'demo') return;
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw new DomainError('unauthenticated', error.message, { cause: error });
      },
      async signOut() {
        if (dataMode === 'demo') return;
        await getSupabase().auth.signOut();
      },
    }),
    [user, ready],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
