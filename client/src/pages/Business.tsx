import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Package, Store, Truck } from "lucide-react";

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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero */}
      <div className="bg-black text-white py-24">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <p className="text-sm uppercase tracking-widest text-gray-500 mb-6">For Smoke Shops & Retailers</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">Stop finding vapes in your parking lot.</h1>
          <p className="text-xl text-gray-400 mb-4">
            We give you a bin. We pick it up. Zero work for you.
          </p>
          <p className="inline-block border border-white/20 px-4 py-2 rounded-full text-sm text-white/80">
            100% free for partners
          </p>
        </div>
      </div>

      {/* Testimonial */}
      <div className="bg-gray-100 py-10 border-b border-gray-200">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto italic">
            "I was so tired of sweeping up dead vapes from the parking lot every morning. Now customers just toss them in the bin on their way out."
          </p>
          <p className="mt-4 font-semibold text-black">— Tino, High End Smoke Shop</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Benefits & Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Benefits Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-2 border-black">
                <CardContent className="pt-6">
                  <Store className="h-8 w-8 mb-4 text-black" />
                  <h3 className="font-bold mb-2">Zero Work for You</h3>
                  <p className="text-sm text-gray-500">We deliver, we pick up. You just point customers to the bin.</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-black">
                <CardContent className="pt-6">
                  <CheckCircle2 className="h-8 w-8 mb-4 text-black" />
                  <h3 className="font-bold mb-2">Customers Love It</h3>
                  <p className="text-sm text-gray-500">Give them a guilt-free way to dispose. They'll remember you for it.</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-black">
                <CardContent className="pt-6">
                  <Truck className="h-8 w-8 mb-4 text-black" />
                  <h3 className="font-bold mb-2">Free Pickup</h3>
                  <p className="text-sm text-gray-500">Text us when it's full. We come get it. That simple.</p>
                </CardContent>
              </Card>
            </div>

            {/* Fire Hazard Warning */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <h3 className="font-bold text-red-800 mb-2">Did you know?</h3>
              <p className="text-red-700 text-sm">
                Lithium-ion batteries in vapes can catch fire when crushed in garbage trucks. Proper disposal protects sanitation workers and keeps your business on the right side of EPA guidelines.
              </p>
            </div>

            {/* How it Works */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-2xl font-bold mb-6">How it works</h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold">1</div>
                  <div>
                    <h3 className="font-bold">Request a Bin</h3>
                    <p className="text-gray-500 text-sm">Fill out the form. We'll verify your location and needs.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold">2</div>
                  <div>
                    <h3 className="font-bold">Delivery & Setup</h3>
                    <p className="text-gray-500 text-sm">We deliver a secure, LITTR-branded collection bin and QR signage for your window.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold">3</div>
                  <div>
                    <h3 className="font-bold">Schedule Pickups</h3>
                    <p className="text-gray-500 text-sm">Scan the QR on the bin to request pickup when full, or set a recurring schedule.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Business FAQ</h2>
              <div className="space-y-4">
                <details className="group bg-white rounded-lg border border-gray-200 p-4">
                  <summary className="font-medium cursor-pointer list-none flex justify-between items-center">
                    Is there a cost?
                    <span className="transition group-open:rotate-180">▼</span>
                  </summary>
                  <p className="text-gray-500 mt-4 text-sm">
                    We offer different tiers. For high-volume public drop-off points, we often subsidize the cost. Contact us for a quote based on your volume.
                  </p>
                </details>
                <details className="group bg-white rounded-lg border border-gray-200 p-4">
                  <summary className="font-medium cursor-pointer list-none flex justify-between items-center">
                    What about liability?
                    <span className="transition group-open:rotate-180">▼</span>
                  </summary>
                  <p className="text-gray-500 mt-4 text-sm">
                    We provide safety containers designed to mitigate fire risk. However, businesses should consult their own insurance and legal counsel regarding accepting public waste.
                  </p>
                </details>
              </div>
            </div>
          </div>

          {/* Right Column: Request Form */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 shadow-lg border-black/5">
              <CardHeader className="bg-black text-white rounded-t-xl">
                <CardTitle>Request a Bin</CardTitle>
                <CardDescription className="text-gray-400">Get started with LITTR today.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="businessName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Vape Shop Inc." {...field} />
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
                          <FormLabel>Contact Person</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="john@example.com" {...field} />
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
                            <Input placeholder="(585) 555-0123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
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
                          <FormLabel>Est. Monthly Volume</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select volume" />
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
                    <Button type="submit" className="w-full font-bold">Submit Request</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
