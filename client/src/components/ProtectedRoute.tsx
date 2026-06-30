import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
