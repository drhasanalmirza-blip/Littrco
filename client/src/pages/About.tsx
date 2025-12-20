import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Heart, MapPin, Recycle, Shield } from "lucide-react";

import cityscapeImage from "@assets/generated_images/pixel_art_rochester_cityscape.png";
import pickupVanImage from "@assets/generated_images/pixel_art_pickup_van_night.png";
import binInteriorImage from "@assets/generated_images/pixel_art_littr_bin_interior.png";
import vapesImage from "@assets/generated_images/pixel_art_vapes_collection.png";

export default function About() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={cityscapeImage} alt="Rochester, NY pixel art cityscape" className="w-full h-full object-cover opacity-60" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black" />
        
        <div className="container mx-auto px-4 relative z-10 text-center text-white py-20">
          <p className="text-sm uppercase tracking-widest text-gray-400 mb-6">Our Story</p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 max-w-3xl mx-auto leading-tight">
            Born in Rochester.<br />
            <span className="text-gray-400">Building a cleaner tomorrow.</span>
          </h1>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-24 bg-zinc-950">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-white">Our Mission</h2>
            <p className="text-xl text-gray-300 leading-relaxed">
              Every year, millions of disposable vapes end up in landfills—leaking toxic chemicals, sparking fires in garbage trucks, and poisoning our soil. LITTR exists to end this crisis. We make responsible disposal effortless, because protecting our planet shouldn't be complicated.
            </p>
          </div>
        </div>
      </section>

      {/* Visual Story Grid */}
      <section className="bg-zinc-900">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative h-96">
            <img src={vapesImage} alt="Collection of disposable vapes" className="w-full h-full object-cover" loading="lazy" />
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
            <img src={binInteriorImage} alt="Inside a LITTR collection bin" className="w-full h-full object-cover" loading="lazy" />
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
          <img src={pickupVanImage} alt="LITTR pickup van at night" className="w-full h-full object-cover opacity-40" />
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
