import { useState } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ticketStatusSchema,
  ticketCategorySchema,
  type TicketStatus,
  type TicketCategory,
} from "@helpdesk/core";
import { Navbar } from "@/components/Navbar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { statusLabels, categoryLabels, formatCategory } from "@/lib/ticket-format";

type Agent = { id: string; name: string };

type Reply = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
};

type TicketDetail = {
  id: string;
  subject: string;
  body: string;
  status: TicketStatus;
  category: TicketCategory | null;
  requesterEmail: string;
  requesterName: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string } | null;
  replies: Reply[];
};

async function fetchTicket(id: string): Promise<TicketDetail> {
  const { data } = await axios.get<TicketDetail>(`/api/tickets/${id}`, { withCredentials: true });
  return data;
}

async function fetchAgents(): Promise<Agent[]> {
  const { data } = await axios.get<Agent[]>("/api/tickets/agents", { withCredentials: true });
  return data;
}

async function assignTicket(id: string, assignedToId: string | null): Promise<TicketDetail> {
  const { data } = await axios.patch<TicketDetail>(
    `/api/tickets/${id}/assign`,
    { assignedToId },
    { withCredentials: true }
  );
  return data;
}

async function updateTicketStatus(id: string, status: TicketStatus): Promise<TicketDetail> {
  const { data } = await axios.patch<TicketDetail>(
    `/api/tickets/${id}/status`,
    { status },
    { withCredentials: true }
  );
  return data;
}

async function updateTicketCategory(id: string, category: TicketCategory | null): Promise<TicketDetail> {
  const { data } = await axios.patch<TicketDetail>(
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

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50";

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [replyBody, setReplyBody] = useState("");

  const { data: ticket, isLoading, error: fetchError } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const onMutationSuccess = (updated: TicketDetail) => {
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
    onSuccess: (reply) => {
      queryClient.setQueryData<TicketDetail | undefined>(["ticket", id], (old) =>
        old ? { ...old, replies: [...old.replies, reply] } : old
      );
      setReplyBody("");
    },
  });

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyBody.trim();
    if (!trimmed) return;
    replyMutation.mutate(trimmed);
  };

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
            <CardHeader>
              <CardTitle className="text-xl">{ticket.subject}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8">
                {/* Left column: ticket content */}
                <div className="space-y-6">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Requester</dt>
                      <dd>
                        {ticket.requesterName
                          ? `${ticket.requesterName} <${ticket.requesterEmail}>`
                          : ticket.requesterEmail}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Created</dt>
                      <dd>{new Date(ticket.createdAt).toLocaleString()}</dd>
                    </div>
                  </dl>

                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Message</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.body}</p>
                  </div>
                </div>

                {/* Right column: editable dropdowns */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="ticket-status" className="block text-sm text-muted-foreground mb-1">
                      Status
                    </label>
                    <select
                      id="ticket-status"
                      className={selectClassName}
                      value={ticket.status}
                      disabled={statusMutation.isPending}
                      onChange={(e) => statusMutation.mutate(e.target.value as TicketStatus)}
                    >
                      {ticketStatusSchema.options.map((option) => (
                        <option key={option} value={option}>
                          {statusLabels[option]}
                        </option>
                      ))}
                    </select>
                    {statusMutation.isError && (
                      <p className="mt-1 text-xs text-destructive">
                        {getErrorMessage(statusMutation.error, "Failed to update status")}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="ticket-category" className="block text-sm text-muted-foreground mb-1">
                      Category
                    </label>
                    <select
                      id="ticket-category"
                      className={selectClassName}
                      value={ticket.category ?? ""}
                      disabled={categoryMutation.isPending}
                      onChange={(e) =>
                        categoryMutation.mutate((e.target.value || null) as TicketCategory | null)
                      }
                    >
                      <option value="">{formatCategory(null)}</option>
                      {ticketCategorySchema.options.map((option) => (
                        <option key={option} value={option}>
                          {categoryLabels[option]}
                        </option>
                      ))}
                    </select>
                    {categoryMutation.isError && (
                      <p className="mt-1 text-xs text-destructive">
                        {getErrorMessage(categoryMutation.error, "Failed to update category")}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="ticket-assignee" className="block text-sm text-muted-foreground mb-1">
                      Assigned to
                    </label>
                    <select
                      id="ticket-assignee"
                      className={selectClassName}
                      value={ticket.assignedTo?.id ?? ""}
                      disabled={assignMutation.isPending}
                      onChange={(e) => assignMutation.mutate(e.target.value || null)}
                    >
                      <option value="">Unassigned</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                    {assignMutation.isError && (
                      <p className="mt-1 text-xs text-destructive">
                        {getErrorMessage(assignMutation.error, "Failed to assign ticket")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t pt-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">
                  Replies{ticket.replies.length > 0 && ` (${ticket.replies.length})`}
                </h3>

                {ticket.replies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No replies yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {ticket.replies.map((reply) => (
                      <li key={reply.id} className="rounded-lg border bg-muted/20 p-4">
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span className="text-sm font-medium">{reply.author.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(reply.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{reply.body}</p>
                      </li>
                    ))}
                  </ul>
                )}

                <form onSubmit={handleReplySubmit} className="mt-6 space-y-2">
                  <label htmlFor="reply-body" className="block text-sm text-muted-foreground">
                    Add a reply
                  </label>
                  <Textarea
                    id="reply-body"
                    rows={4}
                    value={replyBody}
                    disabled={replyMutation.isPending}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write a reply to the requester..."
                  />
                  {replyMutation.isError && (
                    <p className="text-xs text-destructive">
                      {getErrorMessage(replyMutation.error, "Failed to send reply")}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Button type="submit" disabled={replyMutation.isPending || !replyBody.trim()}>
                      {replyMutation.isPending ? "Sending..." : "Send reply"}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
