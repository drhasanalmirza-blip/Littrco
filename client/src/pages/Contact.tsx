import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
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

  const contactForm = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", message: "" },
  });

  const volunteerForm = useForm<z.infer<typeof volunteerSchema>>({
    resolver: zodResolver(volunteerSchema),
    defaultValues: { name: "", email: "", interest: "", availability: "", notes: "" },
  });

  async function onContactSubmit(values: z.infer<typeof contactSchema>) {
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) throw new Error('Failed to submit');
      
      toast({ title: "Message Sent", description: "We'll get back to you soon." });
      contactForm.reset();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  }

  async function onVolunteerSubmit(values: z.infer<typeof volunteerSchema>) {
    try {
      const response = await fetch('/api/volunteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, notes: values.notes || "" }),
      });
      
      if (!response.ok) throw new Error('Failed to submit');
      
      toast({ title: "Application Sent", description: "Thanks for your interest in helping out!" });
      volunteerForm.reset();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-20">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-4xl font-bold mb-8 text-center dark:text-gray-100">Get in Touch</h1>
        
        <div className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
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
