import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type UserWithRole = { role: "admin" | "agent" };

export function Navbar() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const role = (session?.user as UserWithRole | undefined)?.role;

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate("/login");
  };

  return (
    <nav className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold">Helpdesk</span>
        {role === "admin" && (
          <Link
            to="/users"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Users
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        {session && (
          <span className="text-sm text-muted-foreground">
            {session.user.name}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </nav>
  );
}
