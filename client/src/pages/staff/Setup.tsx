import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Recycle, Shield, CheckCircle, AlertCircle, Mail, Lock } from "lucide-react";

export default function StaffSetup() {
  const [, setLocation] = useLocation();
  const { setAuth } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"check" | "form" | "success">("check");

  const { isLoading: checking } = useQuery({
    queryKey: ["setup-check"],
    queryFn: async () => {
      const res = await fetch("/api/setup/check");
      if (!res.ok) throw new Error("Failed to check setup status");
      const data = await res.json();
      if (data.hasStaff) {
        setLocation("/staff/login");
      } else {
        setStep("form");
      }
      return data;
    },
  });

  const createStaff = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/setup/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create staff account");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setAuth(data.user, data.sessionId);
      setStep("success");
      setTimeout(() => {
        setLocation("/staff/dashboard");
      }, 2000);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    createStaff.mutate();
  };

  if (checking || step === "check") {
    return (
      <div className="littr-dashboard flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 littr-gradient-green rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg shadow-green-500/20">
            <Recycle className="h-8 w-8 text-white" />
          </div>
          <p className="text-gray-500 font-medium">Checking setup status...</p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="littr-dashboard flex items-center justify-center">
        <div className="littr-card overflow-hidden shadow-xl ring-1 ring-black/5 rounded-2xl p-8 text-center max-w-md mx-4">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-black mb-2">Setup Complete!</h2>
          <p className="text-gray-500 font-medium">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="littr-dashboard flex items-center justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-md animate-fade-in">
        <div className="littr-card overflow-hidden shadow-xl ring-1 ring-black/5">
          <div className="px-8 py-8 border-b border-gray-100 bg-white/50 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-black mb-1">LITTR Setup</h1>
            <p className="text-gray-500 text-sm font-medium">
              Create your first staff account to get started
            </p>
          </div>

          <div className="px-8 py-8 bg-white">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-sm animate-slide-up">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-gray-900 font-semibold flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  Email Address
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@littr.co"
                  className="littr-input w-full"
                  required
                  data-testid="input-setup-email"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900 font-semibold flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-gray-400" />
                  Password
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a secure password"
                  className="littr-input w-full"
                  required
                  data-testid="input-setup-password"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-900 font-semibold flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-gray-400" />
                  Confirm Password
                </Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="littr-input w-full"
                  required
                  data-testid="input-setup-confirm-password"
                />
              </div>

              <Button
                type="submit"
                className="littr-btn littr-btn-primary w-full shadow-lg shadow-black/10"
                disabled={createStaff.isPending}
                data-testid="button-create-staff"
              >
                {createStaff.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Creating Account...
                  </span>
                ) : (
                  "Create Staff Account"
                )}
              </Button>

              <p className="text-xs text-center text-gray-400 mt-4">
                This account will have full administrative access to LITTR.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
