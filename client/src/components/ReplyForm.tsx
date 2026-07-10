import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type ReplyFormProps = {
  onSubmit: (body: string) => Promise<unknown>;
  onPolish: (body: string) => Promise<{ text: string }>;
  isSubmitting?: boolean;
  isPolishing?: boolean;
  errorMessage?: string | null;
  polishErrorMessage?: string | null;
};

export function ReplyForm({
  onSubmit,
  onPolish,
  isSubmitting = false,
  isPolishing = false,
  errorMessage = null,
  polishErrorMessage = null,
}: ReplyFormProps) {
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

  const handlePolish = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    try {
      const { text } = await onPolish(trimmed);
      setBody(text);
    } catch {
      // Polish failed — keep the draft untouched; the caller surfaces the
      // error via `polishErrorMessage`.
    }
  };

  const disabled = isSubmitting || isPolishing;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="reply-body" className="block text-sm text-muted-foreground">
        Add a reply
      </label>
      <Textarea
        id="reply-body"
        rows={4}
        value={body}
        disabled={disabled}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply to the requester..."
      />
      {polishErrorMessage && <p className="text-xs text-destructive">{polishErrorMessage}</p>}
      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-muted-foreground">Polish tightens tone and clarity — your words stay yours.</p>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="text-primary border-primary/30 hover:bg-primary/5 hover:text-primary"
            disabled={disabled || !body.trim()}
            onClick={handlePolish}
          >
            <Sparkles /> {isPolishing ? "Polishing..." : "Polish"}
          </Button>
          <Button type="submit" disabled={disabled || !body.trim()}>
            {isSubmitting ? "Sending..." : "Send reply"}
          </Button>
        </div>
      </div>
    </form>
  );
}
