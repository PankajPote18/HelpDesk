import { useState } from "react";
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

const mobileNavLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `text-sm py-2 ${
    isActive ? "text-foreground font-medium" : "text-muted-foreground"
  }`;

export function Navbar() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const role = (session?.user as UserWithRole | undefined)?.role;
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await authClient.signOut();
    navigate("/login");
  };

  return (
    <nav className="bg-card border-b border-border relative">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-5 sm:gap-7">
          <Link to="/" className="font-serif text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity">
            Helpdesk
          </Link>
          {role === "admin" && (
            <div className="hidden md:flex items-center gap-5 sm:gap-7">
              <NavLink to="/tickets" className={navLinkClassName}>
                Tickets
              </NavLink>
              <NavLink to="/users" className={navLinkClassName}>
                Users
              </NavLink>
            </div>
          )}
        </div>
        <div className="hidden md:flex items-center gap-4">
          {session && (
            <span className="text-sm text-muted-foreground max-w-[10rem] truncate">
              {session.user.name}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden border-t border-border px-4 sm:px-6 py-3 flex flex-col gap-1 bg-card">
          {role === "admin" && (
            <>
              <NavLink to="/tickets" className={mobileNavLinkClassName} onClick={() => setMenuOpen(false)}>
                Tickets
              </NavLink>
              <NavLink to="/users" className={mobileNavLinkClassName} onClick={() => setMenuOpen(false)}>
                Users
              </NavLink>
            </>
          )}
          {session && (
            <span className="text-sm text-muted-foreground py-2 border-t border-border mt-1 pt-3">
              {session.user.name}
            </span>
          )}
          <Button variant="outline" size="sm" className="mt-1 w-full" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      )}
    </nav>
  );
}
