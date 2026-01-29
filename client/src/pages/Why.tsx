import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Heart, MapPin, Recycle, Shield, Wifi, Thermometer, Wind, Eye, Zap, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

import cityscapeImage from "@assets/generated_images/pixel_art_rochester_cityscape.png";
import pickupVanImage from "@assets/generated_images/pixel_art_pickup_van_night.png";
import binInteriorImage from "@assets/generated_images/pixel_art_littr_bin_interior.png";
import vapesImage from "@assets/generated_images/pixel_art_vapes_collection.png";
import dystopiaImage from "@/assets/images/dystopia-bg.png";
import vapeIconImage from "@/assets/images/vape-icon-transparent.png";
import littrOneImage from "@/assets/images/littr-one-official.png";
import littrOneProImage from "@/assets/images/littr-one-pro.png";
import littrOneMiniImage from "@/assets/images/littr-one-mini.png";

function SlidingDigit({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (digit !== prevDigit) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 150);
      return () => clearTimeout(timer);
    }
  }, [digit, prevDigit]);
  
  return (
    <span className="inline-block overflow-hidden relative h-[1em]" style={{ width: digit === ',' ? '0.3em' : '0.6em' }}>
      <span 
        className={`inline-block transition-transform duration-150 ease-out ${isAnimating ? '-translate-y-full' : 'translate-y-0'}`}
      >
        {prevDigit}
      </span>
      <span 
        className={`absolute top-0 left-0 inline-block transition-transform duration-150 ease-out ${isAnimating ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {digit}
      </span>
    </span>
  );
}

function WasteCounter() {
  const [count, setCount] = useState(0);
  const [prevCount, setPrevCount] = useState(0);
  
  useEffect(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const secondsElapsed = Math.floor((now.getTime() - startOfYear.getTime()) / 1000);
    const initialCount = secondsElapsed * 6;
    setCount(initialCount);
    setPrevCount(initialCount);
    
    const interval = setInterval(() => {
      setCount(prev => {
        setPrevCount(prev);
        return prev + 1;
      });
    }, 166.67); // 1000ms / 6 = 166.67ms
    
    return () => clearInterval(interval);
  }, []);
  
  const formatNumber = (num: number) => num.toLocaleString();
  const currentStr = formatNumber(count);
  const prevStr = formatNumber(prevCount);
  
  return (
    <div className="text-center">
      <div 
        className="font-black text-6xl md:text-8xl lg:text-[10rem] text-white tracking-tighter mb-4 tabular-nums leading-none drop-shadow-2xl"
        data-testid="text-waste-counter"
      >
        {currentStr.split('').map((char, i) => (
          <SlidingDigit 
            key={i} 
            digit={char} 
            prevDigit={prevStr[i] || char} 
          />
        ))}
      </div>
      <p className="text-lg md:text-xl text-gray-300 uppercase tracking-[0.3em] font-bold" data-testid="text-waste-label">
        batteries wasted this year
      </p>
    </div>
  );
}

function VapeRain() {
  const vapes = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 8,
    duration: 8 + Math.random() * 6,
    size: 16 + Math.random() * 24,
    opacity: 0.1 + Math.random() * 0.15,
  }));
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <style>{`
        @keyframes vapeRain {
          0% { transform: translateY(-100px) rotate(0deg); opacity: 0; }
          10% { opacity: var(--vape-opacity); }
          90% { opacity: var(--vape-opacity); }
          100% { transform: translateY(100vh) rotate(15deg); opacity: 0; }
        }
      `}</style>
      {vapes.map((vape) => (
        <img
          key={vape.id}
          src={vapeIconImage}
          alt=""
          className="absolute"
          style={{
            left: `${vape.left}%`,
            width: `${vape.size}px`,
            height: `${vape.size}px`,
            opacity: 0,
            ['--vape-opacity' as string]: vape.opacity,
            animation: `vapeRain ${vape.duration}s linear infinite`,
            animationDelay: `${vape.delay}s`,
            imageRendering: 'auto',
          }}
        />
      ))}
    </div>
  );
}

export default function Why() {
  return (
    <div className="min-h-screen bg-black">
      {/* Dramatic Waste Counter Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={dystopiaImage} 
            alt="Dystopian vape waste landscape" 
            className="w-full h-full object-cover opacity-60" 
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black" />
        
        {/* Vape rain effect */}
        <VapeRain />
        
        <div className="container mx-auto px-4 relative z-10 text-center text-white py-20">
          <WasteCounter />
          <p className="text-gray-400 mt-8 max-w-xl mx-auto font-medium">
            Every second, 6 batteries end up in US landfills. We're here to change that.
          </p>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1.5 h-3 bg-white/50 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-24 bg-zinc-950">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm uppercase tracking-widest text-gray-500 mb-6">Why We Exist</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-white">
              Because the planet can't wait.
            </h2>
            <p className="text-xl text-gray-300 leading-relaxed">
              Every year, millions of disposable vapes end up in landfills—leaking toxic chemicals, sparking fires in garbage trucks, and poisoning our soil. LITTR exists to end this crisis. We make responsible disposal effortless, because protecting our planet shouldn't be complicated.
            </p>
          </div>
        </div>
      </section>

      {/* LITTR One Product Showcase */}
      <section className="py-24 bg-black border-t border-zinc-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-green-500 mb-4">Smart Technology</p>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4" data-testid="heading-littr-one">Meet the LITTR One</h2>
            <p className="text-gray-400 max-w-xl mx-auto">The world's first smart vape recycling bin with integrated sensors and rewards.</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="relative flex justify-center">
              <div className="relative">
                <img 
                  src={littrOneImage} 
                  alt="LITTR One Smart Bin" 
                  className="w-80 h-96 md:w-[32rem] md:h-[40rem] object-contain"
                  style={{ imageRendering: 'pixelated' }}
                  data-testid="img-littr-one-main"
                />
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-green-500 text-black text-sm font-black px-6 py-2 rounded-full shadow-lg shadow-green-500/20">
                  NOW AVAILABLE
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <Thermometer className="h-6 w-6 text-red-400 mb-2" />
                  <h4 className="font-semibold text-white text-sm">Temperature Sensor</h4>
                  <p className="text-xs text-gray-500 mt-1">Fire detection for lithium battery safety</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <Wind className="h-6 w-6 text-blue-400 mb-2" />
                  <h4 className="font-semibold text-white text-sm">VOC Sensor</h4>
                  <p className="text-xs text-gray-500 mt-1">High-accuracy air quality monitoring</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <Eye className="h-6 w-6 text-purple-400 mb-2" />
                  <h4 className="font-semibold text-white text-sm">Ultrasonic Fill Sensor</h4>
                  <p className="text-xs text-gray-500 mt-1">Know when it's time for pickup</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <Zap className="h-6 w-6 text-green-400 mb-2" />
                  <h4 className="font-semibold text-white text-sm">LED Fill Indicator</h4>
                  <p className="text-xs text-gray-500 mt-1">Visual status ring for easy monitoring</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <Monitor className="h-6 w-6 text-cyan-400 mb-2" />
                  <h4 className="font-semibold text-white text-sm">QR Reward Screen</h4>
                  <p className="text-xs text-gray-500 mt-1">Instant rewards for every drop</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <Wifi className="h-6 w-6 text-yellow-400 mb-2" />
                  <h4 className="font-semibold text-white text-sm">WiFi Connected</h4>
                  <p className="text-xs text-gray-500 mt-1">Real-time monitoring & alerts</p>
                </div>
              </div>
              
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">
                  <Shield className="h-4 w-4 inline mr-2 text-green-500" />
                  <span className="text-white font-medium">Location Security:</span> Sensors don't just protect the bin—they monitor your space with temperature and air quality data as an extra layer of security.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Lineup */}
      <section className="py-24 bg-zinc-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-gray-500 mb-4">Product Lineup</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Choose Your Bin</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* LITTR One */}
            <div className="bg-black border-2 border-green-500 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-green-500 text-black text-xs font-bold px-2 py-0.5 rounded">
                AVAILABLE
              </div>
              <div className="h-40 flex items-center justify-center mb-6">
                <img 
                  src={littrOneImage} 
                  alt="LITTR One" 
                  className="h-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <h3 className="text-xl font-bold text-white mb-2" data-testid="text-product-name-one">LITTR One</h3>
              <p className="text-gray-500 text-sm mb-4">Standard smart bin with all sensors</p>
              <Link href="/business">
                <Button className="w-full bg-green-500 hover:bg-green-600 text-black font-semibold" data-testid="button-order-littr-one">
                  Order Now <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            
            {/* LITTR One Pro */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 relative opacity-80">
              <div className="absolute top-4 right-4 bg-zinc-700 text-gray-300 text-xs font-bold px-2 py-0.5 rounded">
                COMING SOON
              </div>
              <div className="h-40 flex items-center justify-center mb-6">
                <img 
                  src={littrOneProImage} 
                  alt="LITTR One Pro" 
                  className="h-full object-contain opacity-70"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <h3 className="text-xl font-bold text-white mb-2" data-testid="text-product-name-pro">LITTR One Pro</h3>
              <p className="text-gray-500 text-sm mb-4">Enhanced capacity + premium display</p>
              <div className="mb-4">
                <span className="text-2xl font-bold text-gray-500">TBA</span>
              </div>
              <Button className="w-full" variant="outline" disabled data-testid="button-notify-pro">
                Notify Me
              </Button>
            </div>
            
            {/* LITTR One Mini */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 relative opacity-80">
              <div className="absolute top-4 right-4 bg-zinc-700 text-gray-300 text-xs font-bold px-2 py-0.5 rounded">
                COMING SOON
              </div>
              <div className="h-40 flex items-center justify-center mb-6">
                <img 
                  src={littrOneMiniImage} 
                  alt="LITTR One Mini" 
                  className="h-32 object-contain opacity-70"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              <h3 className="text-xl font-bold text-white mb-2" data-testid="text-product-name-mini">LITTR One Mini</h3>
              <p className="text-gray-500 text-sm mb-4">Compact design for smaller spaces</p>
              <div className="mb-4">
                <span className="text-2xl font-bold text-gray-500">TBA</span>
              </div>
              <Button className="w-full" variant="outline" disabled data-testid="button-notify-mini">
                Notify Me
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Story Grid */}
      <section className="bg-zinc-900">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative h-96">
            <img src={vapesImage} alt="Collection of disposable vapes" className="w-full h-full object-cover" loading="lazy" style={{ imageRendering: 'pixelated' }} />
          </div>
          <div className="flex items-center p-12 md:p-16 bg-zinc-900">
            <div>
              <h3 className="text-2xl font-bold mb-4 text-white">The Problem We're Solving</h3>
              <p className="text-gray-400 leading-relaxed">
                Disposable vapes have created an environmental nightmare. Each device contains plastic, copper, lithium batteries, and chemical residue—all sealed into one unit that traditional recycling can't handle. When tossed in the trash, these batteries become ticking time bombs, igniting fires in garbage trucks and landfills across the country.
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="flex items-center p-12 md:p-16 order-2 md:order-1 bg-zinc-900">
            <div>
              <h3 className="text-2xl font-bold mb-4 text-white">Our Solution</h3>
              <p className="text-gray-400 leading-relaxed">
                We're building a growing network of drop-off points at smoke shops across Upstate New York—Buffalo, Rochester, Syracuse, and beyond. Free collection bins for businesses. Free drop-offs for consumers. Safe handling. Certified recycling. Zero hassle. It's recycling that actually works.
              </p>
            </div>
          </div>
          <div className="relative h-96 order-1 md:order-2">
            <img src={binInteriorImage} alt="Inside a LITTR collection bin" className="w-full h-full object-cover" loading="lazy" style={{ imageRendering: 'pixelated' }} />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">What Drives Us</p>
            <h2 className="text-3xl md:text-4xl font-bold">Our Values</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Shield className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">Safety First</h3>
              <p className="text-gray-400 text-sm">Lithium batteries demand respect. We handle them with the care they require.</p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Recycle className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">Total Transparency</h3>
              <p className="text-gray-400 text-sm">No greenwashing here. We show you exactly where your waste goes and how it's processed.</p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Heart className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">Effortless Simplicity</h3>
              <p className="text-gray-400 text-sm">If recycling is hard, people won't do it. We eliminate the friction entirely.</p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <MapPin className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">Proudly Local</h3>
              <p className="text-gray-400 text-sm">Rochester-based and committed to serving communities across Upstate NY.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team/Operations Focus */}
      <section className="relative py-32 overflow-hidden bg-zinc-950">
        <div className="absolute inset-0">
          <img src={pickupVanImage} alt="LITTR pickup van at night" className="w-full h-full object-cover opacity-40" style={{ imageRendering: 'pixelated' }} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/60" />
        <div className="container mx-auto px-4 relative z-10 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">We're not a faceless corporation.</h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-10">
            We're a small, dedicated team of locals who saw a problem and refused to ignore it. One bin at a time. One shop at a time. One neighborhood at a time—we're making a real difference in our community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/business">
              <Button size="lg" className="rounded-full px-10 bg-white text-black hover:bg-gray-100" data-testid="button-become-partner">
                Become a Partner <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="rounded-full px-10 border-white text-white hover:bg-white/10" data-testid="button-get-in-touch">
                Get in Touch
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-black text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400 mb-4">Ready to be part of the solution?</p>
          <h2 className="text-3xl font-bold mb-8">Find a drop-off location near you.</h2>
          <Link href="/dropoff">
            <Button size="lg" className="bg-white text-black hover:bg-gray-100 rounded-full px-12 font-semibold" data-testid="button-find-location">
              Find Location <MapPin className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
