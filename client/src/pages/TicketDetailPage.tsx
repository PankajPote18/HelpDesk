import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TicketStatus, TicketCategory } from "@helpdesk/core";
import { Navbar } from "@/components/Navbar";
import { ReplyThread } from "@/components/ReplyThread";
import { TicketDetail } from "@/components/TicketDetail";
import { UpdateTicket } from "@/components/UpdateTicket";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Ticket, Agent, Reply } from "@/types/ticket";

async function fetchTicket(id: string): Promise<Ticket> {
  const { data } = await axios.get<Ticket>(`/api/tickets/${id}`, { withCredentials: true });
  return data;
}

async function fetchAgents(): Promise<Agent[]> {
  const { data } = await axios.get<Agent[]>("/api/tickets/agents", { withCredentials: true });
  return data;
}

async function assignTicket(id: string, assignedToId: string | null): Promise<Ticket> {
  const { data } = await axios.patch<Ticket>(
    `/api/tickets/${id}/assign`,
    { assignedToId },
    { withCredentials: true }
  );
  return data;
}

async function updateTicketStatus(id: string, status: TicketStatus): Promise<Ticket> {
  const { data } = await axios.patch<Ticket>(
    `/api/tickets/${id}/status`,
    { status },
    { withCredentials: true }
  );
  return data;
}

async function updateTicketCategory(id: string, category: TicketCategory | null): Promise<Ticket> {
  const { data } = await axios.patch<Ticket>(
    `/api/tickets/${id}/category`,
    { category },
    { withCredentials: true }
  );
  return data;
}

async function createReply(id: string, body: string): Promise<Reply> {
  const { data } = await axios.post<Reply>(
    `/api/tickets/${id}/replies`,
    { body },
    { withCredentials: true }
  );
  return data;
}

function getErrorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) ? (err.response?.data?.error ?? fallback) : fallback;
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: ticket, isLoading, error: fetchError } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const replies = ticket?.replies ?? [];

  const onMutationSuccess = (updated: Ticket) => {
    queryClient.setQueryData(["ticket", id], updated);
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
  };

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) => assignTicket(id!, assignedToId),
    onSuccess: onMutationSuccess,
  });

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) => updateTicketStatus(id!, status),
    onSuccess: onMutationSuccess,
  });

  const categoryMutation = useMutation({
    mutationFn: (category: TicketCategory | null) => updateTicketCategory(id!, category),
    onSuccess: onMutationSuccess,
  });

  const replyMutation = useMutation({
    mutationFn: (body: string) => createReply(id!, body),
    onSuccess: (reply: Reply) => {
      queryClient.setQueryData<Ticket | undefined>(["ticket", id], (old) =>
        old ? { ...old, replies: [...(old.replies ?? []), reply] } : old
      );
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to tickets
        </Link>

        {isLoading && (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {fetchError && (
          <p className="mt-6 text-sm text-destructive">
            {getErrorMessage(fetchError, "Failed to load ticket")}
          </p>
        )}

        {ticket && (
          <Card className="mt-6">
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8">
                <TicketDetail ticket={ticket} />

                <UpdateTicket
                  status={{
                    value: ticket.status,
                    onChange: (status) => statusMutation.mutate(status),
                    isPending: statusMutation.isPending,
                    errorMessage: statusMutation.isError
                      ? getErrorMessage(statusMutation.error, "Failed to update status")
                      : null,
                  }}
                  category={{
                    value: ticket.category,
                    onChange: (category) => categoryMutation.mutate(category),
                    isPending: categoryMutation.isPending,
                    errorMessage: categoryMutation.isError
                      ? getErrorMessage(categoryMutation.error, "Failed to update category")
                      : null,
                  }}
                  assignedTo={{
                    value: ticket.assignedTo?.id ?? null,
                    onChange: (assignedToId) => assignMutation.mutate(assignedToId),
                    isPending: assignMutation.isPending,
                    errorMessage: assignMutation.isError
                      ? getErrorMessage(assignMutation.error, "Failed to assign ticket")
                      : null,
                    agents,
                  }}
                />
              </div>

              <ReplyThread
                replies={replies}
                onSubmit={(body) => replyMutation.mutateAsync(body)}
                isSubmitting={replyMutation.isPending}
                errorMessage={
                  replyMutation.isError ? getErrorMessage(replyMutation.error, "Failed to send reply") : null
                }
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
