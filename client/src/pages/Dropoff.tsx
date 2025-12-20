import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertTriangle, BatteryWarning, CheckCircle, MapPin, Phone } from "lucide-react";

import binImage from "@assets/generated_images/littr_bin_in_smoke_shop.png";
import vapesImage from "@assets/generated_images/disposable_vapes_product_shot.png";
import batteriesImage from "@assets/generated_images/batteries_aerial_pattern.png";
import handsImage from "@assets/generated_images/hands_dropping_vape_in_bin.png";
import shopImage from "@assets/generated_images/smoke_shop_storefront_night.png";

export default function Dropoff() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero with visual */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={handsImage} alt="Recycling" className="w-full h-full object-cover opacity-40" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black" />
        
        <div className="container mx-auto px-4 relative z-10 text-center text-white py-20">
          <div className="inline-flex items-center justify-center p-4 bg-white/10 backdrop-blur-sm rounded-full mb-6">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Drop off your vapes here.</h1>
          <p className="text-xl text-gray-300 mb-10 max-w-lg mx-auto">Safe. Responsible. Free. Takes 10 seconds.</p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <Link href="/locations">
              <Button size="lg" className="w-full bg-white text-black hover:bg-gray-100 font-semibold h-14 rounded-full">
                <MapPin className="mr-2 h-5 w-5" /> Find Location
              </Button>
            </Link>
            <a href="tel:+16073850725" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full border-white/30 text-white hover:bg-white/10 h-14 rounded-full">
                <Phone className="mr-2 h-5 w-5" /> Call Us
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Partner Locations Visual Grid */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-2">Rochester, NY</p>
            <h2 className="text-3xl font-bold">Drop-off Locations</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="group">
              <div className="relative h-48 rounded-xl overflow-hidden mb-4">
                <img src={shopImage} alt="Elite Smoke Shop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-4 left-4 text-white">
                  <MapPin className="h-5 w-5" />
                </div>
              </div>
              <h3 className="font-semibold text-lg">Elite Smoke Shop</h3>
              <p className="text-gray-500 text-sm">Rochester, NY</p>
            </div>
            <div className="group">
              <div className="relative h-48 rounded-xl overflow-hidden mb-4">
                <img src={binImage} alt="High End Smoke Shop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-4 left-4 text-white">
                  <MapPin className="h-5 w-5" />
                </div>
              </div>
              <h3 className="font-semibold text-lg">High End Smoke Shop</h3>
              <p className="text-gray-500 text-sm">Rochester, NY</p>
            </div>
            <div className="group">
              <div className="relative h-48 rounded-xl overflow-hidden mb-4">
                <img src={shopImage} alt="Red Eye Smoke Shop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-4 left-4 text-white">
                  <MapPin className="h-5 w-5" />
                </div>
              </div>
              <h3 className="font-semibold text-lg">Red Eye Smoke Shop</h3>
              <p className="text-gray-500 text-sm">Rochester, NY</p>
            </div>
          </div>
        </div>
      </section>

      {/* What to bring - Visual cards */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-2">What to bring</h2>
            <p className="text-gray-500">We accept these items at all locations</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="h-40">
                <img src={vapesImage} alt="Vapes" className="w-full h-full object-cover" />
              </div>
              <div className="p-4 text-center">
                <h3 className="font-semibold">Disposable Vapes</h3>
                <p className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Accepted
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="h-40">
                <img src={batteriesImage} alt="Batteries" className="w-full h-full object-cover" />
              </div>
              <div className="p-4 text-center">
                <h3 className="font-semibold">Li-ion Batteries</h3>
                <p className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Accepted
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="h-40 bg-gray-100 flex items-center justify-center">
                <span className="text-5xl">🎧</span>
              </div>
              <div className="p-4 text-center">
                <h3 className="font-semibold">Small Electronics</h3>
                <p className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Accepted
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm opacity-60">
              <div className="h-40 bg-gray-100 flex items-center justify-center">
                <span className="text-5xl">🚗</span>
              </div>
              <div className="p-4 text-center">
                <h3 className="font-semibold text-gray-500">EV Batteries</h3>
                <p className="text-xs text-red-500 mt-1 flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Not accepted
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Safety Warning - Visual */}
      <section className="py-20 bg-red-600 text-white relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <BatteryWarning className="h-12 w-12 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Safety First</h2>
            <p className="text-xl text-red-100 mb-6">
              If your battery is damaged, hot, swollen, or leaking — <strong>DO NOT</strong> put it in a bin.
            </p>
            <p className="text-red-200">
              Place it in a non-flammable container and contact your local Household Hazardous Waste program.
            </p>
          </div>
        </div>
      </section>

      {/* Business CTA */}
      <section className="py-20 bg-black text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Own a shop?</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Get a free LITTR bin for your location. We handle everything.
          </p>
          <Link href="/business">
            <Button size="lg" className="bg-white text-black hover:bg-gray-100 rounded-full px-10 font-semibold">
              Become a Partner
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
