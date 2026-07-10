import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { createUserSchema, editUserSchema, type CreateUserInput, type EditUserInput } from "@helpdesk/core";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agent";
  createdAt: string;
};

async function fetchUsers(): Promise<User[]> {
  const { data } = await axios.get<User[]>("/api/users", { withCredentials: true });
  return data;
}

async function createUser(input: CreateUserInput): Promise<User> {
  const { data } = await axios.post<User>("/api/users", input, { withCredentials: true });
  return data;
}

async function editUser({ id, input }: { id: string; input: EditUserInput }): Promise<User> {
  const { data } = await axios.patch<User>(`/api/users/${id}`, input, { withCredentials: true });
  return data;
}

async function deleteUser(id: string): Promise<void> {
  await axios.delete(`/api/users/${id}`, { withCredentials: true });
}

function getErrorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) ? (err.response?.data?.error ?? fallback) : fallback;
}

export function UsersPage() {
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { data: users = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const createForm = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  });

  const editForm = useForm<EditUserInput>({
    resolver: zodResolver(editUserSchema),
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (newUser) => {
      queryClient.setQueryData<User[]>(["users"], (prev = []) => [...prev, newUser]);
      createForm.reset();
      setShowCreateModal(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: editUser,
    onSuccess: (updated) => {
      queryClient.setQueryData<User[]>(["users"], (prev = []) =>
        prev.map((u) => (u.id === updated.id ? updated : u))
      );
      editForm.reset();
      setEditingUser(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: (_data, id) => {
      queryClient.setQueryData<User[]>(["users"], (prev = []) => prev.filter((u) => u.id !== id));
      setUserToDelete(null);
    },
  });

  function openCreateModal() {
    createForm.reset();
    createMutation.reset();
    setShowCreateModal(true);
  }

  function openEditModal(user: User) {
    editForm.reset({ name: user.name, email: user.email, password: "" });
    editMutation.reset();
    setEditingUser(user);
  }

  function openDeleteModal(user: User) {
    deleteMutation.reset();
    setUserToDelete(user);
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <h1 className="text-2xl font-bold">Users</h1>
          <Button onClick={openCreateModal}>Create user</Button>
        </div>

        {isLoading && (
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-20 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {fetchError && (
          <p className="text-sm text-destructive">
            {getErrorMessage(fetchError, "Failed to load users")}
          </p>
        )}

        {!isLoading && !fetchError && (
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                )}
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={
                        user.role === "admin"
                          ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary"
                          : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground"
                      }>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(user)}
                          aria-label={`Edit ${user.name}`}
                        >
                          <Pencil />
                        </Button>
                        {user.role !== "admin" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openDeleteModal(user)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}
        >
          <div className="bg-card rounded-xl border shadow-lg w-full max-w-md my-auto p-6">
            <h2 className="text-lg font-semibold mb-1">Create agent</h2>
            <p className="text-sm text-muted-foreground mb-5">
              New users are created with the agent role.
            </p>
            <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="create-name">Name</Label>
                <Input id="create-name" placeholder="Jane Smith" {...createForm.register("name")} />
                {createForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="create-email">Email</Label>
                <Input id="create-email" type="email" placeholder="jane@example.com" {...createForm.register("email")} />
                {createForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="create-password">Password</Label>
                <Input id="create-password" type="password" placeholder="Min. 8 characters" {...createForm.register("password")} />
                {createForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.password.message}</p>
                )}
              </div>
              {createMutation.isError && (
                <p className="text-sm text-destructive">
                  {getErrorMessage(createMutation.error, "Failed to create user")}
                </p>
              )}
              <div className="flex justify-end gap-2 mt-1">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} disabled={createMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create user"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingUser(null); }}
        >
          <div className="bg-card rounded-xl border shadow-lg w-full max-w-md my-auto p-6">
            <h2 className="text-lg font-semibold mb-1">Edit user</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Leave the password field empty to keep the current password.
            </p>
            <form
              onSubmit={editForm.handleSubmit((data) => editMutation.mutate({ id: editingUser.id, input: data }))}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" placeholder="Jane Smith" {...editForm.register("name")} />
                {editForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" placeholder="jane@example.com" {...editForm.register("email")} />
                {editForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-password">New password</Label>
                <Input id="edit-password" type="password" placeholder="Leave empty to keep current" {...editForm.register("password")} />
                {editForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.password.message}</p>
                )}
              </div>
              {editMutation.isError && (
                <p className="text-sm text-destructive">
                  {getErrorMessage(editMutation.error, "Failed to update user")}
                </p>
              )}
              <div className="flex justify-end gap-2 mt-1">
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)} disabled={editMutation.isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {userToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setUserToDelete(null); }}
        >
          <div className="bg-card rounded-xl border shadow-lg w-full max-w-sm my-auto p-6">
            <h2 className="text-lg font-semibold mb-2">Delete user</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to deactivate{" "}
              <span className="font-medium text-foreground">{userToDelete.name}</span>?
              They will no longer be able to sign in.
            </p>
            {deleteMutation.isError && (
              <p className="text-sm text-destructive mb-4">
                {getErrorMessage(deleteMutation.error, "Failed to delete user")}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setUserToDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(userToDelete.id)}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
