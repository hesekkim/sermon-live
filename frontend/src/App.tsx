import { Navigate, Route, Routes } from 'react-router-dom';
import Broadcast from './pages/Operator/broadcast/Broadcast.tsx';
import OperatorAuthGate from './pages/Operator/auth/OperatorAuthGate.tsx';
import { OperatorPrefsProvider } from './pages/Operator/OperatorPrefs.tsx';
import Settings from './pages/Operator/settings/Settings.tsx';
import SermonSession from './pages/Operator/sermon-session/SermonSession.tsx';
import Listen from './pages/Listen/Listen.tsx';
import { ToastProvider } from './shared/components/Toast/ToastProvider.tsx';
import { useOperatorPrefs } from './pages/Operator/OperatorPrefs.tsx';

function OperatorProviders({ children }: { children: React.ReactNode }) {
  const { labels } = useOperatorPrefs();

  return <ToastProvider closeLabel={labels.toastClose}>{children}</ToastProvider>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/listen" replace />} />
      <Route path="/listen" element={<Listen />} />
      <Route
        path="/operator"
        element={
          <OperatorPrefsProvider>
            <OperatorProviders>
              <OperatorAuthGate />
            </OperatorProviders>
          </OperatorPrefsProvider>
        }
      >
        <Route index element={<Navigate to="broadcast" replace />} />
        <Route path="settings" element={<Settings />} />
        <Route path="sermon-session" element={<SermonSession />} />
        <Route path="broadcast" element={<Broadcast />} />
      </Route>
    </Routes>
  );
}
