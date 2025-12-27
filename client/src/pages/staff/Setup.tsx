import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Recycle, Shield, CheckCircle, AlertCircle, Mail, Lock } from "lucide-react";

import pixelCityImage from "@assets/generated_images/pixel_art_rochester_cityscape.png";

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
        <div className="text-center text-white">
          <div className="w-16 h-16 littr-gradient-green rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Recycle className="h-8 w-8 text-white" />
          </div>
          <p className="text-gray-400">Checking setup status...</p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="littr-dashboard flex items-center justify-center">
        <div className="littr-card-solid rounded-2xl p-8 text-center max-w-md mx-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Setup Complete!</h2>
          <p className="text-gray-400">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="littr-dashboard flex items-center justify-center p-4 safe-top safe-bottom">
      {/* Background */}
      <div className="absolute inset-0 opacity-15">
        <img 
          src={pixelCityImage} 
          alt="" 
          className="w-full h-full object-cover pixel-image"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--littr-midnight)]/90 to-[var(--littr-midnight)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="littr-card-solid rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-8 py-8 border-b border-white/10 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">LITTR Setup</h1>
            <p className="text-gray-400 text-sm">
              Create your first staff account to get started
            </p>
          </div>

          {/* Content */}
          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <Label className="text-gray-300 mb-2 flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4" />
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

              <div>
                <Label className="text-gray-300 mb-2 flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4" />
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

              <div>
                <Label className="text-gray-300 mb-2 flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4" />
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
                className="littr-btn littr-btn-primary w-full"
                disabled={createStaff.isPending}
                data-testid="button-create-staff"
              >
                {createStaff.isPending ? "Creating Account..." : "Create Staff Account"}
              </Button>

              <p className="text-xs text-center text-gray-500 mt-4">
                This account will have full administrative access to LITTR.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
