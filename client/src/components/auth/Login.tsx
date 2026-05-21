import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { Lock, Mail, LogIn, Recycle, ArrowLeft } from "lucide-react";
import { useRecaptcha } from "@/hooks/useRecaptcha";

import pixelShopImage from "@assets/generated_images/pixel_art_smoke_shop_night.png";

export function Login({ type }: { type: 'admin' | 'staff' | 'partner' | 'customer' }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth, clearAuth } = useStore();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const nextParam = new URLSearchParams(search).get('next');
  const { executeRecaptcha } = useRecaptcha();

  const needsCaptcha = type === 'customer';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const recaptchaToken = needsCaptcha ? await executeRecaptcha("login") : null;
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, recaptchaToken }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      
      // Clear any persisted state from a previous role/session before setting new auth
      // so we never flash a stale dashboard during the route transition.
      clearAuth();
      setAuth(data.user, data.sessionId);
      
      const roleMap: Record<string, string> = {
        'STAFF': 'staff',
        'PARTNER': 'partner',
        'CUSTOMER': 'app',
      };
      
      const dashboardPath = roleMap[data.user.role] === 'app' ? '/app' : `/${roleMap[data.user.role] || type}/dashboard`;
      // Honor ?next= so post-claim sign-in returns to /claim/:token.
      // Only allow same-origin internal paths.
      const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
      setLocation(safeNext || dashboardPath);
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

  return (
    <div className="littr-dashboard flex items-center justify-center p-4 safe-top safe-bottom">
      {/* Background */}
      <div className="absolute inset-0 opacity-15">
        <img 
          src={pixelShopImage} 
          alt="" 
          className="w-full h-full object-cover pixel-image"
        />
      </div>
      <div className="absolute inset-0 bg-white/40 dark:bg-gray-950/70" />
      
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Back Link */}
        <Link href="/" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white mb-6 text-sm font-medium transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Card */}
        <div className="littr-card overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          {/* Header */}
          <div className="px-8 py-8 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 littr-gradient-green rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <Recycle className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-black dark:text-white tracking-tight">LITTR</span>
            </div>
            <h1 className="text-3xl font-extrabold text-black dark:text-white mb-1 tracking-tight">{title}</h1>
            {subtitle && <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{subtitle}</p>}
          </div>

          {/* Content */}
          <div className="px-8 py-8 bg-white dark:bg-gray-900">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-start gap-3 animate-slide-up">
                <span className="text-red-500 mt-0.5">⚠</span>
                <span className="font-medium">{error}</span>
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  Email Address
                </Label>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="littr-input w-full focus:ring-green-500/20"
                  data-testid="input-email"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-gray-400" />
                  Password
                </Label>
                <Input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="littr-input w-full focus:ring-green-500/20"
                  data-testid="input-password"
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="littr-btn littr-btn-primary w-full flex items-center justify-center gap-2 shadow-lg shadow-black/10 active:scale-95"
                disabled={loading}
                data-testid="button-login"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            {/* Links */}
            {isCustomer && (
              <div className="mt-8 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-6">
                <p className="text-center text-sm text-gray-500 font-medium">
                  Don't have an account?{' '}
                  <Link href="/app/register" className="text-green-600 font-bold hover:text-green-700 hover:underline transition-colors">
                    Create one
                  </Link>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-8 font-medium">
          LITTR.co © 2026 — Recycling Made Simple
        </p>
      </div>
    </div>
  );
}
