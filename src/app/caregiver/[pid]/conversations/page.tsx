import { ConversationsList } from "@/components/caregiver/ConversationsList";

export const metadata = { title: "Conversations · Waymax" };

export default async function ConversationsPage({ params }: PageProps<"/caregiver/[pid]/conversations">) {
  const { pid } = await params;
  return <ConversationsList pid={pid} />;
}
