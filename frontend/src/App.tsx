import { Navigate, Route, Routes } from 'react-router-dom';
import Broadcast from './pages/Operator/broadcast/Broadcast.tsx';
import OperatorLayout from './pages/Operator/layout/OperatorLayout.tsx';
import { OperatorPrefsProvider } from './pages/Operator/OperatorPrefs.tsx';
import Settings from './pages/Operator/settings/Settings.tsx';
import Listen from './pages/Listen/Listen.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/listen" replace />} />
      <Route path="/listen" element={<Listen />} />
      <Route
        path="/operator"
        element={
          <OperatorPrefsProvider>
            <OperatorLayout />
          </OperatorPrefsProvider>
        }
      >
        <Route index element={<Navigate to="broadcast" replace />} />
        <Route path="settings" element={<Settings />} />
        <Route path="broadcast" element={<Broadcast />} />
      </Route>
    </Routes>
  );
}
