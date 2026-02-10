import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function FAQ() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 py-20">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-4xl font-bold mb-12 text-center dark:text-gray-100">Frequently Asked Questions</h1>

        <div className="space-y-12">
          {/* Consumer Section */}
          <div>
            <h2 className="text-xl font-bold mb-6 border-b pb-2">For Consumers</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Is this service really free?</AccordionTrigger>
                <AccordionContent>
                  Yes. Dropping off your used disposable vapes and small batteries at a LITTR bin is completely free for consumers.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Do I need to disassemble the vape first?</AccordionTrigger>
                <AccordionContent>
                  No. Please do NOT disassemble the device yourself as this can damage the battery and cause a fire risk. Drop the whole device in the bin, and we will handle the separation safely.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>What happens to the data on my device?</AccordionTrigger>
                <AccordionContent>
                  Most disposable vapes do not store user data. However, for any electronics dropped off, our process involves physical destruction of components, ensuring no data can be recovered.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>Can I recycle normal AA batteries here?</AccordionTrigger>
                <AccordionContent>
                  Our bins are optimized for lithium-ion batteries and small electronics. While we can accept small quantities of alkaline batteries, we encourage using municipal drop-offs for bulk alkaline battery disposal.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Business Section */}
          <div>
            <h2 className="text-xl font-bold mb-6 border-b pb-2">For Businesses</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-b-1">
                <AccordionTrigger>How often do you pick up?</AccordionTrigger>
                <AccordionContent>
                  We offer on-demand pickup (scan the QR code on your bin) or scheduled weekly/bi-weekly service depending on your volume.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-b-2">
                <AccordionTrigger>What if a bin catches fire?</AccordionTrigger>
                <AccordionContent>
                  Our bins are designed with fire-retardant materials. However, you should treat them like any other potential hazard. We provide safety training and guidelines. In an emergency, always call 911.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-b-3">
                <AccordionTrigger>Do you provide certification for disposal?</AccordionTrigger>
                <AccordionContent>
                  Yes. We can provide a certificate of recycling for your records, tracking the weight and volume diverted from landfills.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Legal Section */}
          <div>
            <h2 className="text-xl font-bold mb-6 border-b pb-2">Legal & Compliance</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-l-1">
                <AccordionTrigger>Are you EPA certified?</AccordionTrigger>
                <AccordionContent>
                  LITTR.co operates in compliance with federal Universal Waste Regulations (40 CFR Part 273). We work exclusively with R2v3 and e-Stewards certified downstream processors to ensure all material is handled responsibly. We are currently finalizing our own state-level permits.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-l-2">
                <AccordionTrigger>Who is liable for the waste?</AccordionTrigger>
                <AccordionContent>
                   Once the waste is collected by our team, LITTR.co assumes chain-of-custody. However, businesses hosting bins are responsible for ensuring the bins are not tampered with and are kept in a safe location compliant with local fire codes.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-l-3">
                <AccordionTrigger>Data Privacy Policy</AccordionTrigger>
                <AccordionContent>
                  We prioritize user privacy. While most disposable vapes do not contain user data, any electronics containing memory collected by us are subject to physical destruction. We do not resell devices.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
}
