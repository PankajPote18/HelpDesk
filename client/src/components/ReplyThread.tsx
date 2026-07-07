import { ReplyForm } from "@/components/ReplyForm";
import type { Reply } from "@/types/ticket";

type ReplyThreadProps = {
  replies: Reply[];
  onSubmit: (body: string) => Promise<unknown>;
  onPolish: (body: string) => Promise<{ text: string }>;
  isSubmitting?: boolean;
  isPolishing?: boolean;
  errorMessage?: string | null;
  polishErrorMessage?: string | null;
};

export function ReplyThread({
  replies,
  onSubmit,
  onPolish,
  isSubmitting,
  isPolishing,
  errorMessage,
  polishErrorMessage,
}: ReplyThreadProps) {
  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">
        Replies{replies.length > 0 && ` (${replies.length})`}
      </h3>

      {replies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No replies yet.</p>
      ) : (
        <ul className="space-y-3">
          {replies.map((reply) => (
            <li key={reply.id} className="rounded-md border border-l-[3px] border-l-primary/50 bg-card p-4">
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

      <div className="mt-6">
        <ReplyForm
          onSubmit={onSubmit}
          onPolish={onPolish}
          isSubmitting={isSubmitting}
          isPolishing={isPolishing}
          errorMessage={errorMessage}
          polishErrorMessage={polishErrorMessage}
        />
      </div>
    </div>
  );
}
