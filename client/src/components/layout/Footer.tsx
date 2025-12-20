import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-black text-white py-12 border-t border-gray-800">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="mb-4">
              <span className="font-bold text-3xl">LITTR<span className="font-normal text-gray-400">.co</span></span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Modern recycling solutions for the disposable vape era. 
              Recovering lithium-ion batteries responsibly in Rochester, NY.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/business" className="hover:text-white transition-colors">For Business</Link></li>
              <li><Link href="/locations" className="hover:text-white transition-colors">Locations</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link href="/dropoff" className="hover:text-white transition-colors">How to Drop Off</Link></li>
              <li><Link href="/safety" className="hover:text-white transition-colors">Safety Guide</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Rochester, NY</li>
              <li><a href="tel:+15851234444" className="hover:text-white">+1 (585) 123-4444</a></li>
              <li><a href="mailto:hello@littr.co" className="hover:text-white">hello@littr.co</a></li>
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500">Employee Login:</p>
              <div className="flex gap-2 text-xs text-gray-600 mt-1">
                <Link href="/admin/login" className="hover:text-gray-400">Admin</Link> / 
                <Link href="/staff/login" className="hover:text-gray-400">Staff</Link> / 
                <Link href="/partner/login" className="hover:text-gray-400">Partner</Link>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">© {new Date().getFullYear()} LITTR.co. All rights reserved.</p>
          <p className="text-gray-600 text-xs">Working toward full compliance & best practices.</p>
        </div>
      </div>
    </footer>
  );
}
