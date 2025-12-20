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

import shopInteriorImage from "@assets/generated_images/shop_interior_with_bin.png";
import staffImage from "@assets/generated_images/staff_handing_bin_to_owner.png";
import vanImage from "@assets/generated_images/pickup_van_at_shop.png";

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
        title: "Request Received",
        description: "We'll be in touch shortly to schedule your bin delivery.",
      });
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero with image */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={shopInteriorImage} alt="Shop interior with LITTR bin" className="w-full h-full object-cover opacity-40" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
        
        <div className="container mx-auto px-4 relative z-10 py-20">
          <div className="max-w-2xl text-white">
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-6">For Smoke Shops & Retailers</p>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Stop finding vapes<br />in your parking lot.
            </h1>
            <p className="text-xl text-gray-400 mb-8">
              We give you a bin. We pick it up. Zero work for you.
            </p>
            <div className="inline-block border border-white/30 px-6 py-3 rounded-full">
              <span className="font-semibold">100% free for partners</span>
            </div>
          </div>
        </div>
      </section>

      {/* Visual benefits */}
      <section className="py-0 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-3">
          <div className="relative h-64 md:h-80">
            <img src={staffImage} alt="Staff delivering bin" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-6">
              <div className="text-center text-white">
                <Store className="h-10 w-10 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Zero Work</h3>
                <p className="text-sm text-gray-300">We deliver, we pick up. You just point customers to the bin.</p>
              </div>
            </div>
          </div>
          <div className="relative h-64 md:h-80">
            <img src={shopInteriorImage} alt="Bin in shop" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-6">
              <div className="text-center text-white">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Customers Love It</h3>
                <p className="text-sm text-gray-300">Give them a guilt-free way to dispose. They'll remember you.</p>
              </div>
            </div>
          </div>
          <div className="relative h-64 md:h-80">
            <img src={vanImage} alt="Pickup van" className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-6">
              <div className="text-center text-white">
                <Truck className="h-10 w-10 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Free Pickup</h3>
                <p className="text-sm text-gray-300">Text us when it's full. We come get it. That simple.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 bg-gray-100">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Quote className="h-10 w-10 mx-auto mb-6 text-gray-300" />
            <p className="text-2xl md:text-3xl font-light leading-relaxed mb-6 text-gray-800">
              "I was so tired of sweeping up dead vapes from the parking lot every morning. Now customers just toss them in the bin on their way out."
            </p>
            <p className="font-semibold text-black">Tino — High End Smoke Shop</p>
          </div>
        </div>
      </section>

      {/* How it works + Form */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-6xl mx-auto">
            {/* Left: How it works */}
            <div>
              <h2 className="text-3xl font-bold mb-10">How it works</h2>
              <div className="space-y-10">
                <div className="flex gap-6">
                  <div className="flex-shrink-0 h-14 w-14 rounded-full bg-black text-white flex items-center justify-center text-xl font-bold">1</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Request a Bin</h3>
                    <p className="text-gray-500">Fill out the form. We'll verify your location and get in touch within 48 hours.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0 h-14 w-14 rounded-full bg-black text-white flex items-center justify-center text-xl font-bold">2</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">We Deliver</h3>
                    <p className="text-gray-500">We drop off a secure, LITTR-branded collection bin and signage for your window.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="flex-shrink-0 h-14 w-14 rounded-full bg-black text-white flex items-center justify-center text-xl font-bold">3</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">We Pick Up</h3>
                    <p className="text-gray-500">When it's full, text us or scan the QR on the bin. We'll come get it for free.</p>
                  </div>
                </div>
              </div>

              {/* Fire warning */}
              <div className="mt-12 bg-red-50 border border-red-200 rounded-xl p-6">
                <h3 className="font-bold text-red-800 mb-2">Did you know?</h3>
                <p className="text-red-700 text-sm">
                  Lithium-ion batteries in vapes can catch fire when crushed in garbage trucks. Proper disposal protects sanitation workers and keeps your business compliant.
                </p>
              </div>
            </div>

            {/* Right: Form */}
            <div>
              <Card className="shadow-xl border-0">
                <CardHeader className="bg-black text-white rounded-t-xl p-8">
                  <CardTitle className="text-2xl">Get your bin in as little as 48 hours</CardTitle>
                  <CardDescription className="text-gray-400">Free bin, free pickup. Zero cost to you.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <FormField
                        control={form.control}
                        name="businessName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Your Shop Name" {...field} className="h-12" />
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
                            <FormLabel>Your Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} className="h-12" />
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
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input placeholder="you@shop.com" {...field} className="h-12" />
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
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="(585) 555-0123" {...field} className="h-12" />
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
                            <FormLabel>Shop Address</FormLabel>
                            <FormControl>
                              <Textarea placeholder="123 Main St, Rochester, NY" {...field} />
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
                            <FormLabel>Estimated Monthly Volume</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12">
                                  <SelectValue placeholder="How many vapes per month?" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low (1-50 units)</SelectItem>
                                <SelectItem value="medium">Medium (50-200 units)</SelectItem>
                                <SelectItem value="high">High (200+ units)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" size="lg" className="w-full h-14 text-lg font-bold rounded-full">
                        Reserve My Free Bin
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl font-bold mb-10 text-center">Common Questions</h2>
          <div className="space-y-4">
            <details className="group bg-white rounded-xl border border-gray-200 p-6">
              <summary className="font-semibold cursor-pointer list-none flex justify-between items-center text-lg">
                Is there really no cost?
                <span className="transition group-open:rotate-180 text-gray-400">▼</span>
              </summary>
              <p className="text-gray-500 mt-4">
                For qualifying retail locations, yes. We subsidize the cost because more drop-off points means more collection volume, which makes our entire operation more efficient.
              </p>
            </details>
            <details className="group bg-white rounded-xl border border-gray-200 p-6">
              <summary className="font-semibold cursor-pointer list-none flex justify-between items-center text-lg">
                What about liability?
                <span className="transition group-open:rotate-180 text-gray-400">▼</span>
              </summary>
              <p className="text-gray-500 mt-4">
                We provide fire-safe containers designed to mitigate risk. Our bins are tested and approved for lithium battery storage. We recommend discussing with your insurance provider for full coverage details.
              </p>
            </details>
            <details className="group bg-white rounded-xl border border-gray-200 p-6">
              <summary className="font-semibold cursor-pointer list-none flex justify-between items-center text-lg">
                How long until I get a bin?
                <span className="transition group-open:rotate-180 text-gray-400">▼</span>
              </summary>
              <p className="text-gray-500 mt-4">
                Most partners receive their bin within 5-7 business days after approval. We'll contact you within 48 hours of your request to confirm details.
              </p>
            </details>
          </div>
        </div>
      </section>
    </div>
  );
}
