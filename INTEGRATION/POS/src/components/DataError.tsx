import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logTechnicalError, userFacingError } from "@/lib/errors";

type Props = {
  /** What failed, in plain words. e.g. "Transactions could not be loaded" */
  title: string;
  error: unknown;
  /** Identifies the failing query in development console output. */
  context: string;
  onRetry?: () => void;
  className?: string;
};

/**
 * The single place a failed data load is rendered, so no page can quietly
 * degrade a failure into an empty list, zero sales, or "no records".
 */
export function DataError({ title, error, context, onRetry, className }: Props) {
  useEffect(() => {
    logTechnicalError(context, error);
  }, [context, error]);

  return (
    <Card className={`border-destructive/30 bg-destructive/5 p-6 text-center ${className ?? ""}`}>
      <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" />
      <p className="font-semibold text-destructive">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{userFacingError(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}
