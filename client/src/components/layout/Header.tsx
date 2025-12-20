import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Header() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/business", label: "For Business" },
    { href: "/dropoff", label: "Drop-off Locations" },
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-2xl">LITTR<span className="font-normal text-gray-500">.co</span></span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {links.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-black",
                location === link.href ? "text-black font-semibold" : "text-gray-500"
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/business">
            <Button variant="default" size="sm" className="font-semibold">
              Get Free Bin
            </Button>
          </Link>
        </nav>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden border-t bg-background p-4 flex flex-col gap-4 shadow-lg animate-in slide-in-from-top-2">
          {links.map((link) => (
            <Link 
              key={link.href} 
              href={link.href}
              className={cn(
                "text-lg font-medium py-2 border-b border-gray-100",
                location === link.href ? "text-black" : "text-gray-500"
              )}
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/business">
            <Button className="w-full mt-2" onClick={() => setIsOpen(false)}>
              Get Free Bin
            </Button>
          </Link>
        </div>
      )}
    </header>
  );
}
