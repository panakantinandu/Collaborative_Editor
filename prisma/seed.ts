import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const text = (value: string) => ({ type: "text", text: value });
const paragraph = (value: string) => ({ type: "paragraph", content: [text(value)] });
const heading = (value: string) => ({ type: "heading", attrs: { level: 2 }, content: [text(value)] });
async function main() {
  const people = [{ id: "demo-alice", name: "Alice", email: "alice@draftly.demo", avatarColor: "#dce7d8" }, { id: "demo-bob", name: "Bob", email: "bob@draftly.demo", avatarColor: "#e5dff2" }, { id: "demo-charlie", name: "Charlie", email: "charlie@draftly.demo", avatarColor: "#f6dfcf" }];
  for (const user of people) await prisma.user.upsert({ where: { email: user.email }, create: user, update: { name: user.name, avatarColor: user.avatarColor } });
  const alice = await prisma.user.findUniqueOrThrow({ where: { email: people[0].email } });
  const bob = await prisma.user.findUniqueOrThrow({ where: { email: people[1].email } });
  const charlie = await prisma.user.findUniqueOrThrow({ where: { email: people[2].email } });
  const documents = [
    { id: "welcome-to-draftly", title: "A good place to begin", ownerId: alice.id, content: [heading("Welcome to your thinking space"), paragraph("Every big idea starts with a few words. This is a little space to collect yours, find your focus, and make something meaningful."), heading("Make yourself at home"), { type: "bulletList", content: ["Write a first draft, however rough.", "Use the toolbar to give your words a little structure.", "Invite Bob or Charlie when you’re ready for another perspective."].map(value => ({ type: "listItem", content: [paragraph(value)] })) }, paragraph("Your changes save automatically. You don’t need to have it all figured out to begin.")] },
    { id: "brand-story", title: "Finding our voice", ownerId: alice.id, content: [heading("A brand that feels like us"), paragraph("Thoughtful. Clear. A little unexpected. Our voice should feel like a conversation with someone who cares about the details."), heading("The principles"), paragraph("Say something useful. Make space for curiosity. Keep people at the center.")] },
    { id: "next-chapter", title: "The next chapter", ownerId: alice.id, content: [heading("Small steps, meaningful progress"), paragraph("A collection of ideas for what comes next. Some are practical. Some are ambitious. All of them are worth exploring."), { type: "orderedList", attrs: { start: 1 }, content: ["Listen to the people using our work.", "Choose one problem to solve well.", "Make something small and share it early."].map(value => ({ type: "listItem", content: [paragraph(value)] })) }] },
    { id: "loose-thoughts", title: "Notes from a slow morning", ownerId: alice.id, content: [paragraph("Sometimes the best ideas show up when you leave a little room for them. A few things on my mind today…"), heading("A question worth asking"), paragraph("What would this look like if it were simple?")] },
    { id: "team-kickoff", title: "A fresh start, together", ownerId: bob.id, content: [heading("Team kickoff notes"), paragraph("A shared place to find our direction, ask better questions, and turn a few good ideas into a plan."), heading("What we’re here to do"), paragraph("Make the complicated feel simple. Build with care. Leave things a little better than we found them.")] },
    { id: "charlie-notes", title: "Charlie’s private notebook", ownerId: charlie.id, content: [paragraph("These notes belong to Charlie. Other demo users cannot read them unless Charlie shares access.")] }
  ];
  for (const doc of documents) await prisma.document.upsert({ where: { id: doc.id }, create: { id: doc.id, title: doc.title, ownerId: doc.ownerId, contentJson: { type: "doc", content: doc.content } }, update: {} });
  // Only initialize sample shares once; re-seeding must not restore revoked access.
  const marker = await prisma.document.findUnique({ where: { id: "seed-initialized" } });
  if (!marker) {
    await prisma.$transaction([
      prisma.documentShare.upsert({ where: { documentId_userId: { documentId: "welcome-to-draftly", userId: bob.id } }, create: { documentId: "welcome-to-draftly", userId: bob.id, role: "EDITOR" }, update: {} }),
      prisma.documentShare.upsert({ where: { documentId_userId: { documentId: "team-kickoff", userId: alice.id } }, create: { documentId: "team-kickoff", userId: alice.id, role: "EDITOR" }, update: {} }),
      prisma.document.create({ data: { id: "seed-initialized", title: "A note to future me", ownerId: alice.id, contentJson: { type: "doc", content: [paragraph("Make time for the work that matters. Start small. Keep going.")] } } })
    ]);
  }
  console.log("Seed ready: Alice, Bob, and Charlie. Existing documents and permissions preserved.");
}
main().finally(() => prisma.$disconnect());
