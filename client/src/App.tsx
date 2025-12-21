import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Home from "@/pages/Home";
import Business from "@/pages/Business";
import Dropoff from "@/pages/Dropoff";
import FAQ from "@/pages/FAQ";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import NotFound from "@/pages/not-found";
import { Login } from "@/components/auth/Login";
import { MobileStickyCTA } from "@/components/MobileStickyCTA";
import AdminDashboard from "@/pages/admin/Dashboard";
import StaffDashboard from "@/pages/staff/Dashboard";
import PartnerDashboard from "@/pages/partner/Dashboard";
import CustomerDashboard from "@/pages/customer/Dashboard";
import ClaimPage from "@/pages/customer/Claim";

function Router() {
  const [location] = useLocation();
  
  // Hide header/footer for dashboard/app routes
  const isDashboard = location.includes('/admin') || 
                      location.includes('/staff') || 
                      location.includes('/partner') ||
                      location.includes('/app');

  return (
    <>
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
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/locations" component={Dropoff} />
        <Route path="/safety" component={Dropoff} />
        <Route path="/privacy" component={About} />
        <Route path="/terms" component={About} />

        {/* Auth Portals */}
        <Route path="/admin/login" component={() => <Login type="admin" />} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        
        <Route path="/staff/login" component={() => <Login type="staff" />} />
        <Route path="/staff/dashboard" component={StaffDashboard} />
        
        <Route path="/partner/login" component={() => <Login type="partner" />} />
        <Route path="/partner/dashboard" component={PartnerDashboard} />

        {/* Customer App */}
        <Route path="/app" component={CustomerDashboard} />
        <Route path="/app/login" component={() => <Login type="customer" />} />
        <Route path="/app/claim" component={ClaimPage} />

        <Route component={NotFound} />
      </Switch>
      {!isDashboard && <Footer />}
      {!isDashboard && <MobileStickyCTA />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
