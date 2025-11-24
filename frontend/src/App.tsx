import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import KioskPage from './pages/KioskPage';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import MassagesPage from './pages/admin/MassagesPage';
import MassageFormPage from './pages/admin/MassageFormPage';
import KioskControlPage from './pages/admin/KioskControlPage';
import SurveysPage from './pages/admin/SurveysPage';
import SurveyEditorPage from './pages/admin/SurveyEditorPage';
import SurveyAnalyticsPage from './pages/admin/SurveyAnalyticsPage';
import SurveyResponsesPage from './pages/admin/SurveyResponsesPage';
import SettingsPage from './pages/admin/SettingsPage';
import BackupPage from './pages/admin/BackupPage';
import SystemLogsPage from './pages/admin/SystemLogsPage';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuthStore } from './stores/authStore';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
        {/* Kiosk route */}
        <Route path="/kiosk" element={<KioskPage />} />
        
        {/* Admin routes */}
        <Route path="/admin/login" element={<LoginPageWrapper />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/massages"
          element={
            <ProtectedRoute>
              <MassagesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/massages/new"
          element={
            <ProtectedRoute>
              <MassageFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/massages/:id/edit"
          element={
            <ProtectedRoute>
              <MassageFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/kiosk-control"
          element={
            <ProtectedRoute>
              <KioskControlPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/surveys"
          element={
            <ProtectedRoute>
              <SurveysPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/surveys/:id"
          element={
            <ProtectedRoute>
              <SurveyEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/surveys/:id/analytics"
          element={
            <ProtectedRoute>
              <SurveyAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/survey-responses"
          element={
            <ProtectedRoute>
              <SurveyResponsesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/backup"
          element={
            <ProtectedRoute>
              <BackupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute>
              <SystemLogsPage />
            </ProtectedRoute>
          }
        />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/kiosk" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

// Wrapper to redirect authenticated users away from login page
function LoginPageWrapper() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }
  
  return <LoginPage />;
}

export default App;
