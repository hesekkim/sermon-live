import { FiMoon, FiSun } from 'react-icons/fi';
import type { AdmissionErrorKey, ListenerCopy } from '../translations';
import type { ListenerTheme } from '../useListenerPreferences';
import styles from '../Listen.module.css';

interface AdmissionFormProps {
  copy: ListenerCopy;
  error: AdmissionErrorKey | null;
  isAuthenticating: boolean;
  onAuthenticate: () => void;
  onPasswordChange: (value: string) => void;
  onSessionChange: (value: string) => void;
  onThemeChange: () => void;
  password: string;
  sessionCode: string;
  theme: ListenerTheme;
}

export function AdmissionForm({
  copy,
  error,
  isAuthenticating,
  onAuthenticate,
  onPasswordChange,
  onSessionChange,
  onThemeChange,
  password,
  sessionCode,
  theme,
}: AdmissionFormProps) {
  return (
    <main className={styles.page} data-theme={theme}>
      <header className={styles.header}>
        <h1>Sermon Live</h1>
        <button
          type="button"
          className={styles.themeButton}
          aria-label={theme === 'light' ? copy.changeToDark : copy.changeToLight}
          onClick={onThemeChange}
        >
          {theme === 'light' ? (
            <FiMoon aria-hidden="true" />
          ) : (
            <FiSun aria-hidden="true" />
          )}
        </button>
      </header>
      <section className={styles.admission} aria-labelledby="admission-title">
        <h2 id="admission-title">{copy.admission.title}</h2>
        <form
          className={styles.admissionForm}
          onSubmit={(event) => {
            event.preventDefault();
            onAuthenticate();
          }}
        >
          <label htmlFor="listener-session-code">
            <span>{copy.admission.sessionCode}</span>
            <input
              id="listener-session-code"
              autoComplete="off"
              maxLength={128}
              required
              value={sessionCode}
              onChange={(event) => onSessionChange(event.target.value)}
              aria-describedby="listener-session-code-hint"
            />
          </label>
          <p id="listener-session-code-hint" className={styles.admissionHint}>
            {copy.admission.sessionCodeHint}
          </p>
          <label htmlFor="listener-password">
            <span>{copy.admission.password}</span>
            <input
              id="listener-password"
              autoComplete="current-password"
              maxLength={128}
              minLength={8}
              required
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </label>
          {error ? (
            <p className={styles.admissionError} role="alert">
              {copy.admission.errors[error]}
            </p>
          ) : null}
          <button
            type="submit"
            className={styles.admissionSubmit}
            disabled={isAuthenticating}
          >
            {isAuthenticating
              ? copy.admission.submitting
              : copy.admission.submit}
          </button>
        </form>
      </section>
    </main>
  );
}
