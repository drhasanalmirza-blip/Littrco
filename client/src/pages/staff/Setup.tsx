import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Recycle, Shield, CheckCircle, AlertCircle } from "lucide-react";

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
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Recycle className="h-16 w-16 mx-auto mb-4 animate-spin text-green-400" />
          <p>Checking setup status...</p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-8 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-2xl font-bold mb-2">Setup Complete!</h2>
            <p className="text-gray-600">Redirecting to your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <Shield className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">LITTR Setup</CardTitle>
          <CardDescription>
            Create your first staff account to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@littr.co"
                required
                data-testid="input-setup-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a secure password"
                required
                data-testid="input-setup-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                data-testid="input-setup-confirm-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createStaff.isPending}
              data-testid="button-create-staff"
            >
              {createStaff.isPending ? "Creating Account..." : "Create Staff Account"}
            </Button>

            <p className="text-xs text-center text-gray-500 mt-4">
              This account will have full administrative access to LITTR.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
