import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// A separate client also isolates late mutation callbacks, which cannot be cancelled.
function PrivateDataScope({ children }: { children: ReactNode }) {
  const parentClient = useQueryClient();
  const [client] = useState(() => new QueryClient({ defaultOptions: parentClient.getDefaultOptions() }));
  useLayoutEffect(() => () => {
    void client.cancelQueries();
    client.clear();
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isDemo } = useDemoMode();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;
    const applySession = (next: Session | null) => {
      if (!active) return;
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        receivedAuthEvent = true;
        applySession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!receivedAuthEvent) applySession(session);
    }).catch(() => {
      if (!receivedAuthEvent) applySession(null);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {(isDemo || !loading) && (
        <PrivateDataScope key={`${isDemo ? "demo" : "account"}:${user?.id ?? "anonymous"}`}>
          {children}
        </PrivateDataScope>
      )}
    </AuthContext.Provider>
  );
}
