import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient, type AuthChangeEvent, type Session, type User } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

const configured = Boolean(url && publishableKey);
const supabase = configured ? createClient(url, publishableKey, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
}) : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function accessToken() { return (await currentSession())?.access_token || ''; }

async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Public authentication is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  return data;
}

async function signUp(email: string, password: string, displayName: string) {
  if (!supabase) throw new Error('Public authentication is not configured.');
  const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { display_name: displayName.trim() } } });
  if (error) throw error;
  return data;
}

async function resetPassword(email: string) {
  if (!supabase) throw new Error('Public authentication is not configured.');
  const redirectTo = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL || 'paladin://reset-password';
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  if (error) throw error;
}

async function handleAuthUrl(url: string) {
  if (!supabase) return false;
  const parsed = new URL(url);
  const code = parsed.searchParams.get('code');
  const tokenHash = parsed.searchParams.get('token_hash');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error) throw error;
    return true;
  }
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const accessToken = fragment.get('access_token'); const refreshToken = fragment.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    return true;
  }
  return false;
}

async function updatePassword(password: string) {
  if (!supabase) throw new Error('Public authentication is not configured.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

async function signOut() { if (supabase) await supabase.auth.signOut(); }

function onAuthStateChange(listener: (event: AuthChangeEvent, session: Session | null) => void) {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange(listener);
  return () => data.subscription.unsubscribe();
}

export const authService = {
  configured,
  currentSession,
  accessToken,
  signIn,
  signUp,
  resetPassword,
  handleAuthUrl,
  updatePassword,
  signOut,
  onAuthStateChange,
};

export type AuthUser = User;
