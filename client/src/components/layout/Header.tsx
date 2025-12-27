import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Menu, X, Recycle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export function Header() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useStore();

  const links = [
    { href: "/", label: "Home" },
    { href: "/business", label: "For Business" },
    { href: "/dropoff", label: "Drop-off" },
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQ" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          {user && (
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center transition-all duration-500 animate-in zoom-in">
              <Recycle className="h-5 w-5 text-white transition-all duration-500" />
            </div>
          )}
          <span className="font-bold tracking-tight text-xl text-gray-900">
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
                user ? "hover:text-green-600" : "hover:text-gray-900",
                location === link.href 
                  ? (user ? "text-green-600 font-semibold" : "text-gray-900 font-semibold")
                  : "text-gray-600"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link href={user ? "/app" : "/app/login"}>
            <Button variant="outline" size="sm" className={cn(
              "transition-colors duration-500",
              user 
                ? "border-green-500 text-green-600 hover:bg-green-50" 
                : "border-gray-400 text-gray-600 hover:bg-gray-50"
            )}>
              {user ? "My Wallet" : "Login"}
            </Button>
          </Link>
          <Link href="/business">
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

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6 text-gray-700" /> : <Menu className="h-6 w-6 text-gray-700" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden border-t bg-white p-4 flex flex-col gap-2 shadow-lg animate-in slide-in-from-top-2">
          {links.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={cn(
                "text-base font-medium py-3 px-4 rounded-lg transition-colors",
                location === link.href 
                  ? (user ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-900")
                  : "text-gray-600 hover:bg-gray-50"
              )}
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t mt-2 space-y-2">
            <Link href={user ? "/app" : "/app/login"} onClick={() => setIsOpen(false)}>
              <Button variant="outline" className={cn(
                "w-full transition-colors duration-500",
                user 
                  ? "border-green-500 text-green-600" 
                  : "border-gray-400 text-gray-600"
              )}>
                {user ? "My Wallet" : "Login"}
              </Button>
            </Link>
            <Link href="/business" onClick={() => setIsOpen(false)}>
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
