import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertTriangle, BatteryWarning, CheckCircle, MapPin, Phone, Sparkles } from "lucide-react";

import smokeShopImage from "@assets/generated_images/pixel_art_smoke_shop_night.png";
import binInteriorImage from "@assets/generated_images/pixel_art_littr_bin_interior.png";
import handDroppingImage from "@assets/generated_images/pixel_art_hand_dropping_vape.png";
import shopDoorsImage from "@assets/generated_images/pixel_art_shop_exit_doors.png";

export default function Dropoff() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero with visual */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={handDroppingImage} alt="Drop off your vape responsibly" className="w-full h-full object-cover opacity-50" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black" />
        
        <div className="container mx-auto px-4 relative z-10 text-center text-white py-20">
          <div className="inline-flex items-center justify-center p-4 bg-white/10 backdrop-blur-sm rounded-full mb-6">
            <Sparkles className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Ready to Recycle?</h1>
          <p className="text-xl text-gray-300 mb-10 max-w-lg mx-auto">
            Drop off your vapes in just 10 seconds. It's free, easy, and helps keep our community safe.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
            <Link href="/locations">
              <Button size="lg" className="w-full bg-white text-black hover:bg-gray-100 font-semibold h-14 rounded-full" data-testid="button-find-location">
                <MapPin className="mr-2 h-5 w-5" /> Find a Location
              </Button>
            </Link>
            <a href="tel:+16073850725" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full border-white/30 text-white hover:bg-white/10 h-14 rounded-full" data-testid="button-call-us">
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
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-2">Buffalo • Rochester • Syracuse</p>
            <h2 className="text-3xl font-bold">Convenient Drop-off Locations</h2>
            <p className="text-gray-500 mt-2">Stop by any of our partner shops near you</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="group" data-testid="card-location-elite">
              <div className="relative h-48 rounded-xl overflow-hidden mb-4">
                <img src={smokeShopImage} alt="Elite Smoke Shop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-4 left-4 text-white">
                  <MapPin className="h-5 w-5" />
                </div>
              </div>
              <h3 className="font-semibold text-lg">Elite Smoke Shop</h3>
              <p className="text-gray-500 text-sm">Rochester, NY</p>
            </div>
            <div className="group" data-testid="card-location-highend">
              <div className="relative h-48 rounded-xl overflow-hidden mb-4">
                <img src={binInteriorImage} alt="High End Smoke Shop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-4 left-4 text-white">
                  <MapPin className="h-5 w-5" />
                </div>
              </div>
              <h3 className="font-semibold text-lg">High End Smoke Shop</h3>
              <p className="text-gray-500 text-sm">Rochester, NY</p>
            </div>
            <div className="group" data-testid="card-location-redeye">
              <div className="relative h-48 rounded-xl overflow-hidden mb-4">
                <img src={shopDoorsImage} alt="Red Eye Smoke Shop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
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
            <h2 className="text-3xl font-bold mb-2">What You Can Bring</h2>
            <p className="text-gray-500">We accept these items at all locations—no appointment needed</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm" data-testid="card-item-vapes">
              <div className="h-40 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                <span className="text-5xl">💨</span>
              </div>
              <div className="p-4 text-center">
                <h3 className="font-semibold">Disposable Vapes</h3>
                <p className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Accepted
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm" data-testid="card-item-batteries">
              <div className="h-40 bg-gradient-to-br from-green-100 to-teal-100 flex items-center justify-center">
                <span className="text-5xl">🔋</span>
              </div>
              <div className="p-4 text-center">
                <h3 className="font-semibold">Li-ion Batteries</h3>
                <p className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Accepted
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm" data-testid="card-item-electronics">
              <div className="h-40 bg-gradient-to-br from-orange-100 to-yellow-100 flex items-center justify-center">
                <span className="text-5xl">🎧</span>
              </div>
              <div className="p-4 text-center">
                <h3 className="font-semibold">Small Electronics</h3>
                <p className="text-xs text-green-600 mt-1 flex items-center justify-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Accepted
                </p>
              </div>
            </div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm opacity-60" data-testid="card-item-ev">
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
      <section className="py-20 bg-amber-600 text-white relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl mx-auto text-center">
            <BatteryWarning className="h-12 w-12 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">A Quick Safety Note</h2>
            <p className="text-xl text-amber-100 mb-6">
              If your battery looks damaged, feels hot, appears swollen, or is leaking, please <strong>don't place it in a bin</strong>.
            </p>
            <p className="text-amber-200">
              Instead, put it in a non-flammable container and contact your local Household Hazardous Waste program. We're happy to help you find the right resource.
            </p>
          </div>
        </div>
      </section>

      {/* Business CTA */}
      <section className="py-20 bg-black text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Own a Smoke Shop or Retail Store?</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Join our growing network of partners. We'll provide a free LITTR bin, handle all pickups, and help your customers recycle responsibly.
          </p>
          <Link href="/business">
            <Button size="lg" className="bg-white text-black hover:bg-gray-100 rounded-full px-10 font-semibold" data-testid="button-become-partner">
              Become a Partner Today
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
