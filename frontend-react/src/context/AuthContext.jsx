import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabase';
import { verifyOTP } from '../services/otpSender.service';

const AuthContext = createContext({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  signInWithPhone: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return null; }
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      setProfile(data || null);
      return data;
    } catch {
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) fetchProfile(s.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) {
        fetchProfile(s.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Realtime: refresh profile when admin updates verification status
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    const channel = supabase
      .channel(`profile-changes:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${userId}` }, (payload) => {
        setProfile((prev) => prev ? { ...prev, ...payload.new } : payload.new);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session?.user?.id]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  // Phone OTP Login
  const signInWithPhone = useCallback(async (phone, otp) => {
    const data = await verifyOTP(phone, otp);
    // Refresh session after phone login
    const { data: { session: newSession } } = await supabase.auth.getSession();
    setSession(newSession);
    if (newSession?.user?.id) {
      await fetchProfile(newSession.user.id);
    }
    return data;
  }, [fetchProfile]);

  const signUp = useCallback(async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) {
      throw error;
    }
    if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
      throw new Error('This email is already registered. Please login instead.');
    }
    return data;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) return fetchProfile(session.user.id);
    return null;
  }, [session, fetchProfile]);

  const user = session?.user || null;

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile, signInWithPhone }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
