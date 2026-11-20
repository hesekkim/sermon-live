import { Route, Routes } from 'react-router-dom';
import Listen from './pages/Listen/Listen';

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Listen />} />
    </Routes>
  );
}
