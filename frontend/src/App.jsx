import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

// Auth pages
import Register from './pages/auth/Register';
import Login from './pages/auth/Login';
import TrainerLogin from './pages/auth/TrainerLogin';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import MaintenancePage from './pages/auth/MaintenancePage';

// HR layout + pages
import HRLayout from './components/hr/HRLayout';
import HRDashboard from './pages/hr/HRDashboard';
import Employees from './pages/hr/Employees';
import EmployeeDetail from './pages/hr/EmployeeDetail';
import LeadPipeline from './pages/hr/LeadPipeline';
import LeadDetail from './pages/hr/LeadDetail';
import Tasks from './pages/hr/Tasks';
import TaskDetail from './pages/hr/TaskDetail';
import Reports from './pages/hr/Reports';

// Company layout + pages
import CompanyLayout from './pages/company/CompanyLayout';
import CompanyDashboard from './pages/company/CompanyDashboard';
import TalentPool from './pages/company/TalentPool';
import JobPostings from './pages/company/JobPostings';
import ShortlistView from './pages/company/ShortlistView';
import InterviewScheduler from './pages/company/InterviewScheduler';
import OfferManagement from './pages/company/OfferManagement';
import CompanyProfile from './pages/company/CompanyProfile';

// Candidate layout + pages
import CandidateLayout from './pages/candidate/CandidateLayout';
import CandidateDashboard from './pages/candidate/CandidateDashboard';
import CandidateProfile from './pages/candidate/CandidateProfile';
import CandidateJobs from './pages/candidate/CandidateJobs';
import CandidateApplications from './pages/candidate/CandidateApplications';
import CandidateInterviews from './pages/candidate/CandidateInterviews';
import CandidateDocuments from './pages/candidate/CandidateDocuments';

// Company training
import CompanyTraining from './pages/company/CompanyTraining';

// HR offer request pages
import OfferRequests from './pages/hr/OfferRequests';
import OfferRequestDetail from './pages/hr/OfferRequestDetail';

// HR interview request pages
import InterviewRequestDetail from './pages/hr/InterviewRequestDetail';
import Interviews from './pages/hr/Interviews';
import HRInvoices from './pages/hr/HRInvoices';
import ResumeSourcing from './pages/hr/ResumeSourcing';
import PackageRequests from './pages/hr/PackageRequests';

// Company payments
import CompanyPayments from './pages/company/CompanyPayments';
import PaymentCallback from './pages/company/PaymentCallback';
import ResumeUnlockCallback from './pages/company/ResumeUnlockCallback';

// Admin payments
import AdminPayments from './pages/admin/AdminPayments';

// Notifications page
import NotificationsPage from './pages/NotificationsPage';

// Outreach module
import OutreachLayout from './components/outreach/OutreachLayout';
import OutreachDashboard from './pages/outreach/OutreachDashboard';
import ContactLists from './pages/outreach/ContactLists';
import ContactListDetail from './pages/outreach/ContactListDetail';
import EmailCampaigns from './pages/outreach/EmailCampaigns';
import EmailCampaignNew from './pages/outreach/EmailCampaignNew';
import EmailCampaignDetail from './pages/outreach/EmailCampaignDetail';
import WhatsAppCampaigns from './pages/outreach/WhatsAppCampaigns';
import WhatsAppCampaignNew from './pages/outreach/WhatsAppCampaignNew';
import WhatsAppCampaignDetail from './pages/outreach/WhatsAppCampaignDetail';
import WhatsAppTemplates from './pages/outreach/WhatsAppTemplates';
import Replies from './pages/outreach/Replies';
import ReplyDetail from './pages/outreach/ReplyDetail';
import OutreachCalls from './pages/outreach/OutreachCalls';
import OutreachAnalytics from './pages/outreach/OutreachAnalytics';

// Admin layout + pages
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import CompanyApprovals from './pages/admin/CompanyApprovals';
import CompanyRequests from './pages/admin/CompanyRequests';
import CandidateManagement from './pages/admin/CandidateManagement';
import HRStaffManagement from './pages/admin/HRStaffManagement';
import RecruitmentOversight from './pages/admin/RecruitmentOversight';
import PlatformAnalytics from './pages/admin/PlatformAnalytics';
import AuditLog from './pages/admin/AuditLog';
import PlatformSettings from './pages/admin/PlatformSettings';
import TrainingManager from './pages/admin/TrainingManager';

// Company requests page
import CompanyRequestsPage from './pages/company/CompanyRequestsPage';

const RoleRedirect = () => {
  const { user } = useAuth();
  const routes = {
    candidate: '/candidate',
    company:   '/company',
    hr_staff:  '/hr',
    admin:     '/admin',
    trainer:   '/admin/training',
  };
  return <Navigate to={routes[user?.role] || '/login'} replace />;
};

// The /admin index is an admin-only dashboard; trainers share the shell but
// land on the training studio instead of a 403-ing admin dashboard.
const AdminHome = () => {
  const { user } = useAuth();
  return user?.role === 'trainer'
    ? <Navigate to="/admin/training" replace />
    : <AdminDashboard />;
};

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/trainer" element={<TrainerLogin />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/maintenance" element={<MaintenancePage />} />

        {/* Role-based redirect */}
        <Route path="/dashboard" element={
          <ProtectedRoute><RoleRedirect /></ProtectedRoute>
        } />

        {/* ── HR Module ─────────────────────────────── */}
        <Route path="/hr" element={
          <ProtectedRoute allowedRoles={['hr_staff', 'admin']}>
            <HRLayout />
          </ProtectedRoute>
        }>
          <Route index element={<HRDashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="employees/:id" element={<EmployeeDetail />} />
          <Route path="calls" element={<Navigate to="/outreach/calls" replace />} />
          <Route path="leads" element={<Navigate to="/outreach/leads" replace />} />
          <Route path="leads/:id" element={<Navigate to="/outreach/leads" replace />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="tasks/:id" element={<TaskDetail />} />
          <Route path="reports" element={<Reports />} />
          <Route path="offer-requests" element={<OfferRequests />} />
          <Route path="offer-requests/:id" element={<OfferRequestDetail />} />
          <Route path="interviews" element={<Interviews />} />
          <Route path="interview-requests" element={<Navigate to="/hr/interviews" replace />} />
          <Route path="interview-requests/:id" element={<InterviewRequestDetail />} />
          <Route path="scheduled-interviews" element={<Navigate to="/hr/interviews" replace />} />
          <Route path="package-requests" element={<PackageRequests />} />
          <Route path="invoices" element={<HRInvoices />} />
          <Route path="invoices/:id" element={<HRInvoices />} />
          <Route path="sourcing" element={<ResumeSourcing />} />
        </Route>

        {/* ── Candidate Module ───────────────────────── */}
        <Route path="/candidate" element={
          <ProtectedRoute allowedRoles={['candidate']}>
            <CandidateLayout />
          </ProtectedRoute>
        }>
          <Route index element={<CandidateDashboard />} />
          <Route path="profile" element={<CandidateProfile />} />
          <Route path="jobs" element={<CandidateJobs />} />
          <Route path="applications" element={<CandidateApplications />} />
          <Route path="interviews" element={<CandidateInterviews />} />
          <Route path="documents" element={<CandidateDocuments />} />
        </Route>

        {/* ── Company Module ─────────────────────────── */}
        <Route path="/company" element={
          <ProtectedRoute allowedRoles={['company']}>
            <CompanyLayout />
          </ProtectedRoute>
        }>
          <Route index element={<CompanyDashboard />} />
          <Route path="talent" element={<TalentPool />} />
          <Route path="jobs" element={<JobPostings />} />
          <Route path="shortlist" element={<ShortlistView />} />
          <Route path="interviews" element={<InterviewScheduler />} />
          <Route path="offers" element={<OfferManagement />} />
          <Route path="profile" element={<CompanyProfile />} />
          <Route path="training" element={<CompanyTraining />} />
          <Route path="requests" element={<CompanyRequestsPage />} />
          <Route path="payments" element={<CompanyPayments />} />
          <Route path="payments/:invoiceId" element={<CompanyPayments />} />
          <Route path="payments/:invoiceId/callback" element={<PaymentCallback />} />
          <Route path="talent/unlock-callback" element={<ResumeUnlockCallback />} />
        </Route>

        {/* ── Admin Module ───────────────────────────── */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin', 'trainer']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminHome />} />
          <Route path="companies" element={<CompanyApprovals />} />
          <Route path="requests" element={<CompanyRequests />} />
          <Route path="candidates" element={<CandidateManagement />} />
          <Route path="staff" element={<HRStaffManagement />} />
          <Route path="recruitment" element={<RecruitmentOversight />} />
          <Route path="analytics" element={<PlatformAnalytics />} />
          <Route path="audit-log" element={<AuditLog />} />
          <Route path="training" element={<TrainingManager />} />
          <Route path="settings" element={<PlatformSettings />} />
          <Route path="placement-fees" element={<Navigate to="/admin/payments" replace />} />
          <Route path="payments" element={<AdminPayments />} />
        </Route>

        {/* ── Outreach Module ────────────────────────── */}
        <Route path="/outreach" element={
          <ProtectedRoute allowedRoles={['hr_staff', 'admin']}>
            <OutreachLayout />
          </ProtectedRoute>
        }>
          <Route index element={<OutreachDashboard />} />
          <Route path="lists" element={<ContactLists />} />
          <Route path="lists/:id" element={<ContactListDetail />} />
          <Route path="email" element={<EmailCampaigns />} />
          <Route path="email/new" element={<EmailCampaignNew />} />
          <Route path="email/:id" element={<EmailCampaignDetail />} />
          <Route path="whatsapp" element={<WhatsAppCampaigns />} />
          <Route path="whatsapp/new" element={<WhatsAppCampaignNew />} />
          <Route path="whatsapp/templates" element={<WhatsAppTemplates />} />
          <Route path="whatsapp/:id" element={<WhatsAppCampaignDetail />} />
          <Route path="replies" element={<Replies />} />
          <Route path="replies/:id" element={<ReplyDetail />} />
          <Route path="calls" element={<OutreachCalls />} />
          <Route path="leads" element={<LeadPipeline />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="analytics" element={<OutreachAnalytics />} />
        </Route>

        {/* Notifications page — accessible to all authenticated users */}
        <Route path="/notifications" element={
          <ProtectedRoute><NotificationsPage /></ProtectedRoute>
        } />

        {/* Legacy redirects */}
        <Route path="/dashboard/company" element={<Navigate to="/company" replace />} />
        <Route path="/dashboard/admin" element={<Navigate to="/admin" replace />} />

        {/* Fallbacks */}
        <Route path="/unauthorized" element={
          <div className="flex items-center justify-center h-screen text-xl text-red-500">
            Access Denied
          </div>
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
    </GoogleOAuthProvider>
  );
}
