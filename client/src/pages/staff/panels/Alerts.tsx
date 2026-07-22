import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

interface Alert {
  id: number;
  deviceId: number;
  shopId: number | null;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

// Custom severity coloring (Badge has no yellow/gray variant).
const SEVERITY_CLASS: Record<Alert["severity"], string> = {
  INFO: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  WARNING: "bg-yellow-200 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-300",
  CRITICAL: "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300",
};

export default function Alerts({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showResolved, setShowResolved] = useState(false);

  // active=true -> unresolved rows; active=false -> resolved rows.
  const activeParam = showResolved ? "false" : "true";
  const url = `/api/staff/alerts?active=${activeParam}&limit=200`;

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: [url],
    queryFn: () => apiJson<Alert[]>(url),
    enabled,
    refetchInterval: 10000,
  });

  const resolve = useMutation({
    mutationFn: (id: number) => apiSend(`/api/staff/alerts/${id}/resolve`, "POST"),
    onSuccess: () => {
      toast({ title: "Alert resolved" });
      qc.invalidateQueries({ queryKey: [url] });
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Alerts</CardTitle>
        <div className="flex gap-2">
          <Button
            variant={showResolved ? "outline" : "default"}
            size="sm"
            onClick={() => setShowResolved(false)}
            data-testid="button-alerts-active"
          >
            Active
          </Button>
          <Button
            variant={showResolved ? "default" : "outline"}
            size="sm"
            onClick={() => setShowResolved(true)}
            data-testid="button-alerts-resolved"
          >
            Resolved
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-gray-500">
            No {showResolved ? "resolved" : "active"} alerts.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id} data-testid={`row-alert-${a.id}`}>
                    <TableCell>
                      <Badge className={cn("border-transparent", SEVERITY_CLASS[a.severity])}>
                        {a.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{a.type}</TableCell>
                    <TableCell className="whitespace-nowrap">#{a.deviceId}</TableCell>
                    <TableCell className="max-w-md">{a.message}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-gray-500">
                      {new Date(a.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {a.resolvedAt ? (
                        <Badge variant="outline">Resolved</Badge>
                      ) : (
                        <Badge variant="secondary">Open</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!a.resolvedAt && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolve.mutate(a.id)}
                          disabled={resolve.isPending}
                          data-testid={`button-resolve-${a.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
