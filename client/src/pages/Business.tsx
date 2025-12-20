import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Quote, Store, Truck } from "lucide-react";

import smokeShopNightImage from "@assets/generated_images/pixel_art_smoke_shop_night.png";
import binInteriorImage from "@assets/generated_images/pixel_art_littr_bin_interior.png";
import pickupVanImage from "@assets/generated_images/pixel_art_pickup_van_night.png";
import shopExitDoorsImage from "@assets/generated_images/pixel_art_shop_exit_doors.png";

const formSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  contactPerson: z.string().min(2, "Contact person is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Valid phone number is required"),
  address: z.string().min(5, "Address is required"),
  volume: z.string().min(1, "Please estimate volume"),
});

export default function Business() {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      businessName: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      volume: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const response = await fetch('/api/bin-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) throw new Error('Failed to submit');
      
      toast({
        title: "You're In!",
        description: "We'll reach out within 48 hours to schedule your free bin delivery.",
      });
      form.reset();
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero with image */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={smokeShopNightImage} alt="Smoke shop storefront at night" className="w-full h-full object-cover opacity-50" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
        
        <div className="container mx-auto px-4 relative z-10 py-20">
          <div className="max-w-2xl text-white">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-6">For Smoke Shops & Retailers</p>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Dead vapes everywhere?<br />We'll handle it.
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              FREE bin. FREE pickup. ZERO hassle. Your customers get a responsible way to dispose, and you get a cleaner shop.
            </p>
            <div className="inline-block border border-white/30 px-6 py-3 rounded-full bg-white/5 backdrop-blur-sm">
              <span className="font-semibold">100% free for partners — no strings attached</span>
            </div>
          </div>
        </div>
      </section>

      {/* Visual benefits */}
      <section className="py-0 bg-black">
        <div className="grid grid-cols-1 md:grid-cols-3">
          <div className="relative h-64 md:h-80">
            <img src={shopExitDoorsImage} alt="Shop interior with exit" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-6">
              <div className="text-center text-white">
                <Store className="h-10 w-10 mx-auto mb-4 text-emerald-400" />
                <h3 className="text-xl font-bold mb-2">Zero Work for You</h3>
                <p className="text-sm text-gray-300">We deliver the bin, we pick it up when it's full. All you do is point customers to it.</p>
              </div>
            </div>
          </div>
          <div className="relative h-64 md:h-80">
            <img src={binInteriorImage} alt="LITTR bin in shop" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-6">
              <div className="text-center text-white">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-4 text-emerald-400" />
                <h3 className="text-xl font-bold mb-2">Customers Appreciate It</h3>
                <p className="text-sm text-gray-300">Give them an easy, guilt-free disposal option. They'll remember you for doing the right thing.</p>
              </div>
            </div>
          </div>
          <div className="relative h-64 md:h-80">
            <img src={pickupVanImage} alt="LITTR pickup van at night" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-6">
              <div className="text-center text-white">
                <Truck className="h-10 w-10 mx-auto mb-4 text-emerald-400" />
                <h3 className="text-xl font-bold mb-2">Always Free Pickup</h3>
                <p className="text-sm text-gray-300">Bin full? Text us or scan the QR code. We'll come get it — no charge, ever.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 bg-zinc-900">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Quote className="h-10 w-10 mx-auto mb-6 text-zinc-600" />
            <p className="text-2xl md:text-3xl font-light leading-relaxed mb-6 text-white">
              "Every morning I was sweeping up dead vapes from the parking lot. Now my customers just drop them in the bin on their way out. Problem solved."
            </p>
            <p className="font-semibold text-emerald-400">Tino — High End Smoke Shop, Rochester NY</p>
          </div>
        </div>
      </section>

      {/* How it works + Form */}
      <section className="py-20 bg-zinc-950">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-6xl mx-auto">
            {/* Left: How it works */}
            <div>
              <h2 className="text-3xl font-bold mb-10 text-white">Three Simple Steps</h2>
              <div className="space-y-10">
                <div className="flex gap-6">
                  <div className="flex-shrink-0 h-14 w-14 rounded-full bg-emerald-500 text-black flex items-center justify-center text-xl font-bold">1</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-white">Request Your Free Bin</h3>
                    <p className="text-gray-400">Fill out the form — takes 60 seconds. We'll verify your location and reach out within 48 hours.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0 h-14 w-14 rounded-full bg-emerald-500 text-black flex items-center justify-center text-xl font-bold">2</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-white">We Deliver Everything</h3>
                    <p className="text-gray-400">We drop off a secure, fire-safe LITTR bin plus window signage to let customers know you're a drop-off spot.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0 h-14 w-14 rounded-full bg-emerald-500 text-black flex items-center justify-center text-xl font-bold">3</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-white">We Pick Up for Free</h3>
                    <p className="text-gray-400">When the bin is full, text us or scan the QR code. We'll come empty it — always free, always fast.</p>
                  </div>
                </div>
              </div>

              {/* Fire warning */}
              <div className="mt-12 bg-red-950/50 border border-red-900/50 rounded-xl p-6">
                <h3 className="font-bold text-red-400 mb-2">Why This Matters</h3>
                <p className="text-red-300/80 text-sm">
                  Lithium-ion batteries in vapes can ignite when crushed in garbage trucks. Proper disposal protects sanitation workers, prevents fires, and keeps your business on the right side of regulations.
                </p>
              </div>
            </div>

            {/* Right: Form */}
            <div>
              <Card className="shadow-2xl border-0 bg-zinc-900">
                <CardHeader className="bg-emerald-500 text-black rounded-t-xl p-8">
                  <CardTitle className="text-2xl">Get Your Free Bin — Delivered in Days</CardTitle>
                  <CardDescription className="text-black/70 text-base">FREE bin. FREE pickup. ZERO cost. Join 50+ Rochester shops already on board.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <FormField
                        control={form.control}
                        name="businessName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Business Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Your Shop Name" {...field} className="h-12 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="contactPerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Your Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} className="h-12 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Email</FormLabel>
                              <FormControl>
                                <Input placeholder="you@shop.com" {...field} className="h-12 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-gray-300">Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="(585) 555-0123" {...field} className="h-12 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Shop Address</FormLabel>
                            <FormControl>
                              <Textarea placeholder="123 Main St, Rochester, NY" {...field} className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="volume"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-300">Estimated Monthly Volume</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 bg-zinc-800 border-zinc-700 text-white">
                                  <SelectValue placeholder="How many vapes per month?" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-zinc-800 border-zinc-700">
                                <SelectItem value="low">Low (1-50 units)</SelectItem>
                                <SelectItem value="medium">Medium (50-200 units)</SelectItem>
                                <SelectItem value="high">High (200+ units)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold rounded-full bg-emerald-500 hover:bg-emerald-400 text-black">
                        Get My Free Bin Now
                      </Button>
                      <p className="text-center text-zinc-500 text-sm">No credit card. No hidden fees. Just a free bin.</p>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-zinc-900">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold mb-10 text-center text-white">Got Questions? We've Got Answers.</h2>
          <div className="space-y-4">
            <details className="group bg-zinc-800 rounded-xl border border-zinc-700 p-6">
              <summary className="font-semibold cursor-pointer list-none flex justify-between items-center text-lg text-white">
                Is it really 100% free?
                <span className="transition group-open:rotate-180 text-zinc-500">▼</span>
              </summary>
              <p className="text-zinc-400 mt-4">
                Yes — completely free for qualifying retail locations. There's no catch. More drop-off points means we collect more volume, which makes our entire recycling operation more efficient. You help us, we help you.
              </p>
            </details>
            <details className="group bg-zinc-800 rounded-xl border border-zinc-700 p-6">
              <summary className="font-semibold cursor-pointer list-none flex justify-between items-center text-lg text-white">
                What about liability or safety concerns?
                <span className="transition group-open:rotate-180 text-zinc-500">▼</span>
              </summary>
              <p className="text-zinc-400 mt-4">
                Our bins are specifically designed for lithium battery storage — fire-resistant and tested for safety. They're far safer than having loose vapes in your trash. We recommend a quick chat with your insurance provider, but our partners have had zero issues.
              </p>
            </details>
            <details className="group bg-zinc-800 rounded-xl border border-zinc-700 p-6">
              <summary className="font-semibold cursor-pointer list-none flex justify-between items-center text-lg text-white">
                How quickly will I get my bin?
                <span className="transition group-open:rotate-180 text-zinc-500">▼</span>
              </summary>
              <p className="text-zinc-400 mt-4">
                Most partners receive their bin within 5-7 business days after approval. We'll contact you within 48 hours of your request to confirm details and schedule delivery.
              </p>
            </details>
            <details className="group bg-zinc-800 rounded-xl border border-zinc-700 p-6">
              <summary className="font-semibold cursor-pointer list-none flex justify-between items-center text-lg text-white">
                What if I'm outside Rochester?
                <span className="transition group-open:rotate-180 text-zinc-500">▼</span>
              </summary>
              <p className="text-zinc-400 mt-4">
                We're currently focused on the Greater Rochester area, but we're expanding soon. Submit a request anyway — we'll add you to our priority list for when we reach your area.
              </p>
            </details>
          </div>
        </div>
      </section>
    </div>
  );
}
