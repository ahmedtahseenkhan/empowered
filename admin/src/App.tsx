import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminLayout from './layouts/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import ApprovalsPage from './pages/ApprovalsPage';
import MentorsPage from './pages/MentorsPage';
import MentorDetailPage from './pages/MentorDetailPage';
import StudentsPage from './pages/StudentsPage';
import StudentDetailPage from './pages/StudentDetailPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import PaymentsPage from './pages/PaymentsPage';
import SupportPage from './pages/SupportPage';
import DemoRequestsPage from './pages/DemoRequestsPage';
import DemoAvailabilityPage from './pages/DemoAvailabilityPage';
import BetaApplicationsPage from './pages/BetaApplicationsPage';
import SubAdminsPage from './pages/SubAdminsPage';
import ProtectedRoute from './routes/ProtectedRoute';
import { RequirePermission, RequireSuperAdmin } from './routes/RequirePermission';
import { getStoredAdminUser, canAccessModule, firstAccessiblePath } from './lib/permissions';

// Index route: show the dashboard if allowed, otherwise send the admin to the
// first module they can access (or a no-access message if they have none).
const HomeRoute = () => {
  const user = getStoredAdminUser();
  if (canAccessModule(user, 'dashboard')) return <DashboardPage />;
  const fallback = firstAccessiblePath(user);
  if (fallback) return <Navigate to={fallback} replace />;
  return (
    <div className="text-center py-20 text-gray-500">
      You don't have access to any modules yet. Please contact a super admin.
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<AdminLayout />}>
            <Route index element={<HomeRoute />} />

            <Route element={<RequirePermission permission="mentors" />}>
              <Route path="mentors" element={<MentorsPage />} />
              <Route path="mentors/:id" element={<MentorDetailPage />} />
            </Route>

            <Route element={<RequirePermission permission="students" />}>
              <Route path="students" element={<StudentsPage />} />
              <Route path="students/:id" element={<StudentDetailPage />} />
            </Route>

            <Route element={<RequirePermission permission="approvals" />}>
              <Route path="approvals" element={<ApprovalsPage />} />
            </Route>

            <Route element={<RequirePermission permission="subscriptions" />}>
              <Route path="subscriptions" element={<SubscriptionsPage />} />
            </Route>

            <Route element={<RequirePermission permission="payments" />}>
              <Route path="payments" element={<PaymentsPage />} />
            </Route>

            <Route element={<RequirePermission permission="support" />}>
              <Route path="support" element={<SupportPage />} />
            </Route>

            <Route element={<RequirePermission permission="demo-requests" />}>
              <Route path="demo-requests" element={<DemoRequestsPage />} />
            </Route>

            <Route element={<RequirePermission permission="demo-availability" />}>
              <Route path="demo-availability" element={<DemoAvailabilityPage />} />
            </Route>

            <Route element={<RequirePermission permission="beta-applications" />}>
              <Route path="beta-applications" element={<BetaApplicationsPage />} />
            </Route>

            <Route element={<RequireSuperAdmin />}>
              <Route path="sub-admins" element={<SubAdminsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
