export default function About() {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-20 max-w-3xl">
        <h1 className="text-5xl font-bold mb-8 tracking-tight">Our Mission</h1>
        <p className="text-2xl text-gray-500 mb-12 leading-relaxed">
          LITTR was born in Rochester, NY with a simple goal: to stop lithium-ion batteries from burning down garbage trucks and poisoning our landfills.
        </p>
        
        <div className="prose prose-lg prose-gray">
          <p>
            The rise of disposable vapes created a massive new waste stream that traditional recycling infrastructure wasn't built to handle. These devices are complex—containing plastic, copper, lithium, and chemical residue—all in one sealed unit.
          </p>
          <p>
            We're starting small, building a network of local drop-off points to make doing the right thing as easy as buying a new device.
          </p>
          <p>
            We aren't a giant corporate entity. We are a team of locals working toward compliance, safety, and a cleaner city.
          </p>
        </div>

        <div className="mt-20 border-t pt-12">
          <h2 className="text-2xl font-bold mb-6">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-2">Transparency</h3>
              <p className="text-gray-500">We don't greenwash. We tell you exactly what we can recycle and what we can't.</p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Safety</h3>
              <p className="text-gray-500">Lithium-ion batteries are energy dense. We treat them with the respect they demand.</p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Simplicity</h3>
              <p className="text-gray-500">If it's hard to recycle, people won't do it. We remove the friction.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
