import { Bot, ChevronDown, Menu, Plus, Sparkles } from 'lucide-react'
import { Button } from '#/components/ui/button'

type ChatShellProps = {
  children: React.ReactNode
}

export function ChatShell({ children }: ChatShellProps) {
  return (
    <main className="flex h-screen min-h-[600px] bg-white text-neutral-900">
      <aside className="hidden w-[260px] shrink-0 flex-col border-r bg-[#f9f9f9] p-3 md:flex">
        <button className="mb-4 flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-neutral-200">
          <span className="grid size-7 place-items-center rounded-md bg-neutral-900 text-white"><Bot size={16} /></span>
          Agent workspace <ChevronDown size={14} className="ml-auto text-neutral-500" />
        </button>
        <Button variant="outline" className="w-full justify-start"><Plus size={16} /> New chat <span className="ml-auto text-xs text-neutral-400">⌘ K</span></Button>
        <p className="mb-2 mt-7 px-2 text-xs font-medium text-neutral-400">Today</p>
        <button className="rounded-lg bg-neutral-200/70 px-3 py-2 text-left text-sm">Plan a product launch</button>
        <button className="mt-1 rounded-lg px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-200/70">Analyze customer feedback</button>
        <div className="mt-auto rounded-xl border bg-white p-3 text-xs text-neutral-500">
          <div className="mb-2 flex items-center gap-2 font-medium text-neutral-800"><Sparkles size={14} /> Pro workspace</div>
          Unlimited agent access and priority responses.
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b px-4 md:px-8">
          <Menu className="mr-3 md:hidden" size={20} />
          <div className="flex items-center gap-2 text-sm font-semibold">AI Assistant <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-normal text-neutral-500">GPT-4o</span></div>
          <Button variant="ghost" size="icon" className="ml-auto text-neutral-500">•••</Button>
        </header>
        {children}
      </section>
    </main>
  )
}
