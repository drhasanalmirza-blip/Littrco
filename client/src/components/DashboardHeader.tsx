import { Link, useLocation } from "wouter";
import { Recycle, Sun, Moon, LogOut, Settings, Home, Wallet, KeyRound, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { useStore, apiRequest } from "@/lib/store";

/**
 * Shared header for the staff/partner dashboards.
 * - Brand mark / "Leave dashboard" = go to the homepage (stays signed in).
 * - A gear settings menu holds dark mode, temperature unit, wallet, change
 *   password, and sign out. When signed out, only the plain theme toggle shows.
 */
export default function DashboardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, theme, toggleTheme, tempUnit, setTempUnit, clearAuth } = useStore();
  const [, setLocation] = useLocation();

  const signOut = async () => {
    await apiRequest("/api/auth/logout", { method: "POST" });
    clearAuth();
    setLocation("/");
  };

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
        {/* Leave dashboard — does NOT sign out */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/")}
          className="hidden sm:inline-flex"
          data-testid="button-leave-dashboard"
        >
          <Home className="mr-1.5 h-4 w-4" /> Leave dashboard
        </Button>

        {!user ? (
          // Signed out: plain theme toggle (same as the marketing header)
          <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle light/dark mode" data-testid="button-dashboard-theme-toggle">
            {theme === "dark" ? <Sun className="h-4 w-4 text-yellow-400" /> : <Moon className="h-4 w-4" />}
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Settings" data-testid="button-settings-menu">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Dark mode toggle (kept open on click) */}
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); toggleTheme(); }}
                data-testid="menu-toggle-theme"
              >
                {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                <span className="flex-1">Dark mode</span>
                <Switch checked={theme === "dark"} className="pointer-events-none" />
              </DropdownMenuItem>

              {/* Temperature unit */}
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setTempUnit(tempUnit === "C" ? "F" : "C"); }}
                data-testid="menu-toggle-tempunit"
              >
                <Thermometer className="mr-2 h-4 w-4" />
                <span className="flex-1">Temperature unit</span>
                <span className="text-xs font-semibold text-muted-foreground">°{tempUnit}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild data-testid="menu-wallet">
                <Link href="/app"><Wallet className="mr-2 h-4 w-4" /> My wallet</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild data-testid="menu-change-password">
                <Link href="/app/change-password"><KeyRound className="mr-2 h-4 w-4" /> Change password</Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onSelect={signOut} className="text-destructive focus:text-destructive" data-testid="menu-sign-out">
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
