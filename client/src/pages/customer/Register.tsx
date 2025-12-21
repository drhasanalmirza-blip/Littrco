import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { Mail, Lock, UserPlus, ArrowLeft } from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useStore();
  const [, setLocation] = useLocation();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setAuth(data.user, data.sessionId);

      setTimeout(() => {
        setLocation('/app');
      }, 1500);
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-8 py-8 border-b border-gray-700">
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-gray-400 text-sm">Start earning points today</p>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-700/30 text-red-400 rounded-lg text-sm flex items-start gap-3">
                <span className="text-red-500 mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-900/20 border border-green-700/30 text-green-400 rounded-lg text-sm">
                Account created! Redirecting to your wallet...
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-5">
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
                  data-testid="input-register-email"
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
                  placeholder="At least 6 characters"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500"
                  data-testid="input-register-password"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
              </div>

              <div>
                <Label className="text-gray-300 mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Confirm Password
                </Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500"
                  data-testid="input-register-confirm"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-white text-black hover:bg-gray-100 font-semibold py-2 h-10 flex items-center justify-center gap-2"
                disabled={loading || success}
                data-testid="button-register"
              >
                <UserPlus className="h-4 w-4" />
                {loading ? 'Creating account...' : success ? 'Account Created!' : 'Create Account'}
              </Button>
            </form>

            {/* Links */}
            <div className="mt-6 space-y-3 border-t border-gray-700 pt-6">
              <p className="text-center text-sm text-gray-400">
                Already have an account?{' '}
                <a href="/app/login" className="text-white font-semibold hover:underline">
                  Sign in
                </a>
              </p>
              <a
                href="/"
                className="text-sm text-gray-400 hover:text-gray-300 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to home
              </a>
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
