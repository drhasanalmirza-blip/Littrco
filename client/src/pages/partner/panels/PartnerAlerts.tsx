import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiJson";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";

interface Alert {
  id: number;
  deviceId: number | null;
  type: string;
  severity: string | null;
  message: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

function severityVariant(s?: string | null): "default" | "secondary" | "destructive" | "outline" {
  const v = (s || "").toUpperCase();
  if (v === "CRITICAL" || v === "HIGH" || v === "FIRE") return "destructive";
  if (v === "WARNING" || v === "MEDIUM" || v === "WARN") return "default";
  return "secondary";
}

export default function PartnerAlerts({ shopId, enabled }: { shopId: number; enabled: boolean }) {
  const [activeOnly, setActiveOnly] = useState(true);
  const gated = enabled && shopId > 0;

  const url = `/api/partner/shops/${shopId}/alerts?limit=100${activeOnly ? "&active=true" : ""}`;

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: [url],
    queryFn: () => apiJson<Alert[]>(url),
    enabled: gated,
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Alerts
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={activeOnly ? "default" : "outline"}
              onClick={() => setActiveOnly(true)}
              data-testid="button-alerts-active"
            >
              Active
            </Button>
            <Button
              size="sm"
              variant={!activeOnly ? "default" : "outline"}
              onClick={() => setActiveOnly(false)}
              data-testid="button-alerts-all"
            >
              All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              {activeOnly ? "No active alerts. All bins are healthy." : "No alerts on record."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id} data-testid={`row-alert-${a.id}`}>
                    <TableCell>
                      <Badge variant={severityVariant(a.severity)}>{a.severity || "—"}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.type}</TableCell>
                    <TableCell className="max-w-xs text-sm">{a.message || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {a.deviceId != null ? `#${a.deviceId}` : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-gray-500">
                      {new Date(a.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {a.resolvedAt ? (
                        <Badge variant="outline">Resolved</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
