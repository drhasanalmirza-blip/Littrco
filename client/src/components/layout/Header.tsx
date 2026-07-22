import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Menu, X, Recycle, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export function Header() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, role, theme, toggleTheme } = useStore();

  // Logged-in users go straight to their own dashboard (session persists in
  // localStorage, so this works across visits until they log out).
  const dashboardHref =
    role === "staff" ? "/staff/dashboard" : role === "partner" ? "/partner/dashboard" : "/app";
  const dashboardLabel = role === "staff" || role === "partner" ? "Dashboard" : "My Wallet";

  const links = [
    { href: "/", label: "Home" },
    { href: "/business", label: "For Business" },
    { href: "/dropoff", label: "Drop-off" },
    { href: "/why", label: "Why" },
    { href: "/faq", label: "FAQ" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-300">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          {user && (
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center transition-all duration-500 animate-in zoom-in">
              <Recycle className="h-5 w-5 text-white transition-all duration-500" />
            </div>
          )}
          <span className="font-bold tracking-tight text-xl text-gray-900 dark:text-gray-100">
            LITTR<span className={cn(
              "font-normal transition-colors duration-500",
              user ? "text-green-500" : "text-gray-400"
            )}>.co</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {links.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors",
                user ? "hover:text-green-600" : "hover:text-gray-900 dark:hover:text-gray-100",
                location === link.href 
                  ? (user ? "text-green-600 font-semibold" : "text-gray-900 dark:text-gray-100 font-semibold")
                  : "text-gray-600 dark:text-gray-400"
              )}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-yellow-400" />
            ) : (
              <Moon className="h-4 w-4 text-gray-600" />
            )}
          </button>
          <Link href={user ? dashboardHref : "/app/login"} aria-label={user ? `Open your ${dashboardLabel.toLowerCase()}` : "Log in to your LITTR account"}>
            <Button variant="outline" size="sm" className={cn(
              "transition-colors duration-500",
              user
                ? "border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                : "border-gray-400 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            )}>
              {user ? dashboardLabel : "Login"}
            </Button>
          </Link>
          <Link href="/business" aria-label="Request a free recycling bin for your business">
            <Button size="sm" className={cn(
              "font-semibold transition-colors duration-500",
              user 
                ? "bg-green-500 hover:bg-green-600 text-white" 
                : "bg-gray-500 hover:bg-gray-600 text-white"
            )}>
              Get Free Bin
            </Button>
          </Link>
        </nav>

        <div className="md:hidden flex items-center gap-1">
          <button
            onClick={toggleTheme}
            data-testid="button-theme-toggle-mobile"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 text-yellow-400" />
            ) : (
              <Moon className="h-5 w-5 text-gray-600" />
            )}
          </button>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6 text-gray-700 dark:text-gray-300" /> : <Menu className="h-6 w-6 text-gray-700 dark:text-gray-300" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden border-t bg-white dark:bg-gray-950 dark:border-gray-800 p-4 flex flex-col gap-2 shadow-lg animate-in slide-in-from-top-2">
          {links.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={cn(
                "text-base font-medium py-3 px-4 rounded-lg transition-colors",
                location === link.href 
                  ? (user ? "bg-green-50 dark:bg-green-950 text-green-600" : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100")
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t dark:border-gray-800 mt-2 space-y-2">
            <Link href={user ? dashboardHref : "/app/login"} onClick={() => setIsOpen(false)} aria-label={user ? `Open your ${dashboardLabel.toLowerCase()}` : "Log in to your LITTR account"}>
              <Button variant="outline" className={cn(
                "w-full transition-colors duration-500",
                user
                  ? "border-green-500 text-green-600"
                  : "border-gray-400 text-gray-600 dark:border-gray-600 dark:text-gray-300"
              )}>
                {user ? dashboardLabel : "Login"}
              </Button>
            </Link>
            <Link href="/business" onClick={() => setIsOpen(false)} aria-label="Request a free recycling bin for your business">
              <Button className={cn(
                "w-full transition-colors duration-500",
                user 
                  ? "bg-green-500 hover:bg-green-600 text-white" 
                  : "bg-gray-500 hover:bg-gray-600 text-white"
              )}>
                Get Free Bin
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
