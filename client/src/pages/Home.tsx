import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Check, Zap, Shield, Leaf } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState, useRef } from "react";

import handsImage from "@assets/generated_images/pixel_art_hand_dropping_vape.png";
import vapesImage from "@assets/generated_images/pixel_art_vapes_collection.png";
import binImage from "@assets/generated_images/pixel_art_littr_bin_interior.png";
import rochesterImage from "@assets/generated_images/pixel_art_rochester_cityscape.png";
import shopImage from "@assets/generated_images/pixel_art_smoke_shop_night.png";
import pickupVanImage from "@assets/generated_images/pixel_art_pickup_van_night.png";
import batteriesImage from "@assets/generated_images/pixel_art_batteries_pattern.png";
import exitDoorsImage from "@assets/generated_images/pixel_art_shop_exit_doors.png";

function useScrollAnimation() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollAnimation();
  
  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-white overflow-x-hidden">
      
      {/* Hero Section - Apple Style: Clean, Bright, Bold */}
      <section className="relative min-h-screen flex flex-col justify-center bg-gradient-to-b from-gray-50 to-white overflow-hidden">
        <div className="container mx-auto px-6 lg:px-12 pt-20 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* Left: Text Content */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
                <Leaf className="h-4 w-4" />
                Free recycling for Upstate NY
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-gray-900 leading-[1.05] mb-8">
                Recycle your vapes.
                <span className="block text-gray-400">In seconds.</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-gray-500 leading-relaxed mb-10 max-w-md">
                Drop off dead vapes and batteries at any partner location. It's free, fast, and keeps our community safe.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/dropoff">
                  <Button 
                    size="lg" 
                    className="bg-gray-900 text-white hover:bg-gray-800 text-lg px-8 h-16 rounded-2xl font-semibold w-full sm:w-auto shadow-xl shadow-gray-900/20 hover:shadow-2xl hover:shadow-gray-900/30 transition-all duration-300 hover:-translate-y-1"
                    data-testid="button-find-dropoff"
                  >
                    Find a Drop-off <MapPin className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/business">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="border-2 border-gray-200 text-gray-700 hover:bg-gray-50 text-lg px-8 h-16 rounded-2xl font-medium w-full sm:w-auto transition-all duration-300"
                    data-testid="button-for-business"
                  >
                    For Businesses <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Right: Hero Image - Large, Prominent */}
            <div 
              className="relative"
              style={{ transform: `translateY(${scrollY * 0.1}px)` }}
            >
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-gray-900/20 border border-gray-100">
                <img 
                  src={handsImage} 
                  alt="Drop your vape in seconds" 
                  className="w-full h-auto object-cover"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">100% Free</p>
                    <p className="text-sm text-gray-500">Always. No fees ever.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <div className="w-8 h-12 border-2 border-gray-300 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-gray-400 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-8 bg-gray-900 text-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 text-sm md:text-base">
            <span className="flex items-center gap-2 font-medium">
              <Check className="h-5 w-5 text-emerald-400" /> EPA Compliant
            </span>
            <span className="flex items-center gap-2 font-medium">
              <Check className="h-5 w-5 text-emerald-400" /> Fire-Safe Bins
            </span>
            <span className="flex items-center gap-2 font-medium">
              <Check className="h-5 w-5 text-emerald-400" /> Buffalo • Rochester • Syracuse
            </span>
          </div>
        </div>
      </section>

      {/* How It Works - Clean 3 Steps */}
      <section className="py-24 md:py-32 bg-white">
        <div className="container mx-auto px-6 lg:px-12">
          <AnimatedSection className="text-center mb-20">
            <p className="text-emerald-600 font-semibold text-sm uppercase tracking-widest mb-4">How it works</p>
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900">Collect. Drop. Done.</h2>
          </AnimatedSection>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 max-w-6xl mx-auto">
            <AnimatedSection delay={100}>
              <div className="group cursor-pointer">
                <div className="relative rounded-3xl overflow-hidden mb-8 bg-gray-100 aspect-[4/3]">
                  <img 
                    src={vapesImage} 
                    alt="Collect your vapes" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ imageRendering: 'pixelated' }}
                    loading="lazy"
                  />
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-900 text-white font-bold text-lg mb-4">1</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Collect</h3>
                  <p className="text-gray-500 text-lg">Gather your dead vapes and small batteries at home.</p>
                </div>
              </div>
            </AnimatedSection>
            
            <AnimatedSection delay={200}>
              <div className="group cursor-pointer">
                <div className="relative rounded-3xl overflow-hidden mb-8 bg-gray-100 aspect-[4/3]">
                  <img 
                    src={binImage} 
                    alt="Drop at any location" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ imageRendering: 'pixelated' }}
                    loading="lazy"
                  />
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-900 text-white font-bold text-lg mb-4">2</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Drop</h3>
                  <p className="text-gray-500 text-lg">Visit any partner shop and use the LITTR bin. 10 seconds.</p>
                </div>
              </div>
            </AnimatedSection>
            
            <AnimatedSection delay={300}>
              <div className="group cursor-pointer">
                <div className="relative rounded-3xl overflow-hidden mb-8 bg-gray-100 aspect-[4/3]">
                  <img 
                    src={pickupVanImage} 
                    alt="We handle the rest" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ imageRendering: 'pixelated' }}
                    loading="lazy"
                  />
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-900 text-white font-bold text-lg mb-4">3</div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">Done</h3>
                  <p className="text-gray-500 text-lg">We pick up and recycle everything safely. That's it.</p>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* The Problem - Full Width Visual */}
      <section className="relative py-32 md:py-40 overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={rochesterImage} 
            alt="Rochester cityscape" 
            className="w-full h-full object-cover"
            style={{ imageRendering: 'pixelated' }}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/95 to-gray-900/80" />
        </div>
        <div className="container mx-auto px-6 lg:px-12 relative z-10">
          <AnimatedSection>
            <div className="max-w-3xl">
              <p className="text-emerald-400 font-semibold text-sm uppercase tracking-widest mb-6">Why it matters</p>
              <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-8">
                Vape batteries cause <span className="text-red-400">300+ fires</span> in landfills every year.
              </h2>
              <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-2xl">
                Lithium batteries don't belong in the trash. Together, we can stop this—one drop-off at a time.
              </p>
              <Link href="/dropoff">
                <Button 
                  size="lg" 
                  className="bg-white text-gray-900 hover:bg-gray-100 text-lg px-8 h-14 rounded-2xl font-semibold"
                >
                  Find a Drop-off <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* What We Accept */}
      <section className="py-24 md:py-32 bg-gray-50">
        <div className="container mx-auto px-6 lg:px-12">
          <AnimatedSection className="text-center mb-16">
            <p className="text-emerald-600 font-semibold text-sm uppercase tracking-widest mb-4">What we accept</p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Bring us these</h2>
          </AnimatedSection>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <AnimatedSection delay={100}>
              <div className="bg-white rounded-3xl p-6 text-center shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer border border-gray-100">
                <div className="h-24 w-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                  <span className="text-5xl">💨</span>
                </div>
                <h3 className="font-bold text-lg text-gray-900">Disposable Vapes</h3>
                <p className="text-emerald-600 text-sm font-medium mt-2">Accepted</p>
              </div>
            </AnimatedSection>
            
            <AnimatedSection delay={200}>
              <div className="bg-white rounded-3xl p-6 text-center shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer border border-gray-100">
                <div className="h-24 w-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                  <span className="text-5xl">🔋</span>
                </div>
                <h3 className="font-bold text-lg text-gray-900">Small Batteries</h3>
                <p className="text-emerald-600 text-sm font-medium mt-2">Accepted</p>
              </div>
            </AnimatedSection>
            
            <AnimatedSection delay={300}>
              <div className="bg-white rounded-3xl p-6 text-center shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer border border-gray-100">
                <div className="h-24 w-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                  <span className="text-5xl">📱</span>
                </div>
                <h3 className="font-bold text-lg text-gray-900">Phone Batteries</h3>
                <p className="text-emerald-600 text-sm font-medium mt-2">Accepted</p>
              </div>
            </AnimatedSection>
            
            <AnimatedSection delay={400}>
              <div className="bg-white rounded-3xl p-6 text-center shadow-sm border border-gray-100 opacity-60">
                <div className="h-24 w-24 mx-auto mb-6 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <span className="text-5xl">🚗</span>
                </div>
                <h3 className="font-bold text-lg text-gray-500">EV Batteries</h3>
                <p className="text-red-500 text-sm font-medium mt-2">Not accepted</p>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Partner Locations - Unique Images */}
      <section className="py-24 md:py-32 bg-white">
        <div className="container mx-auto px-6 lg:px-12">
          <AnimatedSection className="text-center mb-16">
            <p className="text-emerald-600 font-semibold text-sm uppercase tracking-widest mb-4">Drop-off locations</p>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Find a partner shop</h2>
          </AnimatedSection>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <AnimatedSection delay={100}>
              <div className="group cursor-pointer">
                <div className="relative rounded-3xl overflow-hidden mb-6 aspect-[4/3] bg-gray-100">
                  <img 
                    src={shopImage} 
                    alt="Elite Smoke Shop" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ imageRendering: 'pixelated' }}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm text-gray-900 px-4 py-2 rounded-full text-sm font-medium">
                      <MapPin className="h-4 w-4" /> Get directions
                    </span>
                  </div>
                </div>
                <h3 className="font-bold text-xl text-gray-900">Elite Smoke Shop</h3>
                <p className="text-gray-500">Rochester, NY</p>
              </div>
            </AnimatedSection>
            
            <AnimatedSection delay={200}>
              <div className="group cursor-pointer">
                <div className="relative rounded-3xl overflow-hidden mb-6 aspect-[4/3] bg-gray-100">
                  <img 
                    src={exitDoorsImage} 
                    alt="High End Smoke Shop" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ imageRendering: 'pixelated' }}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm text-gray-900 px-4 py-2 rounded-full text-sm font-medium">
                      <MapPin className="h-4 w-4" /> Get directions
                    </span>
                  </div>
                </div>
                <h3 className="font-bold text-xl text-gray-900">High End Smoke Shop</h3>
                <p className="text-gray-500">Rochester, NY</p>
              </div>
            </AnimatedSection>
            
            <AnimatedSection delay={300}>
              <div className="group cursor-pointer">
                <div className="relative rounded-3xl overflow-hidden mb-6 aspect-[4/3] bg-gray-100">
                  <img 
                    src={batteriesImage} 
                    alt="Red Eye Smoke Shop" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ imageRendering: 'pixelated' }}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm text-gray-900 px-4 py-2 rounded-full text-sm font-medium">
                      <MapPin className="h-4 w-4" /> Get directions
                    </span>
                  </div>
                </div>
                <h3 className="font-bold text-xl text-gray-900">Red Eye Smoke Shop</h3>
                <p className="text-gray-500">Rochester, NY</p>
              </div>
            </AnimatedSection>
          </div>
          
          <AnimatedSection className="text-center mt-16">
            <Link href="/dropoff">
              <Button 
                size="lg" 
                variant="outline"
                className="border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white text-lg px-10 h-14 rounded-2xl font-semibold transition-all duration-300"
              >
                View All Locations <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-24 bg-gray-900 text-white">
        <div className="container mx-auto px-6 lg:px-12">
          <AnimatedSection className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold">Why LITTR?</h2>
          </AnimatedSection>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <AnimatedSection delay={100} className="text-center">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                <Shield className="h-8 w-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Safe Handling</h3>
              <p className="text-gray-400">Fire-safe containers and trained crews keep everyone protected.</p>
            </AnimatedSection>
            
            <AnimatedSection delay={200} className="text-center">
              <div className="h-16 w-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-6">
                <Leaf className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">EPA Certified</h3>
              <p className="text-gray-400">All materials go to compliant recycling facilities.</p>
            </AnimatedSection>
            
            <AnimatedSection delay={300} className="text-center">
              <div className="h-16 w-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
                <Zap className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Always Free</h3>
              <p className="text-gray-400">No fees, no strings. We believe recycling should be accessible.</p>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 md:py-40 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-6 lg:px-12 text-center">
          <AnimatedSection>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-8">
              Ready to recycle<br />responsibly?
            </h2>
            <p className="text-xl md:text-2xl text-gray-500 mb-12 max-w-xl mx-auto">
              Find your nearest drop-off and do the right thing in under a minute.
            </p>
            <Link href="/dropoff">
              <Button 
                size="lg" 
                className="bg-gray-900 text-white hover:bg-gray-800 text-xl px-12 h-20 rounded-2xl font-bold shadow-xl shadow-gray-900/20 hover:shadow-2xl hover:shadow-gray-900/30 transition-all duration-300 hover:-translate-y-1"
                data-testid="button-find-location-cta"
              >
                Find a Drop-off <MapPin className="ml-3 h-6 w-6" />
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
