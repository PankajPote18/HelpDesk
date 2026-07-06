import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getCoreRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import {
  manualTicketStatusSchema,
  ticketCategorySchema,
  type ManualTicketStatus,
  type TicketCategory,
  type TicketSortField,
  type TicketSortOrder,
} from "@helpdesk/core";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabels, statusStyles, categoryLabels, formatCategory } from "@/lib/ticket-format";
import type { Ticket } from "@/types/ticket";

type TicketListResponse = {
  tickets: Ticket[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 20;

type FetchTicketsParams = {
  sortBy: TicketSortField;
  sortOrder: TicketSortOrder;
  status: ManualTicketStatus | "";
  category: TicketCategory | "";
  page: number;
};

async function fetchTickets({ sortBy, sortOrder, status, category, page }: FetchTicketsParams): Promise<TicketListResponse> {
  const { data } = await axios.get<TicketListResponse>("/api/tickets", {
    withCredentials: true,
    params: {
      sortBy,
      sortOrder,
      status: status || undefined,
      category: category || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
  });
  return data;
}

function getErrorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) ? (err.response?.data?.error ?? fallback) : fallback;
}

const columns: ColumnDef<Ticket>[] = [
  {
    id: "subject",
    header: "Subject",
    accessorKey: "subject",
    cell: ({ row }) => (
      <Link to={`/tickets/${row.original.id}`} className="font-medium hover:underline">
        {row.original.subject}
      </Link>
    ),
  },
  {
    id: "requesterEmail",
    header: "Requester",
    accessorFn: (ticket) =>
      ticket.requesterName ? `${ticket.requesterName} <${ticket.requesterEmail}>` : ticket.requesterEmail,
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    cell: ({ row }) => (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[row.original.status]}`}
      >
        {statusLabels[row.original.status]}
      </span>
    ),
  },
  {
    id: "category",
    header: "Category",
    accessorFn: (ticket) => formatCategory(ticket.category),
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
  },
  {
    id: "assignedTo",
    header: "Assigned to",
    accessorFn: (ticket) => ticket.assignedTo?.name ?? "Unassigned",
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
  },
  {
    id: "createdAt",
    header: "Created",
    accessorKey: "createdAt",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{new Date(row.original.createdAt).toLocaleDateString()}</span>
    ),
  },
];

const selectClassName =
  "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function TicketsPage() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [status, setStatus] = useState<ManualTicketStatus | "">("");
  const [category, setCategory] = useState<TicketCategory | "">("");
  const [page, setPage] = useState(1);

  const sortBy = (sorting[0]?.id ?? "createdAt") as TicketSortField;
  const sortOrder: TicketSortOrder = sorting[0]?.desc ? "desc" : "asc";

  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ["tickets", sortBy, sortOrder, status, category, page],
    queryFn: () => fetchTickets({ sortBy, sortOrder, status, category, page }),
    placeholderData: keepPreviousData,
  });

  const tickets = data?.tickets ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const table = useReactTable({
    data: tickets,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      setPage(1);
      setSorting(updater);
    },
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Tickets</h1>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <select
            aria-label="Filter by status"
            className={selectClassName}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ManualTicketStatus | "");
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {manualTicketStatusSchema.options.map((option) => (
              <option key={option} value={option}>
                {statusLabels[option]}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by category"
            className={selectClassName}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as TicketCategory | "");
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {ticketCategorySchema.options.map((option) => (
              <option key={option} value={option}>
                {categoryLabels[option]}
              </option>
            ))}
          </select>
        </div>

        {isLoading && (
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {columns.map((column) => (
                    <th key={column.id} className="text-left px-4 py-3 font-medium text-muted-foreground">
                      {typeof column.header === "string" ? column.header : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
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
          <>
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b bg-muted/40">
                      {headerGroup.headers.map((header) => {
                        const sorted = header.column.getIsSorted();
                        return (
                          <th key={header.id} className="text-left px-4 py-3 font-medium text-muted-foreground">
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sorted === "asc" && <ArrowUp className="h-3.5 w-3.5" />}
                              {sorted === "desc" && <ArrowDown className="h-3.5 w-3.5" />}
                              {!sorted && <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {tickets.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                        No tickets found.
                      </td>
                    </tr>
                  )}
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {total === 0 ? "0 results" : `Page ${page} of ${totalPages} — ${total} results`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
