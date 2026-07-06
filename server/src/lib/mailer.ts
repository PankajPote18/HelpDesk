import sgMail from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function sendTicketReplyEmail(to: string, subject: string, body: string): Promise<void> {
  const replySubject = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
  await sgMail.send({
    to,
    from: process.env.SENDGRID_FROM_EMAIL!,
    subject: replySubject,
    text: body,
  });
}
