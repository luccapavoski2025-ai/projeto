import React from "react";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function KpiCard({ label, value, icon: Icon, trend, hint, testId }) {
  const isUp = trend > 0;
  return (
    <Card data-testid={testId} className="p-6 border border-border shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="font-display text-3xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
          {Icon && <Icon className="h-5 w-5" />}
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5",
              isUp ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
            )}
          >
            {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
