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
import { useStore } from "@/lib/store";
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
  const addBinRequest = useStore((state) => state.addBinRequest);

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

  function onSubmit(values: z.infer<typeof formSchema>) {
    addBinRequest(values);
    toast({
      title: "Request Received",
      description: "We'll be in touch shortly to schedule your bin delivery.",
    });
    form.reset();
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero */}
      <div className="bg-black text-white py-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Become a Partner</h1>
          <p className="text-xl text-gray-400 mb-8">
            Drive foot traffic, build community trust, and solve the e-waste problem at your location.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Benefits & Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Benefits Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <Store className="h-8 w-8 mb-4 text-black" />
                  <h3 className="font-bold mb-2">Drive Traffic</h3>
                  <p className="text-sm text-gray-500">Recycling brings conscious consumers to your door.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <CheckCircle2 className="h-8 w-8 mb-4 text-black" />
                  <h3 className="font-bold mb-2">Turnkey Solution</h3>
                  <p className="text-sm text-gray-500">We provide the bin, signage, and regular pickups.</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Truck className="h-8 w-8 mb-4 text-black" />
                  <h3 className="font-bold mb-2">Responsible</h3>
                  <p className="text-sm text-gray-500">Full transparency on where the waste goes.</p>
                </CardContent>
              </Card>
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
