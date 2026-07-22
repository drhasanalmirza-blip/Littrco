import { Link, useLocation } from "wouter";
import { Recycle, Sun, Moon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore, apiRequest } from "@/lib/store";

/**
 * Shared header for the staff/partner dashboards: LITTR brand mark (links home),
 * dashboard title, persistent light/dark toggle (same store-backed theme as the
 * main site — persists to localStorage and the server), and logout.
 */
export default function DashboardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, theme, toggleTheme, clearAuth } = useStore();
  const [, setLocation] = useLocation();

  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="LITTR home" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500">
            <Recycle className="h-5 w-5 text-white" />
          </div>
        </Link>
        <div>
          <h1 className="text-xl font-bold leading-tight tracking-tight md:text-2xl">
            {title}
            <span className="ml-2 align-middle text-xs font-normal uppercase tracking-widest text-green-600 dark:text-green-500">
              LITTR<span className="text-muted-foreground">.co</span>
            </span>
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {user && (
          <span className="mr-2 hidden text-sm text-muted-foreground sm:inline" data-testid="text-header-email">
            {user.email}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label="Toggle light/dark mode"
          data-testid="button-dashboard-theme-toggle"
        >
          {theme === "dark" ? <Sun className="h-4 w-4 text-yellow-400" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await apiRequest("/api/auth/logout", { method: "POST" });
            clearAuth();
            setLocation("/");
          }}
          aria-label="Log out"
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
