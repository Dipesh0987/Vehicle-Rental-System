import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import LoginDynamic from './pages/LoginDynamic';
import PhoneLogin from './pages/PhoneLogin';
import Vehicles from './pages/Vehicles';
import VehicleDetails from './pages/VehicleDetails';
import Booking from './pages/Booking';
import Payment from './pages/Payment';
import PaymentReturn from './pages/PaymentReturn';
import PaymentReceipt from './pages/PaymentReceipt';
import Contact from './pages/Contact';
import ProfileVerification from './pages/ProfileVerification';
import ModifyBooking from './pages/ModifyBooking';
import MyBookings from './pages/MyBookings';
import NotFound from './pages/NotFound';

import AdminLayout from './components/admin/AdminLayout';
import AdminAuthGuard from './components/admin/AdminAuthGuard';
import AdminLogin from './pages/admin/AdminLogin';
import Overview from './pages/admin/Overview';
import AdminVehicles from './pages/admin/Vehicles';
import AdminBookings from './pages/admin/Bookings';
import AdminCustomers from './pages/admin/Customers';
import AdminDrivers from './pages/admin/Drivers';
import AdminFleet from './pages/admin/Fleet';
import AdminPayments from './pages/admin/Payments';
import AdminPricing from './pages/admin/Pricing';
import AdminReports from './pages/admin/Reports';
import AdminContacts from './pages/admin/Contacts';
import AdminMaintenance from './pages/admin/Maintenance';
import DamageClaims from './pages/admin/DamageClaims';
import AdminNotifications from './pages/admin/Notifications';
import AdminRoles from './pages/admin/Admins';
import BillingDashboard from './pages/admin/BillingDashboard';
import Invoices from './pages/admin/Invoices';
import Expenses from './pages/admin/Expenses';
import Profitability from './pages/admin/Profitability';
import BillingReports from './pages/admin/BillingReports';
import AuditLogs from './pages/admin/AuditLogs';
import CustomerBilling from './pages/admin/CustomerBilling';
import VerifyBooking from './pages/VerifyBooking';

import { useAuth } from './context/AuthContext';
import { RoleProvider } from './context/RoleContext';
import WhatsAppFloat from './components/WhatsAppFloat';

// Wrapper component to provide RoleProvider with user context
function AdminRouteWrapper({ children, requiredPermission, requiredRole }) {
  const { user } = useAuth();
  return (
    <RoleProvider user={user}>
      <AdminAuthGuard requiredPermission={requiredPermission} requiredRole={requiredRole}>
        {children}
      </AdminAuthGuard>
    </RoleProvider>
  );
}

function AppContent() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  
  return (
    <>
    <Routes>
      {/* Home has its own header embedded in hero — no shared layout */}
      <Route path="/" element={<Home />} />

      {/* Pages with shared header/footer layout */}
      <Route element={<Layout />}>
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/vehicles/:slug" element={<VehicleDetails />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/payment-return" element={<PaymentReturn />} />
        <Route path="/payment-receipt" element={<PaymentReceipt />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/profile-verification" element={<ProfileVerification />} />
        <Route path="/modify-booking" element={<ModifyBooking />} />
        <Route path="/my-bookings" element={<MyBookings />} />
      </Route>

      {/* Auth pages (no shared layout) */}
      <Route path="/login" element={<PhoneLogin />} />
      <Route path="/phone-login" element={<PhoneLogin />} />
      <Route path="/login-email" element={<LoginDynamic />} />
      <Route path="/registration" element={<Navigate to="/login" replace />} />
      <Route path="/reset-password" element={<Navigate to="/login" replace />} />

      {/* Admin pages - Protected with AdminAuthGuard */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={
        <AdminRouteWrapper>
          <AdminLayout />
        </AdminRouteWrapper>
      }>
        <Route index element={<Overview />} />
        <Route path="vehicles" element={<AdminVehicles />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="drivers" element={<AdminDrivers />} />
        <Route path="fleet" element={<AdminFleet />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="pricing" element={<AdminPricing />} />
        <Route path="reports" element={
          <AdminRouteWrapper requiredPermission="view_reports">
            <AdminReports />
          </AdminRouteWrapper>
        } />
        <Route path="contacts" element={<AdminContacts />} />
        <Route path="maintenance" element={<AdminMaintenance />} />
        <Route path="damage-claims" element={<DamageClaims />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="admins" element={
          <AdminRouteWrapper requiredRole="super_admin">
            <AdminRoles />
          </AdminRouteWrapper>
        } />
        <Route path="billing" element={
          <AdminRouteWrapper requiredPermission="view_revenue">
            <BillingDashboard />
          </AdminRouteWrapper>
        } />
        <Route path="invoices" element={
          <AdminRouteWrapper requiredPermission="view_revenue">
            <Invoices />
          </AdminRouteWrapper>
        } />
        <Route path="expenses" element={
          <AdminRouteWrapper requiredPermission="view_expenses">
            <Expenses />
          </AdminRouteWrapper>
        } />
        <Route path="profitability" element={
          <AdminRouteWrapper requiredPermission="view_revenue">
            <Profitability />
          </AdminRouteWrapper>
        } />
        <Route path="billing-reports" element={
          <AdminRouteWrapper requiredPermission="view_revenue">
            <BillingReports />
          </AdminRouteWrapper>
        } />
        <Route path="audit-logs" element={
          <AdminRouteWrapper requiredPermission="view_all_data">
            <AuditLogs />
          </AdminRouteWrapper>
        } />
        <Route path="customer-billing" element={
          <AdminRouteWrapper requiredPermission="view_revenue">
            <CustomerBilling />
          </AdminRouteWrapper>
        } />
      </Route>

      {/* Public verification page (no login required) */}
      <Route path="/verify/:invoiceNumber" element={<VerifyBooking />} />

      <Route path="*" element={<NotFound />} />
    </Routes>

    {/* WhatsApp Float Button - Only on frontend pages, not admin */}
    {!isAdminPage && <WhatsAppFloat />}
    </>
  );
}

export default function App() {
  return <AppContent />;
}
