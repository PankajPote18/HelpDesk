import { authClient } from "@/lib/auth-client";
import { DashboardPage } from "@/pages/DashboardPage";
import { TicketsPage } from "@/pages/TicketsPage";

type UserWithRole = { role: "admin" | "agent" };

export function HomeRoute() {
  const { data: session } = authClient.useSession();
  const role = (session?.user as UserWithRole | undefined)?.role;

  return role === "admin" ? <DashboardPage /> : <TicketsPage />;
}
