import { useState } from 'react';
import Button from '../../../shared/components/Button/Button';
import InputField from '../../../shared/components/InputField/InputField';
import type { OperatorCopy } from '../translations';
import styles from './OperatorAuth.module.css';

interface OperatorLoginProps {
  labels: OperatorCopy;
  isUnavailable: boolean;
  loginFailed: boolean;
  isSubmitting: boolean;
  onSubmit: (password: string) => Promise<boolean>;
  onRetry: () => void;
}

export default function OperatorLogin({
  labels,
  isUnavailable,
  loginFailed,
  isSubmitting,
  onSubmit,
  onRetry,
}: OperatorLoginProps) {
  const [password, setPassword] = useState('');

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedPassword = password;
    setPassword('');
    await onSubmit(submittedPassword);
  };

  return (
    <main className={styles.screen}>
      <section className={styles.panel} aria-labelledby="operator-login-title">
        <p className={styles.brand}>{labels.brand}</p>
        <h1 id="operator-login-title">{labels.operatorAuthTitle}</h1>
        {isUnavailable && (
          <div className={styles.notice} role="alert">
            <p>{labels.operatorAuthUnavailable}</p>
            <Button variant="secondary" onClick={onRetry}>{labels.operatorAuthRetry}</Button>
          </div>
        )}
        {!isUnavailable && (
          <form className={styles.form} onSubmit={(event) => void submit(event)}>
            <InputField
              label={labels.operatorAuthPassword}
              id="operator-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              error={loginFailed}
              errorMessage={loginFailed ? labels.operatorAuthInvalid : ''}
              required
              autoFocus
            />
            <Button type="submit" fullWidth disabled={isSubmitting || password.length === 0}>
              {isSubmitting ? labels.operatorAuthChecking : labels.operatorAuthSubmit}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}