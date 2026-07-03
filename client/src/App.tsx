import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { TicketsPage } from "@/pages/TicketsPage";
import { UsersPage } from "@/pages/UsersPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <TicketsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/users",
    element: (
      <AdminRoute>
        <UsersPage />
      </AdminRoute>
    ),
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
