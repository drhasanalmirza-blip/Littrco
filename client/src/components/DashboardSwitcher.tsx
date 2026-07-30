import { useLocation } from "wouter";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Recycle, Store, Shield } from "lucide-react";

/**
 * Switch between the account's WORK dashboard (staff or partner) and the CUSTOMER
 * dashboard.
 *
 * Every account now has a customer wallet — the server provisions one lazily on
 * first use — so staff and partners can earn and redeem from the bins they run
 * just like anyone else. This is the control that gets them there and back; the
 * two dashboards are separate routes (`/staff/dashboard`, `/partner/dashboard`,
 * `/app`), not a mode flag, so nothing about the current view is ambiguous.
 *
 * `role` is the account's real role and never changes here. Rendering nothing for
 * a plain CUSTOMER is deliberate: they have no second dashboard to switch to, and
 * a dead control is worse than no control.
 */
export function DashboardSwitcher({
  current,
  className = "",
}: {
  /** Which dashboard is on screen right now. */
  current: "staff" | "partner" | "customer";
  className?: string;
}) {
  const role = useStore((s) => s.role);
  const [, setLocation] = useLocation();

  // The work dashboard this account owns, if any.
  const workPath = role === "staff" ? "/staff/dashboard" : role === "partner" ? "/partner/dashboard" : null;
  if (!workPath) return null;

  const goingToCustomer = current !== "customer";
  const target = goingToCustomer ? "/app" : workPath;
  const label = goingToCustomer
    ? "Customer view"
    : role === "staff"
      ? "Staff dashboard"
      : "Partner dashboard";
  const Icon = goingToCustomer ? Recycle : role === "staff" ? Shield : Store;

  return (
    <Button
      variant="outline"
      size="sm"
      className={`gap-2 ${className}`}
      onClick={() => setLocation(target)}
      title={
        goingToCustomer
          ? "Switch to your own customer wallet — earn and redeem like any customer"
          : "Back to the bins you manage"
      }
      data-testid="button-dashboard-switch"
    >
      <ArrowLeftRight className="h-3.5 w-3.5 opacity-60" />
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
