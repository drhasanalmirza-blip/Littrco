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
import About from "@/pages/About";
import NotFound from "@/pages/not-found";
import { Login } from "@/components/auth/Login";
import { MobileStickyCTA } from "@/components/MobileStickyCTA";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import StaffDashboard from "@/pages/staff/Dashboard";
import PartnerDashboard from "@/pages/partner/Dashboard";
import CustomerDashboard from "@/pages/customer/Dashboard";
import ClaimPage from "@/pages/customer/Claim";
import RegisterPage from "@/pages/customer/Register";
import ChangePasswordPage from "@/pages/customer/ChangePassword";
import StorePage from "@/pages/customer/Store";

function guard<P extends object>(C: React.ComponentType<P>) {
  const G = (p: P) => <ErrorBoundary><C {...p} /></ErrorBoundary>;
  G.displayName = `Guarded(${C.displayName || C.name})`;
  return G;
}

const GStaff = guard(StaffDashboard);
const GPartner = guard(PartnerDashboard);
const GCustomer = guard(CustomerDashboard);
const GClaim = guard(ClaimPage);
const GStore = guard(StorePage);
const GPwd = guard(ChangePasswordPage);

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

function Router() {
  const [location] = useLocation();
  const isDashboard = ["/staff", "/partner", "/app", "/claim"].some(p => location.startsWith(p));

  return (
    <>
      <ScrollToTop />
      {!isDashboard && <Header />}
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/business" component={Business} />
        <Route path="/dropoff" component={Dropoff} />
        <Route path="/faq" component={FAQ} />
        <Route path="/why" component={Why} />
        <Route path="/contact" component={Contact} />
        <Route path="/about" component={About} />
        <Route path="/locations" component={Dropoff} />
        <Route path="/safety" component={Dropoff} />
        <Route path="/privacy" component={Why} />
        <Route path="/terms" component={Why} />

        <Route path="/staff/login" component={() => <Login type="staff" />} />
        <Route path="/staff/dashboard" component={GStaff} />

        <Route path="/partner/login" component={() => <Login type="partner" />} />
        <Route path="/partner/dashboard" component={GPartner} />

        <Route path="/app" component={GCustomer} />
        <Route path="/app/dashboard" component={GCustomer} />
        <Route path="/app/login" component={() => <Login type="customer" />} />
        <Route path="/app/register" component={RegisterPage} />
        <Route path="/app/store" component={GStore} />
        <Route path="/app/change-password" component={GPwd} />
        <Route path="/app/settings" component={GPwd} />

        {/* QR-claim landing — token in path */}
        <Route path="/claim/:token" component={GClaim} />

        <Route component={NotFound} />
      </Switch>
      {!isDashboard && <Footer />}
      {!isDashboard && <MobileStickyCTA />}
    </>
  );
}

function ThemeInitializer() {
  const { theme } = useStore();
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); }, [theme]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}
