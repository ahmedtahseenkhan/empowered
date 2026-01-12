import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

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
import CoursesPage from './pages/CoursesPage';
import CourseCreatePage from './pages/CourseCreatePage';
import SubscriptionSettingsPage from './pages/SubscriptionSettingsPage';
import HelpSupportPage from './pages/HelpSupportPage';
import PublicProfilePage from './pages/PublicProfilePage';
import FindMentorPage from './pages/FindMentorPage';
import MentorResultsPage from './pages/MentorResultsPage';
import MentorPublicProfilePage from './pages/MentorPublicProfilePage';
import BookMentorPage from './pages/BookMentorPage';
import BookingConfirmationPage from './pages/BookingConfirmationPage';
import StudentCoursesPage from './pages/StudentCoursesPage';
import StudentMentorsPage from './pages/StudentMentorsPage';
import MentorNotesPage from './pages/MentorNotesPage';
import StudentFindMentorPage from './pages/StudentFindMentorPage';
import StudentMentorResultsPage from './pages/StudentMentorResultsPage';
import StudentMentorPublicProfilePage from './pages/StudentMentorPublicProfilePage';
import StudentBookMentorPage from './pages/StudentBookMentorPage';
import StudentBookingConfirmationPage from './pages/StudentBookingConfirmationPage';

const DashboardRouter = () => {
  const { user } = useAuth();
  if (user?.role === 'STUDENT') return <StudentDashboard />;
  return <TutorDashboard />;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
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

  if (!user) return <Navigate to="/login" />;

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

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/our-approach" element={<OurApproachPage />} />
          <Route path="/testimonials" element={<TestimonialsPage />} />
          <Route path="/work-with-us" element={<WorkWithUsPage />} />
          <Route path="/contact-us" element={<ContactUsPage />} />
          <Route path="/find-mentor" element={<FindMentorPage />} />
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
            path="/student/my-courses"
            element={
              <ProtectedRoute>
                <StudentCoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/find-mentor"
            element={
              <ProtectedRoute>
                <StudentFindMentorPage />
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
            path="/sessions"
            element={
              <ProtectedRoute>
                <TutorSessionsPage />
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
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
