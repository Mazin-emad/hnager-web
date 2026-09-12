import { ShieldX } from "lucide-react";
import { useAuth } from "./AuthContext";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Element guard: hides/shows UI by permission string (e.g. "users:read").
 * Admins pass every check. The API enforces this server-side — this is
 * display gating only.
 */
export function RequirePermission({
  permission,
  children,
  fallback,
}: {
  permission?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasPermission } = useAuth();
  if (hasPermission(permission)) return <>{children}</>;
  return <>{fallback ?? null}</>;
}

export function AccessDenied({ what }: { what?: string }) {
  return (
    <Card className="mx-auto mt-16 max-w-md border-destructive/30">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldX className="size-6" />
        </span>
        <h2 className="text-lg font-bold">غير مصرّح لك</h2>
        <p className="text-sm text-muted-foreground">
          {what ?? "لا تملك الصلاحية اللازمة لعرض هذه الصفحة."}
        </p>
      </CardContent>
    </Card>
  );
}
