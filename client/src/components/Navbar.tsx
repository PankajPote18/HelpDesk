import { Link, NavLink, useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type UserWithRole = { role: "admin" | "agent" };

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `text-sm pb-0.5 border-b-2 transition-colors ${
    isActive
      ? "text-foreground border-primary font-medium"
      : "text-muted-foreground border-transparent hover:text-foreground"
  }`;

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
      <div className="flex items-center gap-7">
        <Link to="/" className="font-serif text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity">
          Helpdesk
        </Link>
        {role === "admin" && (
          <>
            <NavLink to="/tickets" className={navLinkClassName}>
              Tickets
            </NavLink>
            <NavLink to="/users" className={navLinkClassName}>
              Users
            </NavLink>
          </>
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
