import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";

export function Navbar() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate("/login");
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <span className="text-lg font-semibold text-gray-900">Helpdesk</span>
      <div className="flex items-center gap-4">
        {session && (
          <span className="text-sm text-gray-600">{session.user.name}</span>
        )}
        <button
          onClick={handleSignOut}
          className="text-sm font-medium text-gray-700 hover:text-gray-900 underline"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
