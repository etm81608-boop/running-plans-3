import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Roster from './pages/Roster'
import Workouts from './pages/Workouts'
import Groups from './pages/Groups'
import CalendarPage from './pages/CalendarPage'
import AssignWorkout from './pages/AssignWorkout'
import PublicWorkout from './pages/PublicWorkout'
import RunnerPage from './pages/RunnerPage'
import RunnerLogs from './pages/RunnerLogs'
import DataExport from './pages/DataExport'

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/workout/:assignmentId" element={<PublicWorkout />} />
          <Route path="/runner/:runnerId" element={<RunnerPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="roster" element={<Roster />} />
            <Route path="workouts" element={<Workouts />} />
            <Route path="groups" element={<Groups />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="assign" element={<AssignWorkout />} />
            <Route path="logs" element={<RunnerLogs />} />
            <Route path="export" element={<DataExport />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  )
}
