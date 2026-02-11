import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useLocation, useSearch } from "wouter";
import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function ClaimPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get('token');
  
  const { user, setAuth } = useStore();
  const [, setLocation] = useLocation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [points, setPoints] = useState(0);

  const handleClaim = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid claim link');
      return;
    }

    setStatus('loading');
    
    try {
      const body: any = { token };
      
      if (!user && email && password) {
        body.email = email;
        body.password = password;
      }
      
      const res = await apiRequest('/api/claim', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Claim failed');
        return;
      }
      
      setStatus('success');
      setPoints(data.points);
      setMessage(`You earned ${data.points} batteries!`);
      
      if (data.sessionId && data.user) {
        setAuth(data.user, data.sessionId);
      }
    } catch (error) {
      setStatus('error');
      setMessage('Connection error. Please try again.');
    }
  };

  useEffect(() => {
    if (user && token && status === 'idle') {
      handleClaim();
    }
  }, [user, token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Invalid Link</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">This claim link is invalid or has expired.</p>
            <Button onClick={() => setLocation('/')} className="littr-btn littr-btn-primary">Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 text-gray-900 dark:text-gray-100 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Claiming your batteries...</h2>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="pt-6 text-center">
            <div className="bg-green-100 dark:bg-green-950 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">+{points} Batteries!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Thanks for recycling responsibly!</p>
            <Button onClick={() => setLocation('/app')} className="w-full littr-btn littr-btn-primary">
              View My Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Claim Failed</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">{message}</p>
            <Button onClick={() => setLocation('/')} className="littr-btn littr-btn-primary">Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <CardHeader className="text-center">
            <CardTitle className="text-gray-900 dark:text-gray-100">Claim Your Batteries</CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400">
              Sign in or create an account to claim your recycling reward
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleClaim} className="space-y-4">
              <div>
                <Label className="text-gray-900 dark:text-gray-100">Email</Label>
                <Input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="littr-input"
                  required
                  data-testid="input-email"
                />
              </div>
              <div>
                <Label className="text-gray-900 dark:text-gray-100">Password</Label>
                <Input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create or enter your password"
                  className="littr-input"
                  required
                  data-testid="input-password"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  New user? This will create your account.
                </p>
              </div>
              <Button type="submit" className="w-full littr-btn littr-btn-primary" data-testid="button-claim">
                Claim Batteries
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
