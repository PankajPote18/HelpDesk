import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import type { TicketStatus, TicketCategory } from "@helpdesk/core";
import { Navbar } from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

type Ticket = {
  id: string;
  subject: string;
  status: TicketStatus;
  category: TicketCategory | null;
  requesterEmail: string;
  requesterName: string | null;
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
};

const statusStyles: Record<TicketStatus, string> = {
  open: "bg-primary/10 text-primary",
  resolved: "bg-emerald-500/10 text-emerald-600",
  closed: "bg-muted text-muted-foreground",
};

async function fetchTickets(): Promise<Ticket[]> {
  const { data } = await axios.get<Ticket[]>("/api/tickets", { withCredentials: true });
  return data;
}

function getErrorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) ? (err.response?.data?.error ?? fallback) : fallback;
}

export function TicketsPage() {
  const { data: tickets = [], isLoading, error: fetchError } = useQuery({
    queryKey: ["tickets"],
    queryFn: fetchTickets,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Tickets</h1>
        </div>

        {isLoading && (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Requester</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned to</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {fetchError && (
          <p className="text-sm text-destructive">
            {getErrorMessage(fetchError, "Failed to load tickets")}
          </p>
        )}

        {!isLoading && !fetchError && (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Requester</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Assigned to</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No tickets found.
                    </td>
                  </tr>
                )}
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{ticket.subject}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ticket.requesterName ? `${ticket.requesterName} <${ticket.requesterEmail}>` : ticket.requesterEmail}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[ticket.status]}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ticket.assignedTo?.name ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
