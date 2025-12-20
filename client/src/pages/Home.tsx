import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Quote, Recycle, Shield, Truck } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";

import vapesImage from "@assets/generated_images/disposable_vapes_product_shot.png";
import binImage from "@assets/generated_images/littr_bin_in_smoke_shop.png";
import batteriesImage from "@assets/generated_images/batteries_aerial_pattern.png";
import rochesterImage from "@assets/generated_images/rochester_ny_cityscape.png";
import handsImage from "@assets/generated_images/hands_dropping_vape_in_bin.png";
import macroImage from "@assets/generated_images/abstract_battery_macro.png";
import shopImage from "@assets/generated_images/smoke_shop_storefront_night.png";
import sustainImage from "@assets/generated_images/e-waste_sustainability_concept.png";

const collageImages = [vapesImage, binImage, batteriesImage, handsImage, macroImage, shopImage];

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % collageImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Hero Section with Image Grid */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Animated background collage */}
        <div className="absolute inset-0 grid grid-cols-2 md:grid-cols-3 gap-1 opacity-30">
          {collageImages.map((img, i) => (
            <div 
              key={i} 
              className={`relative overflow-hidden transition-all duration-1000 ${
                i === activeIndex ? 'opacity-100 scale-105' : 'opacity-60 scale-100'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black z-10" />
        
        {/* Content */}
        <div className="container mx-auto px-4 relative z-20 pt-20">
          <div className="max-w-3xl mx-auto text-center text-white">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-400 mb-8 font-medium">
              Upstate New York
            </p>
            <h1 className="text-5xl md:text-8xl font-bold tracking-tight mb-8 leading-[0.95]">
              Drop it.<br />
              <span className="text-gray-500">We handle</span><br />
              <span className="text-gray-500">the rest.</span>
            </h1>
            <p className="text-xl text-gray-400 mb-12 max-w-lg mx-auto">
              Disposable vape and lithium battery recycling. Simple. Responsible. Free.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dropoff">
                <Button size="lg" className="bg-white text-black hover:bg-gray-100 text-base px-10 h-14 rounded-full font-semibold w-full sm:w-auto">
                  Find Your Drop-off <MapPin className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/business">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-base px-10 h-14 rounded-full w-full sm:w-auto">
                  Get Your Free Bin <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Floating Trust Badge */}
        <div className="absolute top-24 right-8 z-20 hidden lg:block">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white text-sm">
            <span className="text-green-400 mr-2">✓</span> Trusted by local businesses
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-white/60 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* Trust Belt */}
      <section className="py-4 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-8 text-sm text-gray-600">
            <span className="flex items-center gap-2">
              <span className="text-green-500">●</span> 100% Free
            </span>
            <span className="hidden md:inline text-gray-300">•</span>
            <span className="flex items-center gap-2">
              <span className="text-green-500">●</span> EPA-Compliant
            </span>
            <span className="hidden md:inline text-gray-300">•</span>
            <span className="flex items-center gap-2">
              <span className="text-green-500">●</span> Upstate NY
            </span>
          </div>
        </div>
      </section>

      {/* Visual Feature Section */}
      <section className="py-0 bg-black">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative h-[50vh] md:h-[70vh]">
            <img src={handsImage} alt="Recycling in action" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <h3 className="text-2xl font-bold mb-2">Takes 10 seconds</h3>
              <p className="text-gray-300">Drop your dead vape. Walk away guilt-free.</p>
            </div>
          </div>
          <div className="relative h-[50vh] md:h-[70vh]">
            <img src={binImage} alt="LITTR bin" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <h3 className="text-2xl font-bold mb-2">Partner locations</h3>
              <p className="text-gray-300">Bins at smoke shops across upstate NY.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works - Visual steps */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">How it works</p>
            <h2 className="text-4xl md:text-5xl font-bold">Three simple steps</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="relative h-64 mb-6 rounded-2xl overflow-hidden">
                <img src={vapesImage} alt="Collect" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="text-5xl font-bold text-gray-200 mb-2">01</div>
              <h3 className="text-xl font-semibold mb-2">Collect</h3>
              <p className="text-gray-500">Gather your dead disposables and small batteries.</p>
            </div>
            <div className="text-center">
              <div className="relative h-64 mb-6 rounded-2xl overflow-hidden">
                <img src={shopImage} alt="Drop" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="text-5xl font-bold text-gray-200 mb-2">02</div>
              <h3 className="text-xl font-semibold mb-2">Drop</h3>
              <p className="text-gray-500">Visit any partner location and use the LITTR bin.</p>
            </div>
            <div className="text-center">
              <div className="relative h-64 mb-6 rounded-2xl overflow-hidden">
                <img src={sustainImage} alt="Recycle" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div className="text-5xl font-bold text-gray-200 mb-2">03</div>
              <h3 className="text-xl font-semibold mb-2">Done</h3>
              <p className="text-gray-500">We handle safe transport and certified recycling.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Big visual stat section */}
      <section className="relative py-32 overflow-hidden">
        <img src={rochesterImage} alt="Rochester" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-black/70" />
        <div className="container mx-auto px-4 relative z-10 text-center text-white">
          <p className="text-sm uppercase tracking-widest text-gray-400 mb-6">The problem</p>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 max-w-3xl mx-auto leading-tight">
            Vape batteries in landfills cause <span className="text-red-400">300+ fires</span> per year.
          </h2>
          <p className="text-xl text-gray-400 max-w-xl mx-auto">
            Help us change that. One drop-off at a time.
          </p>
        </div>
      </section>

      {/* What we accept - Visual grid */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">What we accept</p>
            <h2 className="text-4xl font-bold">Bring us these</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer">
              <div className="h-32 mb-4 rounded-xl overflow-hidden">
                <img src={vapesImage} alt="Vapes" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-semibold">Disposable Vapes</h3>
              <p className="text-xs text-green-600 mt-1">Accepted</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer">
              <div className="h-32 mb-4 rounded-xl overflow-hidden">
                <img src={batteriesImage} alt="Batteries" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-semibold">Small Batteries</h3>
              <p className="text-xs text-green-600 mt-1">Accepted</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer">
              <div className="h-32 mb-4 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                <span className="text-4xl">🔋</span>
              </div>
              <h3 className="font-semibold">Phone Batteries</h3>
              <p className="text-xs text-green-600 mt-1">Accepted</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg opacity-60">
              <div className="h-32 mb-4 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                <span className="text-4xl">🚗</span>
              </div>
              <h3 className="font-semibold text-gray-500">EV Batteries</h3>
              <p className="text-xs text-red-500 mt-1">Not accepted</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial with image */}
      <section className="py-24 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div className="relative h-80 rounded-2xl overflow-hidden">
              <img src={shopImage} alt="Partner shop" className="w-full h-full object-cover" />
            </div>
            <div>
              <Quote className="h-10 w-10 mb-6 opacity-30" />
              <p className="text-2xl font-light leading-relaxed mb-6">
                I was so tired of sweeping up dead vapes from the parking lot every morning. Now customers just toss them in the bin on their way out.
              </p>
              <p className="text-gray-400">
                <span className="font-semibold text-white">Tino</span> — High End Smoke Shop
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Partner Locations with images */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Drop-off locations</p>
            <h2 className="text-4xl font-bold">Partner Shops</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="group cursor-pointer shadow-lg rounded-xl hover:scale-105 transition-transform duration-300">
              <div className="relative h-48 rounded-t-xl overflow-hidden">
                <img src={shopImage} alt="Elite Smoke Shop" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
              </div>
              <div className="p-4 bg-white rounded-b-xl">
                <h3 className="font-semibold text-lg">Elite Smoke Shop</h3>
                <p className="text-gray-400 text-sm">Rochester, NY</p>
              </div>
            </div>
            <div className="group cursor-pointer shadow-lg rounded-xl hover:scale-105 transition-transform duration-300">
              <div className="relative h-48 rounded-t-xl overflow-hidden">
                <img src={binImage} alt="High End Smoke Shop" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
              </div>
              <div className="p-4 bg-white rounded-b-xl">
                <h3 className="font-semibold text-lg">High End Smoke Shop</h3>
                <p className="text-gray-400 text-sm">Rochester, NY</p>
              </div>
            </div>
            <div className="group cursor-pointer shadow-lg rounded-xl hover:scale-105 transition-transform duration-300">
              <div className="relative h-48 rounded-t-xl overflow-hidden">
                <img src={shopImage} alt="Red Eye Smoke Shop" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
              </div>
              <div className="p-4 bg-white rounded-b-xl">
                <h3 className="font-semibold text-lg">Red Eye Smoke Shop</h3>
                <p className="text-gray-400 text-sm">Rochester, NY</p>
              </div>
            </div>
          </div>
          <div className="text-center mt-12">
            <Link href="/business">
              <Button size="lg" className="rounded-full px-10">Become a partner</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Value props strip */}
      <section className="py-16 bg-gray-50 border-y border-gray-200">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto text-center">
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-black text-white flex items-center justify-center mb-4">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mb-1">Safe Handling</h3>
              <p className="text-sm text-gray-500">Fire-safe containers and trained pickup crews.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-black text-white flex items-center justify-center mb-4">
                <Recycle className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mb-1">Certified Recycling</h3>
              <p className="text-sm text-gray-500">Materials go to EPA-compliant processors.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-black text-white flex items-center justify-center mb-4">
                <Truck className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mb-1">Free Pickup</h3>
              <p className="text-sm text-gray-500">Partners never pay for collection.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 overflow-hidden">
        <img src={macroImage} alt="Technology" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-black" style={{ opacity: 0.85 }} />
        <div className="container mx-auto px-4 text-center relative z-10 text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to recycle responsibly?</h2>
          <p className="text-xl text-gray-400 mb-10 max-w-md mx-auto">
            Find your nearest drop-off and do the right thing in 30 seconds.
          </p>
          <Link href="/dropoff">
            <Button size="lg" className="bg-white text-black hover:bg-gray-100 rounded-full px-12 h-16 text-lg font-semibold">
              Find a location <MapPin className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
