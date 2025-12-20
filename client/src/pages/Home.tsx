import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Battery, MapPin, Recycle, ShieldCheck, Trash2 } from "lucide-react";
import { Link } from "wouter";
import heroImage from "@assets/generated_images/minimalist_white_recycling_bin_in_modern_space.png";
import processImage from "@assets/generated_images/abstract_battery_recycling_process_close_up.png";
import safetyImage from "@assets/generated_images/geometric_safety_abstract_3d_render.png";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center bg-black text-white overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-60">
          <img 
            src={heroImage} 
            alt="Modern recycling bin" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30 z-0" />
        
        <div className="container mx-auto px-4 relative z-10 pt-20">
          <div className="max-w-3xl animate-in slide-in-from-bottom-5 duration-700 fade-in">
            <div className="inline-block border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium mb-6">
              Reimagining E-Waste in Rochester, NY
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
              The end of the line <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500">
                for disposable vapes.
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl leading-relaxed">
              We recover lithium-ion batteries and screens from disposable devices. 
              Responsibly. Transparently. Guilt-free.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/business">
                <Button size="lg" className="bg-white text-black hover:bg-gray-200 text-lg px-8 h-14 rounded-full font-bold">
                  Request a LITTR Bin <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/dropoff">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 hover:text-white text-lg px-8 h-14 rounded-full font-medium">
                  Where can I drop off? <MapPin className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Credibility Strip */}
      <section className="bg-black border-b border-gray-800 py-12 text-white">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-full">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Safety First</h3>
              <p className="text-sm text-gray-400">Rigorous handling protocols for Li-ion safety.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-full">
              <Recycle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Responsible Recovery</h3>
              <p className="text-sm text-gray-400">Diverting hazardous waste from landfills.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-full">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Local Impact</h3>
              <p className="text-sm text-gray-400">Focused on cleaning up Rochester, NY.</p>
            </div>
          </div>
        </div>
      </section>

      {/* What We Collect */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">What we collect</h2>
            <p className="text-gray-500 text-lg">Specifically designed for the modern waste stream.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-8">
                <div className="h-12 w-12 bg-black rounded-xl flex items-center justify-center mb-6">
                  <Trash2 className="text-white h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Disposable Vapes</h3>
                <p className="text-gray-500 mb-4">Any brand, any condition (unless damaged/leaking). We separate the battery and components.</p>
                <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span> Accepted
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-8">
                <div className="h-12 w-12 bg-black rounded-xl flex items-center justify-center mb-6">
                  <Battery className="text-white h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Small Li-ion Batteries</h3>
                <p className="text-gray-500 mb-4">Rechargeable batteries from small electronics, phones, and wearables.</p>
                <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span> Accepted
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 border-dashed border-gray-200 opacity-75">
              <CardContent className="p-8">
                <div className="h-12 w-12 bg-gray-100 rounded-xl flex items-center justify-center mb-6">
                  <XIcon className="text-gray-400 h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-gray-500">Not Accepted</h3>
                <p className="text-gray-400 mb-4">Swollen batteries, leaking devices, large EV batteries, or industrial waste.</p>
                <div className="flex items-center gap-2 text-sm font-medium text-red-500">
                  <span className="h-2 w-2 rounded-full bg-red-500"></span> Do not drop
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-24 bg-black text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-20 pointer-events-none hidden md:block">
           <img src={processImage} className="h-full w-full object-cover grayscale" alt="Process" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-bold mb-12 tracking-tight">What happens after drop-off?</h2>
            
            <div className="space-y-12">
              <div className="flex gap-6">
                <div className="flex-shrink-0 h-12 w-12 rounded-full border border-white/20 flex items-center justify-center font-mono text-xl">01</div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Collection & Transport</h3>
                  <p className="text-gray-400 leading-relaxed">Bins are collected by our trained team using safety-compliant containers to prevent fire risks during transport.</p>
                </div>
              </div>
              
              <div className="flex gap-6">
                <div className="flex-shrink-0 h-12 w-12 rounded-full border border-white/20 flex items-center justify-center font-mono text-xl">02</div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Sorting & Assessment</h3>
                  <p className="text-gray-400 leading-relaxed">Items are inspected. Batteries are carefully identified and prepared for the appropriate recycling stream.</p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 h-12 w-12 rounded-full border border-white/20 flex items-center justify-center font-mono text-xl">03</div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Material Recovery</h3>
                  <p className="text-gray-400 leading-relaxed">Batteries are sent to certified processors where critical metals (Cobalt, Lithium, Nickel) are recovered for reuse.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Risk / Info Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100 flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-6">Why does this matter?</h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  Disposable vapes contain lithium-ion batteries that are <span className="text-black font-semibold">fire hazards</span> in standard trash trucks and landfills.
                </p>
                <p>
                  When crushed in a garbage truck, these batteries can ignite. By separating them, you protect sanitation workers and keep toxic chemicals out of our soil and water.
                </p>
              </div>
              <Link href="/dropoff">
                <Button className="mt-8" variant="default">Find a drop-off location</Button>
              </Link>
            </div>
            <div className="flex-1 bg-gray-100 rounded-2xl h-64 w-full flex items-center justify-center overflow-hidden relative">
              <img src={safetyImage} alt="Safety Illustration" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Placeholder */}
      <section className="py-20 border-t border-gray-100">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-8">Partnering with local businesses</p>
          <div className="flex justify-center gap-8 opacity-50 grayscale">
            {/* Placeholders for partner logos */}
            <div className="h-12 w-32 bg-gray-200 rounded"></div>
            <div className="h-12 w-32 bg-gray-200 rounded"></div>
            <div className="h-12 w-32 bg-gray-200 rounded"></div>
            <div className="h-12 w-32 bg-gray-200 rounded"></div>
          </div>
          <div className="mt-12 p-8 bg-gray-50 rounded-2xl max-w-2xl mx-auto italic text-gray-600">
            "Finally, a simple way to deal with the disposable vapes we find in our parking lot. LITTR made it easy."
            <div className="mt-4 not-italic font-semibold text-black">- Local Business Owner</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function XIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
