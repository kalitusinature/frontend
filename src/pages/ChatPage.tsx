import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { ApiError, api } from '../api'
import type { ChatConversation, ChatMessage } from '../types'
import { EmptyState, ErrorState, LoadingState, PageHeading } from '../components/ui'

const EMPTY_MESSAGES: ChatMessage[] = []

function messageTime(value: string) {
  return new Intl.DateTimeFormat('en-UG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function ChatPage({
  token,
  notify,
}: {
  token: string
  notify: (message: string) => void
}) {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [messageState, setMessageState] = useState<{
    conversationId: number
    messages: ChatMessage[]
  } | null>(null)
  const messages =
    messageState?.conversationId === selectedId
      ? messageState.messages
      : EMPTY_MESSAGES
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [messageError, setMessageError] = useState('')
  const messageListRef = useRef<HTMLDivElement>(null)

  const refreshConversations = useCallback(async () => {
    try {
      const result = await api.chatConversations(token)
      setConversations(result)
      setSelectedId((current) => {
        if (current !== null && result.some((conversation) => conversation.id === current)) {
          return current
        }
        return result[0]?.id ?? null
      })
      setError('')
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not load customer chats.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    // Load asynchronously so the effect does not synchronously update component state.
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshConversations()
    const timer = window.setInterval(() => void refreshConversations(), 10_000)
    return () => window.clearInterval(timer)
  }, [refreshConversations])

  useEffect(() => {
    if (selectedId === null) return
    let active = true
    const refreshMessages = async () => {
      try {
        const result = await api.chatMessages(token, selectedId)
        if (!active) return
        setMessageState({ conversationId: selectedId, messages: result.messages })
        setMessageError('')
        void refreshConversations()
      } catch (requestError) {
        if (active) {
          setMessageError(
            requestError instanceof ApiError
              ? requestError.message
              : 'Could not load this conversation.',
          )
        }
      }
    }
    void refreshMessages()
    const timer = window.setInterval(() => void refreshMessages(), 5_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [token, selectedId, refreshConversations])

  useEffect(() => {
    const list = messageListRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedId) ?? null

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = draft.trim()
    if (!selectedId || !body || sending) return
    setSending(true)
    setMessageError('')
    try {
      await api.sendChatMessage(token, selectedId, body)
      setDraft('')
      const result = await api.chatMessages(token, selectedId)
      setMessageState({ conversationId: selectedId, messages: result.messages })
      await refreshConversations()
      notify(`Reply sent to ${selectedConversation?.guest_name ?? 'customer'}.`)
    } catch (requestError) {
      setMessageError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not send your reply.',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-page">
      <PageHeading
        eyebrow="CUSTOMER SUPPORT"
        title="Customer chat"
        description="Reply to customer messages. New messages refresh automatically."
      />
      {error && <ErrorState message={error} retry={() => void refreshConversations()} />}
      <section className="chat-workspace" aria-label="Customer support conversations">
        <aside className="chat-inbox">
          <div className="chat-inbox-heading">
            <strong>Conversations</strong>
            <span>{conversations.length}</span>
          </div>
          {loading ? (
            <LoadingState label="Loading conversations…" />
          ) : conversations.length ? (
            <div className="chat-conversation-list">
              {conversations.map((conversation) => (
                <button
                  type="button"
                  className={`chat-conversation ${selectedId === conversation.id ? 'chat-conversation-active' : ''}`}
                  key={conversation.id}
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <span className="chat-conversation-avatar">
                    {conversation.guest_name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="chat-conversation-copy">
                    <span className="chat-conversation-title">
                      <strong>{conversation.guest_name}</strong>
                      {conversation.unread_count > 0 && (
                        <span className="chat-unread-badge" aria-label={`${conversation.unread_count} unread messages`}>
                          {conversation.unread_count}
                        </span>
                      )}
                    </span>
                    <small>{conversation.email}</small>
                    <span className="chat-conversation-preview">
                      {conversation.last_message_sender === 'staff' ? 'You: ' : ''}
                      {conversation.last_message_body || 'No messages yet'}
                    </span>
                  </span>
                  {conversation.last_message_at && (
                    <time>{messageTime(conversation.last_message_at)}</time>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No conversations yet"
              description="Customer chats will appear here when someone sends a message."
            />
          )}
        </aside>
        <div className="chat-thread">
          {selectedConversation ? (
            <>
              <header className="chat-thread-heading">
                <span className="chat-conversation-avatar">
                  {selectedConversation.guest_name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{selectedConversation.guest_name}</strong>
                  <a href={`mailto:${selectedConversation.email}`}>{selectedConversation.email}</a>
                </span>
              </header>
              <div className="chat-message-list" ref={messageListRef} aria-live="polite">
                {messages.map((message) => (
                  <article
                    className={`chat-message chat-message-${message.sender}`}
                    key={message.id}
                  >
                    <span>{message.body}</span>
                    <time>{messageTime(message.created_at)}</time>
                  </article>
                ))}
                {!messages.length && (
                  <EmptyState
                    title="Start the conversation"
                    description="Send a reply to help this customer."
                  />
                )}
              </div>
              {messageError && <p className="chat-message-error" role="alert">{messageError}</p>}
              <form className="chat-reply-form" onSubmit={(event) => void sendMessage(event)}>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Write a reply…"
                  aria-label="Write a reply"
                  required
                />
                <button className="button button-primary" type="submit" disabled={sending || !draft.trim()}>
                  <Send size={15} />
                  {sending ? 'Sending…' : 'Send reply'}
                </button>
              </form>
            </>
          ) : (
            <div className="chat-empty-thread">
              <MessageCircle size={30} />
              <strong>Select a conversation</strong>
              <span>Choose a customer chat from the inbox to read and reply.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
