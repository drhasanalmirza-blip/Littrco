import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, Mail, LogIn } from "lucide-react";

export function Login({ type }: { type: 'admin' | 'staff' | 'partner' | 'customer' }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useStore();
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      
      setAuth(data.user, data.sessionId);
      
      const roleMap: Record<string, string> = {
        'STAFF': 'staff',
        'PARTNER': 'partner',
        'CUSTOMER': 'customer',
      };
      
      const dashboardPath = `/${roleMap[data.user.role] || type}/dashboard`;
      setLocation(dashboardPath);
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTitleAndSubtitle = () => {
    switch (type) {
      case 'admin':
      case 'staff':
        return { title: 'Staff Portal', subtitle: 'Manage recycling operations' };
      case 'partner':
        return { title: 'Partner Portal', subtitle: 'Manage your shop rewards' };
      case 'customer':
        return { title: 'My Wallet', subtitle: 'Sign in to earn and redeem points' };
      default:
        return { title: 'Login', subtitle: '' };
    }
  };

  const { title, subtitle } = getTitleAndSubtitle();
  
  const isCustomer = type === 'customer';
  const isPartner = type === 'partner';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-8 py-8 border-b border-gray-700">
            <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
            {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-700/30 text-red-400 rounded-lg text-sm flex items-start gap-3">
                <span className="text-red-500 mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <Label className="text-gray-300 mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500"
                  data-testid="input-email"
                  required
                />
              </div>
              
              <div>
                <Label className="text-gray-300 mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </Label>
                <Input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500"
                  data-testid="input-password"
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-white text-black hover:bg-gray-100 font-semibold py-2 h-10 flex items-center justify-center gap-2"
                disabled={loading}
                data-testid="button-login"
              >
                <LogIn className="h-4 w-4" />
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* Links */}
            <div className="mt-6 space-y-3 border-t border-gray-700 pt-6">
              {isCustomer && (
                <p className="text-center text-sm text-gray-400">
                  Don't have an account?{' '}
                  <a href="/app/register" className="text-white font-semibold hover:underline">
                    Create one
                  </a>
                </p>
              )}
              
              {isCustomer && (
                <div className="text-center">
                  <a href="/app/change-password" className="text-sm text-gray-400 hover:text-gray-300 font-medium">
                    Change password
                  </a>
                </div>
              )}

              {(isCustomer || isPartner) && (
                <div className="text-center">
                  <a href="/" className="text-sm text-gray-400 hover:text-gray-300">
                    Back to home
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-6">
          LITTR.co © 2025 — Recycling Made Simple
        </p>
      </div>
    </div>
  );
}
