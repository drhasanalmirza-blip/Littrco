import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertTriangle, BatteryWarning, CheckCircle, MapPin, Phone } from "lucide-react";
import safetyImage from "@assets/generated_images/geometric_safety_abstract_3d_render.png";

export default function Dropoff() {
  return (
    <div className="min-h-screen bg-white">
      {/* Mobile-first Header */}
      <div className="bg-black text-white p-6 pt-12 pb-12 rounded-b-[2rem] shadow-xl text-center">
        <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-full mb-4">
          <CheckCircle className="h-8 w-8 text-green-400" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Recycle your disposable vape here.</h1>
        <p className="text-gray-300 mb-6">Safe. Responsible. Free.</p>
        
        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          <Link href="/locations">
            <Button size="lg" className="w-full bg-white text-black hover:bg-gray-200 font-bold h-12">
              <MapPin className="mr-2 h-4 w-4" /> Find Drop Location
            </Button>
          </Link>
          <a href="tel:+16073850725">
            <Button variant="outline" size="lg" className="w-full border-white/20 text-white hover:bg-white/10 h-12">
              <Phone className="mr-2 h-4 w-4" /> Call LITTR Support
            </Button>
          </a>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {/* Reassurance */}
        <div className="grid grid-cols-3 gap-2 text-center mb-12">
          <div className="p-4 bg-gray-50 rounded-xl">
            <span className="block text-2xl mb-1">🌱</span>
            <span className="text-xs font-bold text-gray-600">Safe Diversion</span>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <span className="block text-2xl mb-1">♻️</span>
            <span className="text-xs font-bold text-gray-600">Responsible</span>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <span className="block text-2xl mb-1">✨</span>
            <span className="text-xs font-bold text-gray-600">Guilt Free</span>
          </div>
        </div>

        {/* What to drop */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="h-6 w-1 bg-green-500 rounded-full"></span>
            What you CAN drop
          </h2>
          <ul className="space-y-3">
            <li className="flex items-center p-4 border border-gray-100 rounded-lg shadow-sm">
              <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
              <span className="font-medium">Disposable Vapes (Any brand)</span>
            </li>
            <li className="flex items-center p-4 border border-gray-100 rounded-lg shadow-sm">
              <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
              <span className="font-medium">Small Li-ion Batteries</span>
            </li>
            <li className="flex items-center p-4 border border-gray-100 rounded-lg shadow-sm">
              <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
              <span className="font-medium">Small Electronics (Earbuds, etc)</span>
            </li>
          </ul>
        </div>

        {/* What NOT to drop */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="h-6 w-1 bg-red-500 rounded-full"></span>
            What you CANNOT drop
          </h2>
          <div className="bg-red-50 border border-red-100 rounded-xl p-6">
            <ul className="space-y-3">
              <li className="flex items-start text-red-900">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                <span>Damaged, swollen, hot, or leaking batteries</span>
              </li>
              <li className="flex items-start text-red-900">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                <span>Large battery packs (&gt;2Ah)</span>
              </li>
              <li className="flex items-start text-red-900">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                <span>E-bike or Scooter batteries</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Safety Warning */}
        <div className="bg-gray-900 text-white rounded-xl p-6 relative overflow-hidden">
           <div className="absolute right-0 top-0 w-32 h-32 opacity-10">
              <img src={safetyImage} alt="" className="w-full h-full object-cover" />
           </div>
           <div className="relative z-10">
             <h3 className="font-bold flex items-center gap-2 mb-2 text-yellow-400">
               <BatteryWarning className="h-5 w-5" />
               Safety Warning
             </h3>
             <p className="text-sm text-gray-300 leading-relaxed mb-4">
               If your battery is damaged, hot, swollen, or leaking, <strong>DO NOT</strong> put it in a bin. It is a fire risk.
             </p>
             <p className="text-sm text-gray-300">
               Place it in a non-flammable container (like sand or a metal bucket) and contact your local Household Hazardous Waste program.
             </p>
           </div>
        </div>

        <div className="mt-12 text-center">
           <p className="text-gray-500 mb-4">Business owner?</p>
           <Link href="/business">
             <Button variant="link" className="text-black font-bold">Partner with us to host a bin</Button>
           </Link>
        </div>
      </div>
    </div>
  );
}
