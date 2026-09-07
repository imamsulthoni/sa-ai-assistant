import { createFileRoute } from '@tanstack/react-router'
import { AnviaChat } from '#/components/chat/anvia-chat'
import { ChatShell } from '#/components/chat/chat-shell'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <ChatShell>
      <AnviaChat />
    </ChatShell>
  )
}
