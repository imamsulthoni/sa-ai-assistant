import { useState } from 'react'
import { ArrowUp, Bot, Paperclip, Sparkles } from 'lucide-react'
import { Button } from '#/components/ui/button'

type Message = { role: 'user' | 'assistant'; content: string }

const initialMessages: Message[] = [{ role: 'assistant', content: 'Hi! I’m your AI assistant. I can help you research ideas, write content, analyze information, and more. What would you like to work on?' }]

export function AnviaChat() {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  function sendMessage() {
    const content = input.trim()
    if (!content) return
    setMessages((current) => [...current, { role: 'user', content }, { role: 'assistant', content: 'I’m ready to help with that. Connect your agent backend here to continue the conversation.' }])
    setInput('')
  }
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto"><div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
        <div className="mb-10 text-center"><div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-neutral-900 text-white shadow-sm"><Sparkles size={22} /></div><h1 className="text-2xl font-semibold tracking-tight">How can I help you today?</h1><p className="mt-2 text-sm text-neutral-500">Ask anything, or choose a prompt to get started.</p></div>
        <div className="space-y-7">{messages.map((message, index) => <div key={`${message.role}-${index}`} data-role={message.role} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>{message.role === 'assistant' && <div className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-white"><Bot size={16} /></div>}<div className={`max-w-[80%] whitespace-pre-wrap text-[15px] leading-7 ${message.role === 'user' ? 'rounded-2xl bg-neutral-100 px-4 py-2.5' : 'pt-0.5'}`}>{message.content}</div></div>)}</div>
      </div></div>
      <div className="mx-auto w-full max-w-3xl px-5 pb-5 md:px-8 md:pb-8"><form onSubmit={(event) => { event.preventDefault(); sendMessage() }} className="rounded-2xl border bg-white p-2 shadow-[0_4px_20px_rgba(0,0,0,0.08)]"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() } }} placeholder="Message your assistant..." rows={2} className="w-full resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-neutral-400" /><div className="flex items-center justify-between px-1"><Button type="button" variant="ghost" size="icon" className="text-neutral-500"><Paperclip size={18} /></Button><div className="flex items-center gap-2 text-xs text-neutral-400"><span>Enter to send</span><Button type="submit" aria-label="Send message" size="icon" disabled={!input.trim()}><ArrowUp size={17} /></Button></div></div></form><p className="mt-2 text-center text-[11px] text-neutral-400">AI can make mistakes. Check important information.</p></div>
    </div>
  )
}
