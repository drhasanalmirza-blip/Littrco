import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Contact Schema
const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10),
});

// Volunteer Schema
const volunteerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  interest: z.string().min(2),
  availability: z.string().min(2),
  notes: z.string().optional(),
});

export default function Contact() {
  const { toast } = useToast();
  const addContact = useStore((state) => state.addContact);
  const addVolunteer = useStore((state) => state.addVolunteer);

  const contactForm = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", message: "" },
  });

  const volunteerForm = useForm<z.infer<typeof volunteerSchema>>({
    resolver: zodResolver(volunteerSchema),
    defaultValues: { name: "", email: "", interest: "", availability: "", notes: "" },
  });

  function onContactSubmit(values: z.infer<typeof contactSchema>) {
    addContact(values);
    toast({ title: "Message Sent", description: "We'll get back to you soon." });
    contactForm.reset();
  }

  function onVolunteerSubmit(values: z.infer<typeof volunteerSchema>) {
    addVolunteer({ ...values, notes: values.notes || "" });
    toast({ title: "Application Sent", description: "Thanks for your interest in helping out!" });
    volunteerForm.reset();
  }

  return (
    <div className="min-h-screen bg-gray-50 py-20">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-4xl font-bold mb-8 text-center">Get in Touch</h1>
        
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <Tabs defaultValue="general">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="general">General Inquiry</TabsTrigger>
              <TabsTrigger value="volunteer">Volunteer / Jobs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general">
              <Form {...contactForm}>
                <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-4">
                  <FormField
                    control={contactForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contactForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl><Textarea className="h-32" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">Send Message</Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="volunteer">
              <Form {...volunteerForm}>
                <form onSubmit={volunteerForm.handleSubmit(onVolunteerSubmit)} className="space-y-4">
                  <FormField
                    control={volunteerForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={volunteerForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={volunteerForm.control}
                    name="interest"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Why do you want to join?</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={volunteerForm.control}
                    name="availability"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Availability</FormLabel>
                        <FormControl><Input placeholder="Weekends, Evenings, etc." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">Apply</Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
