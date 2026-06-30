import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";

type UserWithRole = { role: "admin" | "agent" };

export function AdminRoute({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const user = session?.user as (typeof session.user & UserWithRole) | undefined;

  if (!session || user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
