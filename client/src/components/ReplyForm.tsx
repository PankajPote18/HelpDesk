import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type ReplyFormProps = {
  onSubmit: (body: string) => Promise<unknown>;
  isSubmitting?: boolean;
  errorMessage?: string | null;
};

export function ReplyForm({ onSubmit, isSubmitting = false, errorMessage = null }: ReplyFormProps) {
  const [body, setBody] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    try {
      await onSubmit(trimmed);
      setBody("");
    } catch {
      // Submission failed — keep the draft so the user doesn't lose it.
      // The caller is responsible for surfacing the error via `errorMessage`.
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="reply-body" className="block text-sm text-muted-foreground">
        Add a reply
      </label>
      <Textarea
        id="reply-body"
        rows={4}
        value={body}
        disabled={isSubmitting}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply to the requester..."
      />
      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !body.trim()}>
          {isSubmitting ? "Sending..." : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
