import type { Ticket } from "@/types/ticket";

type TicketDetailProps = {
  ticket: Ticket;
};

export function TicketDetail({ ticket }: TicketDetailProps) {
  const { subject, body, requesterEmail, requesterName, createdAt } = ticket;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{subject}</h2>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Requester</dt>
          <dd>{requesterName ? `${requesterName} <${requesterEmail}>` : requesterEmail}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{new Date(createdAt).toLocaleString()}</dd>
        </div>
      </dl>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Message</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{body ?? ""}</p>
      </div>
    </div>
  );
}
