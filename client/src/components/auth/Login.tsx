import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { useState } from "react";
import { useLocation } from "wouter";

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

  const getTitle = () => {
    switch (type) {
      case 'admin':
      case 'staff':
        return 'Staff Portal';
      case 'partner':
        return 'Partner Portal';
      case 'customer':
        return 'Customer Portal';
      default:
        return 'Login';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">{getTitle()}</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              data-testid="input-email"
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
        
        {type === 'customer' && (
          <p className="mt-4 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <a href="/app/register" className="text-black font-medium hover:underline">
              Sign up
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
