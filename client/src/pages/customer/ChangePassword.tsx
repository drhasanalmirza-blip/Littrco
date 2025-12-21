import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore, apiRequest } from "@/lib/store";
import { Lock, ArrowLeft, Check } from "lucide-react";

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
        <div className="text-center">
          <p className="text-white mb-4">Please log in to change your password</p>
          <Button onClick={() => setLocation('/app/login')} className="bg-white text-black">
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-8 py-8 border-b border-gray-700">
            <h1 className="text-3xl font-bold text-white mb-2">Change Password</h1>
            <p className="text-gray-400 text-sm">Secure your account</p>
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
              <div className="mb-6 p-4 bg-green-900/20 border border-green-700/30 text-green-400 rounded-lg text-sm flex items-start gap-3">
                <Check className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <span>Password changed successfully! Redirecting...</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <Label className="text-gray-300 mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Current Password
                </Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500"
                  data-testid="input-current-password"
                  required
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  New Password
                </Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500"
                  data-testid="input-new-password"
                  required
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Confirm New Password
                </Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:border-gray-500 focus:ring-gray-500"
                  data-testid="input-confirm-new-password"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-white text-black hover:bg-gray-100 font-semibold py-2 h-10"
                disabled={loading || success}
                data-testid="button-change-password"
              >
                {loading ? 'Updating...' : success ? 'Password Changed!' : 'Change Password'}
              </Button>
            </form>

            {/* Links */}
            <div className="mt-6 border-t border-gray-700 pt-6">
              <a
                href="/app"
                className="text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to wallet
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
