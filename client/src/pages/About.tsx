import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Heart, MapPin, Recycle, Shield } from "lucide-react";

import rochesterImage from "@assets/generated_images/rochester_ny_cityscape.png";
import sustainImage from "@assets/generated_images/e-waste_sustainability_concept.png";
import handsImage from "@assets/generated_images/hands_dropping_vape_in_bin.png";
import macroImage from "@assets/generated_images/abstract_battery_macro.png";

export default function About() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={rochesterImage} alt="Rochester, NY" className="w-full h-full object-cover opacity-50" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/70 to-black" />
        
        <div className="container mx-auto px-4 relative z-10 text-center text-white py-20">
          <p className="text-sm uppercase tracking-widest text-gray-400 mb-6">Our Story</p>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 max-w-3xl mx-auto leading-tight">
            Born in Rochester.<br />
            <span className="text-gray-400">Built for a cleaner future.</span>
          </h1>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-8">Our Mission</h2>
            <p className="text-xl text-gray-600 leading-relaxed">
              LITTR exists to stop lithium-ion batteries from burning down garbage trucks and poisoning our landfills. We make responsible disposal as easy as buying a new device.
            </p>
          </div>
        </div>
      </section>

      {/* Visual Story Grid */}
      <section className="bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative h-96">
            <img src={sustainImage} alt="Sustainability" className="w-full h-full object-cover" />
          </div>
          <div className="flex items-center p-12 md:p-16">
            <div>
              <h3 className="text-2xl font-bold mb-4">The Problem</h3>
              <p className="text-gray-600 leading-relaxed">
                Disposable vapes created a massive new waste stream that traditional recycling wasn't built to handle. These devices contain plastic, copper, lithium, and chemical residue—all in one sealed unit. When thrown in the trash, they become fire hazards.
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="flex items-center p-12 md:p-16 order-2 md:order-1">
            <div>
              <h3 className="text-2xl font-bold mb-4">Our Solution</h3>
              <p className="text-gray-600 leading-relaxed">
                We're building a network of local drop-off points at smoke shops across Rochester. Free bins for businesses. Free drop-offs for consumers. Safe collection. Certified recycling. No excuses.
              </p>
            </div>
          </div>
          <div className="relative h-96 order-1 md:order-2">
            <img src={handsImage} alt="Solution" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">What we believe</p>
            <h2 className="text-3xl md:text-4xl font-bold">Our Values</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Shield className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">Safety</h3>
              <p className="text-gray-400 text-sm">Lithium batteries demand respect. We handle them properly.</p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Recycle className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">Transparency</h3>
              <p className="text-gray-400 text-sm">No greenwashing. We tell you exactly what happens to your waste.</p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Heart className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">Simplicity</h3>
              <p className="text-gray-400 text-sm">If it's hard to recycle, people won't. We remove the friction.</p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <MapPin className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-lg mb-2">Local First</h3>
              <p className="text-gray-400 text-sm">We're starting in Rochester. Our community. Our responsibility.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team/Local Focus */}
      <section className="relative py-32 overflow-hidden">
        <img src={macroImage} alt="Technology" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-white" style={{ opacity: 0.9 }} />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">We're not a giant corporation.</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            We're a small team of locals who saw a problem and decided to fix it. One bin at a time. One shop at a time. One neighborhood at a time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/business">
              <Button size="lg" className="rounded-full px-10">Become a Partner <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="rounded-full px-10">Get in Touch</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-black text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400 mb-4">Ready to make a difference?</p>
          <h2 className="text-3xl font-bold mb-8">Find a drop-off location near you.</h2>
          <Link href="/dropoff">
            <Button size="lg" className="bg-white text-black hover:bg-gray-100 rounded-full px-12 font-semibold">
              Find Location <MapPin className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
