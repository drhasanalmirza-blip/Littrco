import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore, apiRequest } from "@/lib/store";
import { Lock, ArrowLeft, Check, Recycle } from "lucide-react";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, sessionId } = useStore();
  const [, setLocation] = useLocation();

  if (!user || !sessionId) {
    return (
      <div className="littr-dashboard flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4 font-medium">Please log in to change your password</p>
          <Button onClick={() => setLocation('/app/login')} className="littr-btn littr-btn-primary">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to change password');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      setTimeout(() => {
        setLocation('/app');
      }, 2000);
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="littr-dashboard flex items-center justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-md animate-fade-in">
        <Link href="/app" className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white mb-6 text-sm font-medium transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to wallet
        </Link>

        <div className="littr-card overflow-hidden shadow-xl ring-1 ring-black/5 dark:ring-white/5">
          <div className="px-8 py-8 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 littr-gradient-green rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <Recycle className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-black dark:text-white tracking-tight">LITTR</span>
            </div>
            <h1 className="text-3xl font-extrabold text-black dark:text-gray-100 mb-1 tracking-tight">Change Password</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Secure your account</p>
          </div>

          <div className="px-8 py-8 bg-white dark:bg-gray-900">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-start gap-3 animate-slide-up">
                <span className="text-red-500 mt-0.5">⚠</span>
                <span className="font-medium">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-800 text-green-700 dark:text-green-300 rounded-xl text-sm flex items-start gap-3 animate-slide-up">
                <Check className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <span className="font-medium">Password changed! Redirecting...</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-gray-400" />
                  Current Password
                </Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="littr-input w-full"
                  data-testid="input-current-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-gray-400" />
                  New Password
                </Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="littr-input w-full"
                  data-testid="input-new-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900 dark:text-gray-100 font-semibold flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-gray-400" />
                  Confirm New Password
                </Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="littr-input w-full"
                  data-testid="input-confirm-new-password"
                  required
                />
              </div>

              <Button
                type="submit"
                className="littr-btn littr-btn-primary w-full shadow-lg shadow-black/10"
                disabled={loading || success}
                data-testid="button-change-password"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                    Updating...
                  </span>
                ) : success ? (
                  'Password Changed!'
                ) : (
                  'Change Password'
                )}
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-8 font-medium">
          LITTR.co © 2026 — Recycling Made Simple
        </p>
      </div>
    </div>
  );
}
