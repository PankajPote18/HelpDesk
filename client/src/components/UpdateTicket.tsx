import {
  manualTicketStatusSchema,
  ticketCategorySchema,
  type TicketStatus,
  type ManualTicketStatus,
  type TicketCategory,
} from "@helpdesk/core";
import { statusLabels, categoryLabels, formatCategory } from "@/lib/ticket-format";
import type { Agent } from "@/types/ticket";

type FieldState<T> = {
  value: T;
  onChange: (value: T) => void;
  isPending?: boolean;
  errorMessage?: string | null;
};

type UpdateTicketProps = {
  status: {
    value: TicketStatus;
    onChange: (value: ManualTicketStatus) => void;
    isPending?: boolean;
    errorMessage?: string | null;
  };
  category: FieldState<TicketCategory | null>;
  assignedTo: FieldState<string | null> & { agents: Agent[] };
};

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50";

export function UpdateTicket({ status, category, assignedTo }: UpdateTicketProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="ticket-status" className="block text-sm text-muted-foreground mb-1">
          Status
        </label>
        <select
          id="ticket-status"
          className={selectClassName}
          value={status.value}
          disabled={status.isPending}
          onChange={(e) => status.onChange(e.target.value as ManualTicketStatus)}
        >
          {manualTicketStatusSchema.options.map((option) => (
            <option key={option} value={option}>
              {statusLabels[option]}
            </option>
          ))}
        </select>
        {status.errorMessage && <p className="mt-1 text-xs text-destructive">{status.errorMessage}</p>}
      </div>

      <div>
        <label htmlFor="ticket-category" className="block text-sm text-muted-foreground mb-1">
          Category
        </label>
        <select
          id="ticket-category"
          className={selectClassName}
          value={category.value ?? ""}
          disabled={category.isPending}
          onChange={(e) => category.onChange((e.target.value || null) as TicketCategory | null)}
        >
          <option value="">{formatCategory(null)}</option>
          {ticketCategorySchema.options.map((option) => (
            <option key={option} value={option}>
              {categoryLabels[option]}
            </option>
          ))}
        </select>
        {category.errorMessage && <p className="mt-1 text-xs text-destructive">{category.errorMessage}</p>}
      </div>

      <div>
        <label htmlFor="ticket-assignee" className="block text-sm text-muted-foreground mb-1">
          Assigned to
        </label>
        <select
          id="ticket-assignee"
          className={selectClassName}
          value={assignedTo.value ?? ""}
          disabled={assignedTo.isPending}
          onChange={(e) => assignedTo.onChange(e.target.value || null)}
        >
          <option value="">Unassigned</option>
          {assignedTo.agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        {assignedTo.errorMessage && <p className="mt-1 text-xs text-destructive">{assignedTo.errorMessage}</p>}
      </div>
    </div>
  );
}
