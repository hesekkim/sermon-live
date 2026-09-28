import { useCallback, useEffect, useState } from 'react';
import {
  fetchOperatorSession,
  loginOperator,
  logoutOperator,
  setOperatorCsrfToken,
} from './operatorAuthApi';

export type OperatorAuthStatus =
  | 'checking'
  | 'authenticated'
  | 'unauthenticated'
  | 'unavailable';

export function useOperatorAuth() {
  const [status, setStatus] = useState<OperatorAuthStatus>('checking');
  const [loginFailed, setLoginFailed] = useState(false);
  const [loginUnavailable, setLoginUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    setStatus('checking');
    try {
      const session = await fetchOperatorSession();
      setOperatorCsrfToken(session.authenticated ? session.csrf_token ?? null : null);
      setStatus(session.authenticated ? 'authenticated' : 'unauthenticated');
    } catch {
      setOperatorCsrfToken(null);
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleExpired = () => {
      setOperatorCsrfToken(null);
      setLoginFailed(false);
      setLoginUnavailable(false);
      setStatus('unauthenticated');
    };
    window.addEventListener('operator-auth-expired', handleExpired);
    return () => window.removeEventListener('operator-auth-expired', handleExpired);
  }, [refresh]);

  const login = useCallback(async (password: string) => {
    setLoginFailed(false);
    setLoginUnavailable(false);
    try {
      const csrfToken = await loginOperator(password);
      setOperatorCsrfToken(csrfToken);
      setStatus('authenticated');
      return true;
    } catch (error) {
      setLoginFailed(error instanceof Error && error.message === 'invalid-password');
      setLoginUnavailable(!(error instanceof Error) || error.message !== 'invalid-password');
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutOperator();
    setStatus('unauthenticated');
  }, []);

  return {
    status,
    loginFailed,
    loginUnavailable,
    login,
    logout,
    refresh,
  };
}