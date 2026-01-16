import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import * as LazyRoutes from './routes/lazyRoutes';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuthStore } from './stores/authStore';

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 dark:border-sky-400"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Kiosk route */}
            <Route path="/kiosk" element={<LazyRoutes.KioskPage />} />

            {/* Admin routes */}
            <Route path="/admin/login" element={<LoginPageWrapper />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <LazyRoutes.DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/massages"
              element={
                <ProtectedRoute>
                  <LazyRoutes.MassagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/massages/new"
              element={
                <ProtectedRoute>
                  <LazyRoutes.MassageFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/massages/:id/edit"
              element={
                <ProtectedRoute>
                  <LazyRoutes.MassageFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/kiosk-control"
              element={
                <ProtectedRoute>
                  <LazyRoutes.KioskControlPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/surveys"
              element={
                <ProtectedRoute>
                  <LazyRoutes.SurveysPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/surveys/:id"
              element={
                <ProtectedRoute>
                  <LazyRoutes.SurveyEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/surveys/:id/analytics"
              element={
                <ProtectedRoute>
                  <LazyRoutes.SurveyAnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/survey-responses"
              element={
                <ProtectedRoute>
                  <LazyRoutes.SurveyResponsesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/coupons/issue"
              element={
                <ProtectedRoute>
                  <LazyRoutes.CouponIssuePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/coupons/redemptions"
              element={
                <ProtectedRoute>
                  <LazyRoutes.CouponRedemptionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/coupons/wallet"
              element={
                <ProtectedRoute>
                  <LazyRoutes.CouponWalletLookupPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/coupons/settings"
              element={
                <ProtectedRoute>
                  <LazyRoutes.CouponSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/interactions"
              element={
                <ProtectedRoute>
                  <LazyRoutes.InteractionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ai-prompts"
              element={
                <ProtectedRoute>
                  <LazyRoutes.AIPromptsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/workflow-test"
              element={
                <ProtectedRoute>
                  <LazyRoutes.WorkflowTestPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/services"
              element={
                <ProtectedRoute>
                  <LazyRoutes.ServicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/knowledge-base"
              element={
                <ProtectedRoute>
                  <LazyRoutes.KnowledgeBasePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <LazyRoutes.SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/backup"
              element={
                <ProtectedRoute>
                  <LazyRoutes.BackupPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/logs"
              element={
                <ProtectedRoute>
                  <LazyRoutes.SystemLogsPage />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/kiosk" replace />} />
          </Routes>
        </Suspense>
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

  return <LazyRoutes.LoginPage />;
}

export default App;
