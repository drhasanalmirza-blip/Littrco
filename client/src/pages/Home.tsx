import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, Quote } from "lucide-react";
import { Link } from "wouter";
import heroImage from "@assets/generated_images/minimalist_white_recycling_bin_in_modern_space.png";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section - Full screen visual */}
      <section className="relative min-h-[90vh] flex items-center bg-black text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImage} 
            alt="Modern recycling bin" 
            className="w-full h-full object-cover opacity-40"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-0" />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-400 mb-6 font-medium">
              Rochester, NY
            </p>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
              Drop it.<br />
              We handle<br />
              the rest.
            </h1>
            <p className="text-xl text-gray-400 mb-10 leading-relaxed max-w-md">
              Disposable vape and lithium battery recycling made simple.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/dropoff">
                <Button size="lg" className="bg-white text-black hover:bg-gray-100 text-base px-8 h-14 rounded-full font-semibold">
                  Find a drop-off <MapPin className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/business">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-base px-8 h-14 rounded-full">
                  I'm a business <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-white/50 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* Simple value props */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto text-center">
            <div>
              <div className="text-4xl font-bold mb-2">01</div>
              <h3 className="text-lg font-semibold mb-2">Drop</h3>
              <p className="text-gray-500 text-sm">Bring your dead vapes or batteries to any partner location.</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">02</div>
              <h3 className="text-lg font-semibold mb-2">We Collect</h3>
              <p className="text-gray-500 text-sm">Our team safely picks up and transports hazardous materials.</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">03</div>
              <h3 className="text-lg font-semibold mb-2">Recycled</h3>
              <p className="text-gray-500 text-sm">Metals are recovered. Nothing goes to landfill.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why it matters - visual section */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Why it matters</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 leading-tight">
              Lithium batteries in garbage trucks<br />
              <span className="text-gray-400">can start fires.</span>
            </h2>
            <p className="text-gray-500 text-lg mb-8 max-w-xl mx-auto">
              Proper disposal protects sanitation workers and keeps toxic chemicals out of our water.
            </p>
            <Link href="/faq">
              <Button variant="outline" className="rounded-full">Learn more</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonial - subtle integration */}
      <section className="py-20 bg-black text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Quote className="h-8 w-8 mx-auto mb-6 opacity-30" />
            <p className="text-xl md:text-2xl font-light leading-relaxed mb-6">
              I was so tired of sweeping up dead vapes from the parking lot every morning. Now customers just toss them in the bin on their way out.
            </p>
            <p className="text-gray-400">
              <span className="font-semibold text-white">Tino</span> — High End Smoke Shop
            </p>
          </div>
        </div>
      </section>

      {/* Partner Locations - clean grid */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-4">Drop-off locations</p>
            <h2 className="text-3xl font-bold">Partner Shops</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="border border-gray-200 p-6 rounded-xl text-center hover:border-black transition-colors">
              <h3 className="font-semibold">Elite Smoke Shop</h3>
              <p className="text-gray-400 text-sm mt-1">Rochester, NY</p>
            </div>
            <div className="border border-gray-200 p-6 rounded-xl text-center hover:border-black transition-colors">
              <h3 className="font-semibold">High End Smoke Shop</h3>
              <p className="text-gray-400 text-sm mt-1">Rochester, NY</p>
            </div>
            <div className="border border-gray-200 p-6 rounded-xl text-center hover:border-black transition-colors">
              <h3 className="font-semibold">Red Eye Smoke Shop</h3>
              <p className="text-gray-400 text-sm mt-1">Rochester, NY</p>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link href="/business">
              <Button className="rounded-full">Become a partner</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gray-50 border-t border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to recycle responsibly?</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">Find your nearest drop-off location and do the right thing in 30 seconds.</p>
          <Link href="/dropoff">
            <Button size="lg" className="rounded-full px-10 h-14 text-base font-semibold">
              Find a location <MapPin className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
