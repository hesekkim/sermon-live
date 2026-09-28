import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useOperatorPrefs } from '../OperatorPrefs';
import OperatorLayout from '../layout/OperatorLayout';
import OperatorLogin from './OperatorLogin';
import { useOperatorAuth } from './useOperatorAuth';
import styles from './OperatorAuth.module.css';

export default function OperatorAuthGate() {
  const { labels } = useOperatorPrefs();
  const location = useLocation();
  const auth = useOperatorAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (auth.status === 'checking') {
    return <main className={styles.screen} role="status">{labels.operatorAuthChecking}</main>;
  }

  if (auth.status === 'unauthenticated' || auth.status === 'unavailable') {
    const submit = async (password: string) => {
      setIsSubmitting(true);
      try {
        return await auth.login(password);
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <OperatorLogin
        key={location.pathname}
        labels={labels}
        isUnavailable={auth.status === 'unavailable' || auth.loginUnavailable}
        loginFailed={auth.loginFailed}
        isSubmitting={isSubmitting}
        onSubmit={submit}
        onRetry={() => void auth.refresh()}
      />
    );
  }

  return <OperatorLayout onLogout={auth.logout} />;
}