import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useStore } from "@/lib/store";
import Home from "@/pages/Home";
import Business from "@/pages/Business";
import Dropoff from "@/pages/Dropoff";
import FAQ from "@/pages/FAQ";
import Why from "@/pages/Why";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/not-found";
import { Login } from "@/components/auth/Login";
import { MobileStickyCTA } from "@/components/MobileStickyCTA";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AdminDashboard from "@/pages/admin/Dashboard";
import StaffDashboard from "@/pages/staff/Dashboard";
import StaffSetup from "@/pages/staff/Setup";
import PartnerDashboard from "@/pages/partner/Dashboard";
import CustomerDashboard from "@/pages/customer/Dashboard";
import ClaimPage from "@/pages/customer/Claim";
import RegisterPage from "@/pages/customer/Register";
import ChangePasswordPage from "@/pages/customer/ChangePassword";
import ScanPage from "@/pages/customer/Scan";
import StorePage from "@/pages/customer/Store";
import BonusPage from "@/pages/customer/Bonus";
import VeriScanPage from "@/pages/VeriScan";
import DropsPage from "@/pages/customer/Drops";

function withErrorBoundary<P extends object>(Component: React.ComponentType<P>) {
  const Wrapped = (props: P) => (
    <ErrorBoundary>
      <Component {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `Guarded(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
}

const GuardedVeriScan = withErrorBoundary(VeriScanPage);
const GuardedAdminDashboard = withErrorBoundary(AdminDashboard);
const GuardedStaffSetup = withErrorBoundary(StaffSetup);
const GuardedStaffDashboard = withErrorBoundary(StaffDashboard);
const GuardedPartnerDashboard = withErrorBoundary(PartnerDashboard);
const GuardedCustomerDashboard = withErrorBoundary(CustomerDashboard);
const GuardedClaimPage = withErrorBoundary(ClaimPage);
const GuardedScanPage = withErrorBoundary(ScanPage);
const GuardedStorePage = withErrorBoundary(StorePage);
const GuardedBonusPage = withErrorBoundary(BonusPage);
const GuardedChangePasswordPage = withErrorBoundary(ChangePasswordPage);
const GuardedDropsPage = withErrorBoundary(DropsPage);

function ScrollToTop() {
  const [location] = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  return null;
}

function Router() {
  const [location] = useLocation();
  
  // Hide header/footer for dashboard/app routes
  const isDashboard = location.includes('/admin') || 
                      location.includes('/staff') || 
                      location.includes('/partner') ||
                      location.includes('/app') ||
                      location.includes('/veriscan');

  return (
    <>
      <ScrollToTop />
      {!isDashboard && <Header />}
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/business" component={Business} />
        <Route path="/dropoff" component={Dropoff} />
        <Route path="/qr" component={() => {
             // Redirect logic for /qr -> /dropoff
             window.location.href = '/dropoff'; 
             return null; 
        }} />
        <Route path="/faq" component={FAQ} />
        <Route path="/why" component={Why} />
        <Route path="/contact" component={Contact} />
        <Route path="/locations" component={Dropoff} />
        <Route path="/safety" component={Dropoff} />
        <Route path="/privacy" component={Why} />
        <Route path="/terms" component={Why} />
        <Route path="/veriscan" component={GuardedVeriScan} />

        {/* Auth Portals */}
        <Route path="/admin/login" component={() => <Login type="admin" />} />
        <Route path="/admin/dashboard" component={GuardedAdminDashboard} />
        
        <Route path="/staff/login" component={() => <Login type="staff" />} />
        <Route path="/staff/setup" component={GuardedStaffSetup} />
        <Route path="/staff/dashboard" component={GuardedStaffDashboard} />
        
        <Route path="/partner/login" component={() => <Login type="partner" />} />
        <Route path="/partner/dashboard" component={GuardedPartnerDashboard} />

        {/* Customer App */}
        <Route path="/app" component={GuardedCustomerDashboard} />
        <Route path="/app/dashboard" component={GuardedCustomerDashboard} />
        <Route path="/app/login" component={() => <Login type="customer" />} />
        <Route path="/app/register" component={RegisterPage} />
        <Route path="/app/claim" component={GuardedClaimPage} />
        <Route path="/app/scan" component={GuardedScanPage} />
        <Route path="/app/store" component={GuardedStorePage} />
        <Route path="/app/bonus" component={GuardedBonusPage} />
        <Route path="/app/change-password" component={GuardedChangePasswordPage} />
        <Route path="/app/settings" component={GuardedChangePasswordPage} />
        <Route path="/app/drops" component={GuardedDropsPage} />
        <Route path="/app/history" component={GuardedCustomerDashboard} />

        <Route component={NotFound} />
      </Switch>
      {!isDashboard && <Footer />}
      {!isDashboard && <MobileStickyCTA />}
    </>
  );
}

function ThemeInitializer() {
  const { theme } = useStore();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
