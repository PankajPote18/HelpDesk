import { z } from "zod";

export const inboundEmailSchema = z.object({
  from: z.string().email("Invalid sender email address"),
  fromName: z.string().min(1).optional(),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  messageId: z.string().min(1, "messageId is required"),
  inReplyTo: z.string().min(1).optional(),
});

export type InboundEmailInput = z.infer<typeof inboundEmailSchema>;
