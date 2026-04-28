import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import api from './api/axios';

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// Pages
import HomePage from './pages/HomePage';
import HowItWorksPage from './pages/HowItWorksPage';
import OurApproachPage from './pages/OurApproachPage';
import TestimonialsPage from './pages/TestimonialsPage';
import WorkWithUsPage from './pages/WorkWithUsPage';
import ContactUsPage from './pages/ContactUsPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import MentorAgreementPage from './pages/MentorAgreementPage';
import SelectUserTypePage from './pages/SelectUserTypePage';
import StudentRegisterPage from './pages/StudentRegisterPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TutorRegisterPage from './pages/TutorRegisterPage';
import TutorDashboard from './pages/TutorDashboard';
import StudentDashboard from './pages/StudentDashboard';
import TutorProfileHub from './pages/TutorProfileHub';
import TutorStudentsPage from './pages/TutorStudentsPage';
import TutorSessionsPage from './pages/TutorSessionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import PaymentsPage from './pages/PaymentsPage';
import TutorNotesPage from './pages/TutorNotesPage';
import CoursesPage from './pages/CoursesPage';
import CourseCreatePage from './pages/CourseCreatePage';
import SubscriptionSettingsPage from './pages/SubscriptionSettingsPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import HelpSupportPage from './pages/HelpSupportPage';
import PublicProfilePage from './pages/PublicProfilePage';
import FindMentorPage from './pages/FindMentorPage';
import MentorResultsPage from './pages/MentorResultsPage';
import MentorPublicProfilePage from './pages/MentorPublicProfilePage';
import BookMentorPage from './pages/BookMentorPage';
import BookingConfirmationPage from './pages/BookingConfirmationPage';
import StudentCoursesPage from './pages/StudentCoursesPage';
import StudentCourseMarketplacePage from './pages/StudentCourseMarketplacePage';
import StudentCourseDetailPage from './pages/StudentCourseDetailPage';
import StudentMentorsPage from './pages/StudentMentorsPage';
import MentorNotesPage from './pages/MentorNotesPage';
import StudentMentorResultsPage from './pages/StudentMentorResultsPage';
import StudentMentorPublicProfilePage from './pages/StudentMentorPublicProfilePage';
import StudentBookMentorPage from './pages/StudentBookMentorPage';
import StudentBookingConfirmationPage from './pages/StudentBookingConfirmationPage';
import StudentBookingPaymentReviewPage from './pages/StudentBookingPaymentReviewPage';
import TutorAIAssistPage from './pages/TutorAIAssistPage';
import StudentSessionsPage from './pages/StudentSessionsPage';
import SessionDetailPage from './pages/SessionDetailPage';
import ConnectAccountPage from './pages/ConnectAccountPage';
import BookDemoPage from './pages/BookDemoPage';
import FAQPage from './pages/FAQPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import BetaPage from './pages/BetaPage';

const DashboardRouter = () => {
  const { user } = useAuth();
  if (user?.role === 'STUDENT') return <StudentDashboard />;
  return <TutorDashboard />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [subLoading, setSubLoading] = useState(true);
  const [subStatus, setSubStatus] = useState<{ subscription_status?: string | null; subscription_end_date?: string | null } | null>(null);

  const isTutor = user?.role !== 'STUDENT';
  const isAllowedWithoutSubscription = useMemo(() => {
    const p = location.pathname;
    return p === '/subscription-settings' || p === '/settings' || p === '/help';
  }, [location.pathname]);

  useEffect(() => {
    const run = async () => {
      if (!user || !isTutor || isAllowedWithoutSubscription) {
        setSubLoading(false);
        return;
      }

      setSubLoading(true);
      try {
        const res = await api.get('/payments/mentor/status');
        setSubStatus(res.data);
      } catch (e) {
        console.error('Failed to fetch subscription status', e);
        setSubStatus({ subscription_status: null, subscription_end_date: null });
      } finally {
        setSubLoading(false);
      }
    };

    run();
  }, [user, isTutor, isAllowedWithoutSubscription]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  if (isTutor && !isAllowedWithoutSubscription) {
    if (subLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-900 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Checking subscription...</p>
          </div>
        </div>
      );
    }

    const status = subStatus?.subscription_status;
    const endDate = subStatus?.subscription_end_date ? new Date(subStatus.subscription_end_date) : null;
    const hasValidEnd = !!endDate && !Number.isNaN(endDate.getTime());
    const daysLeft = hasValidEnd ? Math.ceil((endDate!.getTime() - Date.now()) / (1000 * 3600 * 24)) : null;
    const expired = daysLeft !== null && daysLeft <= 0;

    const isActiveOrTrial = status === 'active' || status === 'trialing';

    // Redirect if not active/trialing, or if there is an end date and it has already passed.
    if (!isActiveOrTrial || (hasValidEnd && expired)) {
      return <Navigate to="/subscription-settings" replace />;
    }
  }

  return <>{children}</>;
};

const GuestRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-900 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" />;

  return <>{children}</>;
};

/** Restricts a route to PREMIUM-tier tutors only. Must be used inside ProtectedRoute. */
const PremiumRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [tier, setTier] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.get('/payments/mentor/status')
      .then(res => setTier(res.data?.tier ?? null))
      .catch(() => setTier(null))
      .finally(() => setChecking(false));
  }, [user?.id]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (tier !== 'PREMIUM') {
    return <Navigate to="/subscription-settings?upgrade=ai-assist" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/our-approach" element={<OurApproachPage />} />
          <Route path="/testimonials" element={<TestimonialsPage />} />
          <Route path="/work-with-us" element={<WorkWithUsPage />} />
          <Route path="/contact-us" element={<ContactUsPage />} />
          <Route path="/book-demo" element={<BookDemoPage />} />
          <Route path="/faqs" element={<FAQPage />} />
          <Route path="/find-mentor" element={<FindMentorPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/beta" element={<BetaPage />} />
          <Route path="/mentors" element={<MentorResultsPage />} />
          <Route path="/mentors/:id" element={<MentorPublicProfilePage />} />
          <Route path="/book/:id" element={<BookMentorPage />} />
          <Route path="/booking/confirmation" element={<BookingConfirmationPage />} />

          {/* Legal Pages */}
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/mentor-agreement" element={<MentorAgreementPage />} />

          {/* Authentication - Redirect to dashboard if already logged in */}
          <Route path="/select-user-type" element={<GuestRoute><SelectUserTypePage /></GuestRoute>} />
          <Route path="/student-register" element={<GuestRoute><StudentRegisterPage /></GuestRoute>} />
          <Route path="/tutor-register" element={<TutorRegisterPage />} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardRouter />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AccountSettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/my-courses"
            element={
              <ProtectedRoute>
                <StudentCoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/courses/marketplace"
            element={
              <ProtectedRoute>
                <StudentCourseMarketplacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/courses/:id"
            element={
              <ProtectedRoute>
                <StudentCourseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/find-mentor"
            element={
              <ProtectedRoute>
                <Navigate to="/student/mentors" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/mentors"
            element={
              <ProtectedRoute>
                <StudentMentorResultsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/mentors/:id"
            element={
              <ProtectedRoute>
                <StudentMentorPublicProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/book/:id"
            element={
              <ProtectedRoute>
                <StudentBookMentorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/booking/confirmation"
            element={
              <ProtectedRoute>
                <StudentBookingConfirmationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/booking/review"
            element={
              <ProtectedRoute>
                <StudentBookingPaymentReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/my-mentors"
            element={
              <ProtectedRoute>
                <StudentMentorsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/notes"
            element={
              <ProtectedRoute>
                <MentorNotesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/sessions"
            element={
              <ProtectedRoute>
                <StudentSessionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/sessions/:id"
            element={
              <ProtectedRoute>
                <SessionDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tutor-onboarding"
            element={
              <ProtectedRoute>
                <TutorProfileHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses"
            element={
              <ProtectedRoute>
                <CoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/students"
            element={
              <ProtectedRoute>
                <TutorStudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tutor/notes"
            element={
              <ProtectedRoute>
                <TutorNotesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sessions"
            element={
              <ProtectedRoute>
                <TutorSessionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sessions/:id"
            element={
              <ProtectedRoute>
                <SessionDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <PaymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/new"
            element={
              <ProtectedRoute>
                <CourseCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/:id/edit"
            element={
              <ProtectedRoute>
                <CourseCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subscription-settings"
            element={
              <ProtectedRoute>
                <SubscriptionSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/help"
            element={
              <ProtectedRoute>
                <HelpSupportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/preview"
            element={
              <ProtectedRoute>
                <PublicProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tutor/ai-assist"
            element={
              <ProtectedRoute>
                <PremiumRoute>
                  <TutorAIAssistPage />
                </PremiumRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/connect-account"
            element={
              <ProtectedRoute>
                <ConnectAccountPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
