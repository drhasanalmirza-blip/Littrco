import type { ReactNode } from "react";
import { useRoute, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { useStore, type User } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, CheckCircle2, AlertCircle, Loader2, UserPlus, LogIn } from "lucide-react";

interface AcceptResult {
  ok: boolean;
  shopId: number;
  role: string;
}

/**
 * Standalone page at /partner/invite/:token — renders chromeless (path starts with /partner).
 * Accepts a partner shop invite for the signed-in user; falls back to a login/register
 * prompt (carrying ?next=) when signed out, mirroring customer/Claim.tsx.
 */
export default function InviteAccept() {
  const [, params] = useRoute("/partner/invite/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();
  const { user, setAuth } = useStore();

  const next = `/partner/invite/${token}`;

  const accept = useMutation<AcceptResult>({
    mutationFn: async () => apiSend<AcceptResult>("/api/invites/accept", "POST", { token }),
    onSuccess: async () => {
      // Accepting a partner invite promotes a CUSTOMER to PARTNER server-side. The
      // store's lowercase `role` is only recomputed inside setAuth, so refresh the
      // session here before the user navigates — otherwise the Partner Dashboard
      // gate still sees role='customer' and bounces them to a login fallback.
      try {
        const me = await apiJson<{ user: User }>("/api/auth/me");
        const sid = useStore.getState().sessionId;
        if (sid) setAuth(me.user, sid);
      } catch {
        // Non-fatal: navigation still works, and a full reload would re-hydrate the
        // promoted role from the persisted session even if this refresh failed.
      }
    },
  });

  const Shell = ({ children }: { children: ReactNode }) => (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-950 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">{children}</Card>
    </div>
  );

  // Signed out — login fallback carrying ?next= back to this invite page.
  if (!user) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-center text-2xl">
            <Store className="h-6 w-6 text-green-500" />
            Team Invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            You've been invited to join a LITTR partner shop. Sign in or create an account to
            accept this invitation.
          </p>
          <div className="space-y-2">
            <Button
              className="w-full gap-2"
              onClick={() => setLocation(`/app/login?next=${encodeURIComponent(next)}`)}
              data-testid="button-signin"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setLocation(`/app/register?next=${encodeURIComponent(next)}`)}
              data-testid="button-register"
            >
              <UserPlus className="h-4 w-4" />
              Create Account
            </Button>
          </div>
        </CardContent>
      </Shell>
    );
  }

  // Accepted.
  if (accept.isSuccess && accept.data) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-center text-2xl">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            Invitation Accepted
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You've joined{" "}
            <strong>Shop #{accept.data.shopId}</strong> as{" "}
            <strong>{accept.data.role}</strong>.
          </p>
          <Button
            className="w-full"
            onClick={() => setLocation("/partner/dashboard")}
            data-testid="button-go-dashboard"
          >
            Go to Partner Dashboard
          </Button>
        </CardContent>
      </Shell>
    );
  }

  // Error — the server returns a descriptive message per status:
  // 404 invalid invite, 409 already used, 410 invite expired, 400 token required.
  if (accept.isError) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-center text-2xl">
            <AlertCircle className="h-6 w-6 text-red-500" />
            Can't Accept Invite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="text-invite-error">
            {(accept.error as Error)?.message || "This invitation could not be accepted."}
          </p>
          <p className="text-xs text-gray-500">
            The invite may be invalid, already used, or expired. Ask the shop owner to send a new one.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLocation("/partner/dashboard")}
            data-testid="button-go-dashboard"
          >
            Go to Partner Dashboard
          </Button>
        </CardContent>
      </Shell>
    );
  }

  // Idle — offer to accept.
  return (
    <Shell>
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-center text-2xl">
          <Store className="h-6 w-6 text-green-500" />
          Accept Invitation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-center text-gray-600 dark:text-gray-400">
          Signed in as <strong>{user.email}</strong>. Accept this invitation to join the shop team.
        </p>
        <Button
          className="w-full"
          onClick={() => accept.mutate()}
          disabled={accept.isPending || !token}
          data-testid="button-accept-invite"
        >
          {accept.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Accepting...
            </>
          ) : (
            "Accept Invitation"
          )}
        </Button>
      </CardContent>
    </Shell>
  );
}
