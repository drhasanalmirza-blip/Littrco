import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiJson";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Store } from "lucide-react";
import PartnerPairing from "@/pages/partner/panels/Pairing";

interface Shop { id: number; name: string; city?: string | null }

// Staff pairing (spec W1 / §3.4): staff pick a shop FIRST, then run the exact same
// guided flow the partner uses — the shared panel is reused verbatim, only the
// pair-code POST target and the devices-poll source are pointed at the staff APIs.
// Staff poll /api/staff/devices (all bins) and the shared panel finds the freshly
// paired bin by its deviceId as it goes LIVE.
export default function StaffPairing({ enabled }: { enabled: boolean }) {
  const [shopId, setShopId] = useState<number | null>(null);

  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ["/api/staff/shops"],
    queryFn: () => apiJson<Shop[]>("/api/staff/shops"),
    enabled,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pair a bin for a shop</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Shop</label>
            <Select
              value={shopId != null ? String(shopId) : ""}
              onValueChange={(v) => setShopId(Number(v))}
            >
              <SelectTrigger className="w-full sm:w-96" data-testid="select-pair-shop">
                <SelectValue placeholder="Pick a shop to pair a bin for…" />
              </SelectTrigger>
              <SelectContent>
                {shops.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}{s.city ? ` · ${s.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {shopId == null ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-gray-500">
            <Store className="h-10 w-10 text-gray-400" />
            <div data-testid="text-pick-shop-first">Pick a shop first to generate a pair code.</div>
          </CardContent>
        </Card>
      ) : (
        <PartnerPairing
          key={shopId}
          shopId={shopId}
          enabled={enabled}
          pairCodeUrl={`/api/staff/shops/${shopId}/pair-code`}
          devicesUrl="/api/staff/devices"
        />
      )}
    </div>
  );
}
