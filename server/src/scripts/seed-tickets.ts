import { TicketCategory, TicketStatus, Role } from "../generated/prisma/enums";
import { db } from "../lib/db";

type Template = {
  subject: string;
  body: string;
  category: TicketCategory | null;
};

const templates: Template[] = [
  // general_question
  { subject: "How do I reset my password?", body: "I'm locked out of my account and the reset email never arrived. Can you help me regain access?", category: TicketCategory.general_question },
  { subject: "Where can I find my invoice history?", body: "I need last quarter's invoices for our finance team but can't find an export option anywhere.", category: TicketCategory.general_question },
  { subject: "Do you offer team or enterprise plans?", body: "We're growing past 20 seats and want to know if there's a volume discount or dedicated support tier.", category: TicketCategory.general_question },
  { subject: "How do I change my billing email?", body: "Our accounts payable email changed and invoices are still going to the old address.", category: TicketCategory.general_question },
  { subject: "What's your data retention policy?", body: "Our security team needs documentation on how long you retain customer data after account closure.", category: TicketCategory.general_question },
  { subject: "Can I export my data to CSV?", body: "I'd like to back up all our tickets and contacts before we evaluate other tools.", category: TicketCategory.general_question },
  { subject: "How do I add a teammate to my workspace?", body: "I don't see an invite button anywhere on the settings page. Am I missing a permission?", category: TicketCategory.general_question },
  { subject: "Is there a mobile app?", body: "Our on-call engineers want to triage tickets from their phones. Is there an iOS or Android app?", category: TicketCategory.general_question },
  { subject: "What time zone are your support hours in?", body: "We're based in Singapore and want to know when live chat is actually staffed.", category: TicketCategory.general_question },
  { subject: "How do I cancel my subscription?", body: "We've decided to go a different direction and need to cancel before the next renewal date.", category: TicketCategory.general_question },
  { subject: "Can I customize the notification emails?", body: "The default email templates don't match our brand. Is there a way to edit the wording or logo?", category: TicketCategory.general_question },
  { subject: "Do you support SSO with Okta?", body: "Our IT department requires SSO for any tool that touches customer data. Wondering if Okta is supported.", category: TicketCategory.general_question },

  // technical_question
  { subject: "API returns 500 error on /v1/orders endpoint", body: "Every request to /v1/orders has been failing with a 500 since this morning. Here's a sample request ID: 8f2a-91cd.", category: TicketCategory.technical_question },
  { subject: "Webhook deliveries failing intermittently", body: "About 1 in 10 webhook events never arrive at our endpoint, even though our server returns 200 quickly.", category: TicketCategory.technical_question },
  { subject: "SSO login redirects to a blank page", body: "After entering credentials in our IdP, the redirect back to your app just shows a white screen.", category: TicketCategory.technical_question },
  { subject: "Dashboard charts not loading in Safari", body: "The analytics charts spin forever on Safari 17 but work fine in Chrome. Console shows a CORS error.", category: TicketCategory.technical_question },
  { subject: "Rate limit errors during bulk import", body: "We're getting 429s halfway through importing 5,000 records even though we're throttling to 5 req/sec.", category: TicketCategory.technical_question },
  { subject: "OAuth token refresh not working", body: "Refresh tokens issued last week stopped working today — every refresh attempt returns invalid_grant.", category: TicketCategory.technical_question },
  { subject: "CSV export truncates after 1000 rows", body: "Exporting our ticket list only ever includes the first 1000 rows regardless of the actual total.", category: TicketCategory.technical_question },
  { subject: "Search results are stale after update", body: "When I edit a ticket's subject, the old subject still shows up in search results for several minutes.", category: TicketCategory.technical_question },
  { subject: "Mobile app crashes on file upload", body: "Attaching a photo to a ticket reply crashes the Android app every time, even on a fresh install.", category: TicketCategory.technical_question },
  { subject: "Integration with Slack stopped posting messages", body: "Our #support-alerts channel hasn't received a new ticket notification in two days. The integration still shows as connected.", category: TicketCategory.technical_question },
  { subject: "Custom domain SSL certificate not renewing", body: "The SSL cert for our custom support subdomain expired and the auto-renew doesn't seem to have kicked in.", category: TicketCategory.technical_question },
  { subject: "GraphQL query timing out on large accounts", body: "Any account with more than ~2000 tickets times out when we query the ticket connection with nested fields.", category: TicketCategory.technical_question },

  // refund_request
  { subject: "Charged twice for December invoice", body: "Our card was charged twice on the same day for December — can you confirm and refund the duplicate?", category: TicketCategory.refund_request },
  { subject: "Requesting refund for accidental annual upgrade", body: "I meant to click monthly but accidentally upgraded to annual billing. Can this be reversed?", category: TicketCategory.refund_request },
  { subject: "Cancelled last month but still billed", body: "I cancelled on the 3rd and got a confirmation email, but was charged again on the 1st of this month.", category: TicketCategory.refund_request },
  { subject: "Refund for unused seats after downgrade", body: "We downgraded from 50 to 20 seats mid-cycle and were told the difference would be refunded pro-rata.", category: TicketCategory.refund_request },
  { subject: "Duplicate charge on card ending 4242", body: "I see two identical charges of $199 posted an hour apart on my statement.", category: TicketCategory.refund_request },
  { subject: "Refund request due to last week's outage", body: "Given the four-hour outage last Tuesday, we'd like a partial refund or credit for that billing period.", category: TicketCategory.refund_request },
  { subject: "Never received access after purchase", body: "I paid for the Pro plan three days ago but my account is still showing as Free tier.", category: TicketCategory.refund_request },
  { subject: "Billing error — charged wrong plan tier", body: "We signed up for Starter but were billed at the Business rate. Please correct and refund the difference.", category: TicketCategory.refund_request },
  { subject: "Refund for annual plan cancelled within 14 days", body: "We're within your 14-day money-back window for the annual plan and would like a full refund.", category: TicketCategory.refund_request },
  { subject: "Overcharged due to proration bug", body: "After adding 3 seats mid-month, the invoice charged us for a full month on all seats instead of prorating.", category: TicketCategory.refund_request },
  { subject: "Refund for trial that converted without warning", body: "The trial converted to a paid plan without any reminder email. We'd like this refunded and cancelled.", category: TicketCategory.refund_request },
  { subject: "Requesting credit for double invoice number 4471", body: "Invoice #4471 appears twice in our billing portal with the same amount charged twice.", category: TicketCategory.refund_request },

  // unclassified / null category
  { subject: "Question about my account", body: "I have a general question about my account setup, could someone reach out when free?", category: null },
  { subject: "Need help", body: "Running into an issue and not sure who to ask — can someone take a look?", category: null },
  { subject: "Issue with recent order", body: "Something seems off with my most recent order but I'm not sure how to describe it exactly.", category: null },
  { subject: "Following up on previous email", body: "Just following up since I haven't heard back in a few days.", category: null },
  { subject: "Quick question", body: "Quick one for the team when you get a chance — nothing urgent.", category: null },
];

const firstNames = [
  "Olivia", "Liam", "Emma", "Noah", "Ava",
  "Ethan", "Sophia", "Mason", "Isabella", "Lucas",
];

const lastNames = [
  "Martinez", "Chen", "Patel", "Nguyen", "Johansson",
  "Okafor", "Rossi", "Kowalski", "Tanaka", "Silva",
];

const domains = [
  "gmail.com", "outlook.com", "yahoo.com", "acmecorp.com",
  "brightlabs.io", "northwind.dev", "gridlyapp.com", "vertexstudio.co",
];

const statusPool: TicketStatus[] = [
  ...Array(4).fill(TicketStatus.open),
  ...Array(4).fill(TicketStatus.resolved),
  ...Array(2).fill(TicketStatus.closed),
];

function hash(seed: number): number {
  return Math.abs(Math.imul(seed ^ (seed >>> 16), 2654435761)) >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[hash(seed) % arr.length];
}

async function seedTickets() {
  const alreadySeeded = await db.ticket.count({ where: { messageId: { startsWith: "<seed-" } } });
  if (alreadySeeded > 0) {
    console.log(`${alreadySeeded} seeded tickets already exist, skipping.`);
    return;
  }

  const assignees = await db.user.findMany({
    where: { role: Role.agent, deletedAt: null },
    select: { id: true },
  });

  const now = Date.now();
  const rows = Array.from({ length: 100 }, (_, i) => {
    const template = templates[i % templates.length];
    const first = firstNames[i % firstNames.length];
    const last = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
    const domain = pick(domains, i * 7 + 3);
    const requesterName = `${first} ${last}`;
    const requesterEmail = `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`;

    const daysAgo = (i * 37 + 11) % 120;
    const hoursAgo = (i * 13 + 5) % 24;
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000);

    const status = pick(statusPool, i * 5 + 2);
    const assignedToId =
      status !== TicketStatus.open && assignees.length > 0
        ? pick(assignees, i * 3 + 1).id
        : null;

    return {
      subject: template.subject,
      body: template.body,
      category: template.category,
      status,
      requesterName,
      requesterEmail,
      messageId: `<seed-${i}-${Date.now()}@helpdesk.local>`,
      assignedToId,
      createdAt,
    };
  });

  await db.ticket.createMany({ data: rows });
  console.log(`Seeded ${rows.length} tickets.`);
}

seedTickets()
  .catch((err) => {
    console.error("Seed tickets failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
