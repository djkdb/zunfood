import { Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeScreen } from './screens/HomeScreen';
import { CreateRoomScreen } from './screens/CreateRoomScreen';
import { JoinRoomScreen } from './screens/JoinRoomScreen';
import { RoomScreen } from './screens/RoomScreen';

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/create" element={<CreateRoomScreen />} />
        <Route path="/join" element={<JoinRoomScreen />} />
        <Route path="/join/:code" element={<JoinRoomScreen />} />
        <Route path="/room/:code" element={<RoomScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
