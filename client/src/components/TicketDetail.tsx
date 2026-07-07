import type { Ticket } from "@/types/ticket";

type TicketDetailProps = {
  ticket: Ticket;
};

export function TicketDetail({ ticket }: TicketDetailProps) {
  const { subject, body, requesterEmail, requesterName, createdAt } = ticket;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-semibold leading-snug text-balance">{subject}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          From{" "}
          <span className="font-medium text-foreground">
            {requesterName ? `${requesterName} <${requesterEmail}>` : requesterEmail}
          </span>{" "}
          &middot; <span>{new Date(createdAt).toLocaleString()}</span>
        </p>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed border-t border-border pt-5">{body ?? ""}</p>
    </div>
  );
}
