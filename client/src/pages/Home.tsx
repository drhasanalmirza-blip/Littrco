import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Quote, Recycle, Shield, Truck } from "lucide-react";
import { Link } from "wouter";

import vapesImage from "@assets/generated_images/pixel_art_vapes_collection.png";
import binImage from "@assets/generated_images/pixel_art_littr_bin_interior.png";
import batteriesImage from "@assets/generated_images/pixel_art_batteries_pattern.png";
import rochesterImage from "@assets/generated_images/pixel_art_rochester_cityscape.png";
import heroActionImage from "@assets/generated_images/pixel_art_vape_drop_action.png";
import pickupVanImage from "@assets/generated_images/pixel_art_pickup_van_night.png";
import eliteShopImage from "@assets/generated_images/elite_smoke_shop_pixel_art.png";
import highEndShopImage from "@assets/generated_images/high_end_smoke_shop_pixel_art.png";
import redEyeShopImage from "@assets/generated_images/red_eye_smoke_shop_pixel_art.png";
import phoneBatteryImage from "@assets/generated_images/phone_battery_pixel_art.png";
import littrOneImage from "@/assets/images/littr-one-pixel.png";

export default function Home() {

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Hero background image - single visible image */}
        <div className="absolute inset-0">
          <img 
            src={heroActionImage} 
            alt="Vape being recycled" 
            className="w-full h-full object-cover opacity-60" 
            style={{ imageRendering: 'pixelated' }} 
          />
        </div>
        
        {/* Gradient overlay - lighter to show image better */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black z-10" />
        
        {/* Content */}
        <div className="container mx-auto px-4 relative z-20 pt-20">
          <div className="max-w-3xl mx-auto text-center text-white">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-400 mb-8 font-medium">
              Upstate New York
            </p>
            <h1 className="text-5xl md:text-8xl font-bold tracking-tight mb-8 leading-[0.95]">
              Drop it.<br />
              <span className="text-gray-500">We recycle</span><br />
              <span className="text-gray-500">the rest.</span>
            </h1>
            <p className="text-xl text-gray-400 mb-12 max-w-lg mx-auto">
              Free vape and battery recycling at local smoke shops. Fast, safe, and always free.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dropoff">
                <Button size="lg" className="bg-white text-black hover:bg-gray-100 text-base px-10 h-14 rounded-full font-semibold w-full sm:w-auto" data-testid="button-find-dropoff">
                  Find a Drop-off <MapPin className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/business">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-base px-10 h-14 rounded-full w-full sm:w-auto" data-testid="button-get-free-bin">
                  Get a Free Bin <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Floating Trust Badge */}
        <div className="absolute top-24 right-8 z-20 hidden lg:block">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white text-sm">
            <span className="text-green-400 mr-2">✓</span> Trusted by local shops
          </div>
        </div>
      </section>

      {/* Trust Belt */}
      <section className="py-4 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-8 text-sm text-gray-600">
            <span className="flex items-center gap-2">
              <span className="text-green-500">●</span> Always Free
            </span>
            <span className="hidden md:inline text-gray-300">•</span>
            <span className="flex items-center gap-2">
              <span className="text-green-500">●</span> EPA-Compliant
            </span>
            <span className="hidden md:inline text-gray-300">•</span>
            <span className="flex items-center gap-2">
              <span className="text-green-500">●</span> Serving Upstate NY
            </span>
          </div>
        </div>
      </section>

      {/* Visual Feature Section */}
      <section className="py-0 bg-black">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative h-[50vh] md:h-[70vh]">
            <img src={heroActionImage} alt="Drop your vape in seconds" className="w-full h-full object-cover" loading="lazy" style={{ imageRendering: 'pixelated' }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <h3 className="text-2xl font-bold mb-2">Done in 10 Seconds</h3>
              <p className="text-gray-300">Drop your dead vape. Walk away knowing you did the right thing.</p>
            </div>
          </div>
          <div className="relative h-[50vh] md:h-[70vh]">
            <img src={binImage} alt="LITTR recycling bin" className="w-full h-full object-cover" loading="lazy" style={{ imageRendering: 'pixelated' }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <h3 className="text-2xl font-bold mb-2">Bins Near You</h3>
              <p className="text-gray-300">Find our fire-safe bins at partner smoke shops across Upstate NY.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works - Visual steps */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">How it works</p>
            <h2 className="text-4xl md:text-5xl font-bold">Three Easy Steps</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="relative h-64 mb-6 rounded-2xl overflow-hidden">
                <img src={vapesImage} alt="Collect your dead vapes" className="w-full h-full object-cover" loading="lazy" style={{ imageRendering: 'pixelated' }} />
              </div>
              <div className="text-5xl font-bold text-gray-200 mb-2">01</div>
              <h3 className="text-xl font-semibold mb-2">Collect</h3>
              <p className="text-gray-500">Gather your dead disposable vapes and small lithium batteries.</p>
            </div>
            <div className="text-center">
              <div className="relative h-64 mb-6 rounded-2xl overflow-hidden">
                <img src={eliteShopImage} alt="Visit a partner location" className="w-full h-full object-cover" loading="lazy" style={{ imageRendering: 'pixelated' }} />
              </div>
              <div className="text-5xl font-bold text-gray-200 mb-2">02</div>
              <h3 className="text-xl font-semibold mb-2">Drop</h3>
              <p className="text-gray-500">Stop by any partner shop and drop them in the LITTR bin.</p>
            </div>
            <div className="text-center">
              <div className="relative h-64 mb-6 rounded-2xl overflow-hidden">
                <img src={pickupVanImage} alt="We handle the rest" className="w-full h-full object-cover" loading="lazy" style={{ imageRendering: 'pixelated' }} />
              </div>
              <div className="text-5xl font-bold text-gray-200 mb-2">03</div>
              <h3 className="text-xl font-semibold mb-2">Done</h3>
              <p className="text-gray-500">We pick up and recycle everything safely. That's it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Big visual stat section */}
      <section className="relative py-32 overflow-hidden">
        <img src={rochesterImage} alt="Rochester cityscape" className="absolute inset-0 w-full h-full object-cover" loading="lazy" style={{ imageRendering: 'pixelated' }} />
        <div className="absolute inset-0 bg-black/70" />
        <div className="container mx-auto px-4 relative z-10 text-center text-white">
          <p className="text-sm uppercase tracking-widest text-gray-400 mb-6">The problem we're solving</p>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 max-w-3xl mx-auto leading-tight">
            Vape batteries cause <span className="text-red-400">300+ landfill fires</span> every year.
          </h2>
          <p className="text-xl text-gray-400 max-w-xl mx-auto">
            Together, we can stop this. One drop-off at a time.
          </p>
        </div>
      </section>

      {/* What we accept - Visual grid */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">What we accept</p>
            <h2 className="text-4xl font-bold">Drop These Off</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer">
              <div className="h-32 mb-4 rounded-xl overflow-hidden">
                <img src={vapesImage} alt="Disposable vapes" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
              </div>
              <h3 className="font-semibold">Disposable Vapes</h3>
              <p className="text-xs text-green-600 mt-1">Accepted</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer">
              <div className="h-32 mb-4 rounded-xl overflow-hidden">
                <img src={batteriesImage} alt="Small batteries" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
              </div>
              <h3 className="font-semibold">Small Batteries</h3>
              <p className="text-xs text-green-600 mt-1">Accepted</p>
            </div>
            <div className="bg-white rounded-2xl p-6 text-center shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer">
              <div className="h-32 mb-4 rounded-xl overflow-hidden">
                <img src={phoneBatteryImage} alt="Phone batteries" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
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

      {/* LITTR One Product Teaser */}
      <section className="py-20 bg-black" data-testid="section-littr-one-teaser">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="relative bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-3xl overflow-hidden border border-zinc-700">
              <div className="absolute top-4 right-4 bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-full z-10" data-testid="badge-now-available">
                NOW AVAILABLE
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
                <div className="flex justify-center order-2 md:order-1">
                  <img 
                    src={littrOneImage} 
                    alt="LITTR One Smart Bin" 
                    className="w-48 h-48 md:w-64 md:h-64 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <div className="order-1 md:order-2 text-center md:text-left">
                  <p className="text-sm uppercase tracking-widest text-green-500 mb-2">Introducing</p>
                  <h3 className="text-3xl md:text-4xl font-bold text-white mb-4" data-testid="heading-littr-one-home">The LITTR One</h3>
                  <p className="text-gray-400 mb-6">
                    Smart recycling bin with temperature sensors, VOC monitoring, fill detection, and instant QR rewards. WiFi-enabled for real-time alerts.
                  </p>
                  <div className="mb-6">
                    <span className="text-gray-500 line-through" data-testid="text-price-original-home">$459.95</span>
                    <span className="text-3xl font-bold text-green-500 ml-2" data-testid="text-price-discounted-home">$169.95</span>
                    <span className="text-xs text-gray-500 block mt-1">Subsidized partner pricing</span>
                  </div>
                  <Link href="/why">
                    <Button className="bg-green-500 hover:bg-green-600 text-black font-semibold rounded-full px-8" data-testid="button-learn-littr-one">
                      Learn More <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial with image */}
      <section className="py-24 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div className="relative h-80 rounded-2xl overflow-hidden">
              <img src={highEndShopImage} alt="Partner smoke shop at night" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
            </div>
            <div>
              <Quote className="h-10 w-10 mb-6 opacity-30" />
              <p className="text-2xl font-light leading-relaxed mb-6">
                "I used to find dead vapes all over the parking lot every morning. Now customers just drop them in the bin on their way out. Problem solved."
              </p>
              <p className="text-gray-400">
                <span className="font-semibold text-white">Tino</span> — High End Smoke Shop, Rochester
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
            <h2 className="text-4xl font-bold">Find a Partner Shop</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="group cursor-pointer shadow-lg rounded-xl hover:scale-105 transition-transform duration-300">
              <div className="relative h-48 rounded-t-xl overflow-hidden">
                <img src={eliteShopImage} alt="Elite Smoke Shop" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
              </div>
              <div className="p-4 bg-white rounded-b-xl">
                <h3 className="font-semibold text-lg">Elite Smoke Shop</h3>
                <p className="text-gray-400 text-sm">Rochester, NY</p>
              </div>
            </div>
            <div className="group cursor-pointer shadow-lg rounded-xl hover:scale-105 transition-transform duration-300">
              <div className="relative h-48 rounded-t-xl overflow-hidden">
                <img src={highEndShopImage} alt="High End Smoke Shop" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
              </div>
              <div className="p-4 bg-white rounded-b-xl">
                <h3 className="font-semibold text-lg">High End Smoke Shop</h3>
                <p className="text-gray-400 text-sm">Rochester, NY</p>
              </div>
            </div>
            <div className="group cursor-pointer shadow-lg rounded-xl hover:scale-105 transition-transform duration-300">
              <div className="relative h-48 rounded-t-xl overflow-hidden">
                <img src={redEyeShopImage} alt="Red Eye Smoke Shop" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
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
              <Button size="lg" className="rounded-full px-10" data-testid="button-become-partner">Become a Partner Today</Button>
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
              <p className="text-sm text-gray-500">Fire-safe containers and trained pickup crews keep everyone safe.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-black text-white flex items-center justify-center mb-4">
                <Recycle className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mb-1">Certified Recycling</h3>
              <p className="text-sm text-gray-500">All materials go to EPA-compliant processing facilities.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-black text-white flex items-center justify-center mb-4">
                <Truck className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mb-1">Free Pickup</h3>
              <p className="text-sm text-gray-500">Partners never pay a dime for bin collection or service.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 overflow-hidden">
        <img src={batteriesImage} alt="Battery pattern" className="absolute inset-0 w-full h-full object-cover opacity-20" style={{ imageRendering: 'pixelated' }} />
        <div className="absolute inset-0 bg-black" style={{ opacity: 0.85 }} />
        <div className="container mx-auto px-4 text-center relative z-10 text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Make Your Next Drop Count</h2>
          <p className="text-xl text-gray-400 mb-10 max-w-md mx-auto">
            Find your nearest location and recycle responsibly in under 30 seconds.
          </p>
          <Link href="/dropoff">
            <Button size="lg" className="bg-white text-black hover:bg-gray-100 rounded-full px-12 h-16 text-lg font-semibold" data-testid="button-find-location-cta">
              Find a Location <MapPin className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
