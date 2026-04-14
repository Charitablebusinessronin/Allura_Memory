"use client";

import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle, XCircle, MinusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { ComponentHealth } from "@/app/api/health/route";

function StatusBadge({ status }: { status: string }) {
  if (status === "healthy") {
    return (
      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400">
        <CheckCircle className="size-3 mr-1" />
        healthy
      </Badge>
    );
  }
  if (status === "degraded") {
    return (
      <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:text-yellow-400">
        <MinusCircle className="size-3 mr-1" />
        degraded
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <XCircle className="size-3 mr-1" />
      unhealthy
    </Badge>
  );
}

function RefreshButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.refresh()}
    >
      <RefreshCw className="size-3.5 mr-1.5" />
      Refresh
    </Button>
  );
}

function HealthTableContent({ components }: { components: ComponentHealth[] }) {
  if (components.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No component data available. The health endpoint may be unreachable.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Latency (ms)</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {components.map((component) => (
            <TableRow key={component.name}>
              <TableCell className="font-mono text-xs">{component.name}</TableCell>
              <TableCell>
                <StatusBadge status={component.status} />
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {component.latency != null ? `${component.latency}ms` : "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                {component.message ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export const HealthTable = Object.assign(HealthTableContent, { RefreshButton });
