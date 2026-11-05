import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchProfile } from '../api/profiles';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

/**
 * Состояние входа:
 *   loading       проверяем сохраненную сессию или загружаем профиль
 *   signed_out    не вошел
 *   no_profile    вошел, но администратор не создал профиль (нет роли, нет доступа)
 *   profile_error не удалось загрузить профиль (например, пропала сеть)
 *   ready         можно работать
 */
export type AuthStatus = 'loading' | 'signed_out' | 'no_profile' | 'profile_error' | 'ready';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  /** Есть только в статусе ready. */
  profile: Profile | null;
  profileError: unknown;
  /** true, если сессия закончилась нажатием «Выйти», а не истечением токена. */
  isSignedOutByUser: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retryProfileLoading: () => void;
}

interface ProfileState {
  userId: string;
  profile: Profile | null;
  error: unknown;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionChecked, setIsSessionChecked] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState | null>(null);
  const [profileReloadCounter, setProfileReloadCounter] = useState(0);
  const [isSignedOutByUser, setIsSignedOutByUser] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setIsSessionChecked(true);
    });

    // Колбэк держим синхронным и не вызываем из него другие методы Supabase:
    // по документации это может привести к взаимной блокировке внутри auth-клиента.
    // Профиль загружает отдельный эффект ниже.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsSessionChecked(true);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  // Профиль перезагружаем только при смене пользователя. Обновление токена
  // (TOKEN_REFRESHED) меняет объект сессии, но не пользователя.
  useEffect(() => {
    if (!userId) return;
    let isCurrent = true;

    fetchProfile(userId).then(
      (profile) => {
        if (isCurrent) setProfileState({ userId, profile, error: undefined });
      },
      (error: unknown) => {
        if (isCurrent) setProfileState({ userId, profile: null, error });
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [userId, profileReloadCounter]);

  // Профиль, загруженный для другого пользователя, не считается: ждем свой.
  const currentProfileState = profileState && profileState.userId === userId ? profileState : null;

  let status: AuthStatus;
  if (!isSessionChecked) status = 'loading';
  else if (!userId) status = 'signed_out';
  else if (!currentProfileState) status = 'loading';
  else if (currentProfileState.error) status = 'profile_error';
  else if (!currentProfileState.profile) status = 'no_profile';
  else status = 'ready';

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    setIsSignedOutByUser(false);
  }, []);

  const signOut = useCallback(async () => {
    // Флаг ставим до выхода: к моменту, когда RequireAuth увидит signed_out,
    // он уже будет знать, что выход был по кнопке (см. RequireAuth).
    setIsSignedOutByUser(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setIsSignedOutByUser(false);
      throw error;
    }
    setProfileState(null);
  }, []);

  const retryProfileLoading = useCallback(() => {
    setProfileState(null);
    setProfileReloadCounter((counter) => counter + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      profile: status === 'ready' ? (currentProfileState?.profile ?? null) : null,
      profileError: currentProfileState?.error,
      isSignedOutByUser,
      signIn,
      signOut,
      retryProfileLoading,
    }),
    [status, session, currentProfileState, isSignedOutByUser, signIn, signOut, retryProfileLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Хук живет рядом с провайдером: так проще читать. Fast Refresh при правке
// этого файла просто перезагрузит страницу целиком, это нормально.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth нужно вызывать внутри <AuthProvider>');
  }
  return context;
}

/**
 * Профиль на защищенных страницах. RequireAuth не пускает на них без
 * профиля, поэтому здесь он гарантированно есть.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useCurrentProfile(): Profile {
  const { profile } = useAuth();
  if (!profile) {
    throw new Error('useCurrentProfile используется только на страницах за <RequireAuth>');
  }
  return profile;
}
