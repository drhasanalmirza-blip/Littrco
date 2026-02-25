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
        <Route path="/veriscan" component={VeriScanPage} />

        {/* Auth Portals */}
        <Route path="/admin/login" component={() => <Login type="admin" />} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        
        <Route path="/staff/login" component={() => <Login type="staff" />} />
        <Route path="/staff/setup" component={StaffSetup} />
        <Route path="/staff/dashboard" component={StaffDashboard} />
        
        <Route path="/partner/login" component={() => <Login type="partner" />} />
        <Route path="/partner/dashboard" component={PartnerDashboard} />

        {/* Customer App */}
        <Route path="/app" component={CustomerDashboard} />
        <Route path="/app/dashboard" component={CustomerDashboard} />
        <Route path="/app/login" component={() => <Login type="customer" />} />
        <Route path="/app/register" component={RegisterPage} />
        <Route path="/app/claim" component={ClaimPage} />
        <Route path="/app/scan" component={ScanPage} />
        <Route path="/app/store" component={StorePage} />
        <Route path="/app/bonus" component={BonusPage} />
        <Route path="/app/change-password" component={ChangePasswordPage} />
        <Route path="/app/settings" component={ChangePasswordPage} />
        <Route path="/app/drops" component={DropsPage} />
        <Route path="/app/history" component={CustomerDashboard} />

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
