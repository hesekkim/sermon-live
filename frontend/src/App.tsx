import { Navigate, Route, Routes } from 'react-router-dom';
import Listen from './pages/Listen/Listen.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/listen" replace />} />
      <Route path="/listen" element={<Listen />} />
    </Routes>
  );
}
