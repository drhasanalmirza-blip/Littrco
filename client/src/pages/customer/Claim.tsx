import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Battery, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import SelfReportDialog from "@/components/SelfReportDialog";

export default function ClaimPage() {
  const [, params] = useRoute("/claim/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();
  const { user, role } = useStore();
  const [claimState, setClaimState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [claimResult, setClaimResult] = useState<{ batteries: number; balance: number } | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: [`/api/claim/${token}`],
    queryFn: async () => {
      const r = await apiRequest(`/api/claim/${token}`);
      if (!r.ok) throw new Error((await r.json()).error || "Invalid token");
      return r.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Auto-claim if signed in customer and not claimed
  useEffect(() => {
    if (data && !data.claimed && user && role === "customer" && claimState === "idle") {
      doClaim();
    }
  }, [data, user, role]);

  async function doClaim() {
    setClaimState("loading");
    setError("");
    try {
      const r = await apiRequest(`/api/customer/claim/${token}`, { method: "POST" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Claim failed");
      setClaimResult({ batteries: body.batteries, balance: body.balance });
      setClaimState("done");
      refetch();
    } catch (e: any) {
      setError(e.message);
      setClaimState("error");
    }
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="text-red-500" />Invalid Claim Link</CardTitle></CardHeader>
          <CardContent>This claim link is invalid or expired.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            {data.claimed ? "Already Claimed" : claimState === "done" ? "Claimed!" : "Drop Receipt"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-6">
            <Battery className="h-16 w-16 mx-auto text-green-500 mb-3" />
            <div className="text-5xl font-bold" data-testid="text-batteries">{data.batteries}</div>
            <div className="text-sm text-gray-500 mt-1">Batteries from {data.acceptedDrops} vape(s)</div>
            {data.shop && <div className="text-sm mt-2">at <strong>{data.shop.name}</strong></div>}
          </div>

          {data.claimed ? (
            <div className="text-center text-sm text-gray-500 flex items-center gap-2 justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> This receipt has been claimed.
            </div>
          ) : !user ? (
            <div className="space-y-2">
              <p className="text-sm text-center text-gray-600 dark:text-gray-400">Sign in to claim these batteries.</p>
              <Button className="w-full" onClick={() => setLocation(`/app/login?next=${encodeURIComponent(`/claim/${token}`)}`)} data-testid="button-signin">Sign In</Button>
              <Button variant="outline" className="w-full" onClick={() => setLocation(`/app/register?next=${encodeURIComponent(`/claim/${token}`)}`)} data-testid="button-register">Create Account</Button>
            </div>
          ) : role !== "customer" ? (
            <p className="text-sm text-center text-red-600">You must claim from a customer account.</p>
          ) : claimState === "loading" ? (
            <div className="flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : claimState === "done" && claimResult ? (
            <div className="text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
              <p>+{claimResult.batteries} Batteries added.</p>
              <p className="text-sm text-gray-500">New balance: {claimResult.balance}</p>
              {data.sessionId != null && (
                <div className="pt-2">
                  <SelfReportDialog
                    sessionId={data.sessionId}
                    trigger={
                      <Button variant="outline" className="w-full" data-testid="button-add-details">
                        Add details about your vape
                      </Button>
                    }
                  />
                  <p className="text-xs text-gray-400 mt-1">Optional — helps us recycle better.</p>
                </div>
              )}
              <Button className="w-full mt-2" onClick={() => setLocation("/app")} data-testid="button-wallet">Go to Wallet</Button>
            </div>
          ) : (
            <>
              <Button className="w-full" onClick={doClaim} data-testid="button-claim">Claim {data.batteries} Batteries</Button>
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
