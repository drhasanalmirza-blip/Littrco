import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { Link } from "wouter";

export function MobileStickyCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black border-t border-white/10 p-4 animate-in slide-in-from-bottom-4">
      <Link href="/dropoff">
        <Button 
          size="lg" 
          className="w-full bg-white text-black hover:bg-gray-100 font-semibold h-12 rounded-full"
          data-testid="button-mobile-dropoff"
        >
          Find Drop-off <MapPin className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
