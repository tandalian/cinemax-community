import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, Heart, MessageCircle, Search, Send, UserPlus, Users } from 'lucide-react'
import { supabase } from './lib/supabase'

type Member = {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
}

type Presence = {
  user_id: string
  online: boolean
  last_seen_at: string
}

type Conversation = {
  id: string
  title: string | null
  created_at: string
  memberIds: string[]
  name: string
  online: boolean
}

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string | null
  created_at: string
}

function isOnline(presence: Presence | undefined) {
  return Boolean(
    presence?.online &&
    Date.now() - new Date(presence.last_seen_at).getTime() < 90_000,
  )
}

function useMembers() {
  const [members, setMembers] = useState<Member[]>([])
  const [presence, setPresence] = useState<Presence[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!supabase) {
        setError('Supabase is not configured.')
        return
      }

      const [memberResult, presenceResult] = await Promise.all([
        supabase.from('profiles').select('id,full_name,username,avatar_url')
          .eq('status', 'active').order('full_name'),
        supabase.from('user_presence').select('user_id,online,last_seen_at'),
      ])

      if (cancelled) return
      if (memberResult.error) {
        setError(memberResult.error.message)
        return
      }
      if (presenceResult.error) {
        setError(presenceResult.error.message)
        return
      }

      setMembers((memberResult.data || []) as Member[])
      setPresence((presenceResult.data || []) as Presence[])
      setError('')
    }

    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return { members, presence, error }
}

export function InvitePanel({ compact = false }: { compact?: boolean }) {
  const [inviteLimit, setInviteLimit] = useState(0)
  const [inviteCount, setInviteCount] = useState(0)
  const [inviteUrl, setInviteUrl] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!supabase) return

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) {
        if (!cancelled) setError(userError.message)
        return
      }
      if (!userData.user) return

      const [profileResult, countResult] = await Promise.all([
        supabase.from('profiles').select('invitation_limit').eq('id', userData.user.id).single(),
        supabase.from('invitations').select('id', { count: 'exact', head: true })
          .eq('inviter_id', userData.user.id),
      ])

      if (cancelled) return
      if (profileResult.error) setError(profileResult.error.message)
      else setInviteLimit(profileResult.data.invitation_limit)
      if (countResult.error) setError(countResult.error.message)
      else setInviteCount(countResult.count || 0)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function createInvite() {
    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    const { data, error: inviteError } = await supabase.rpc('create_invitation')
    if (inviteError) {
      setError(inviteError.message)
    } else {
      const url = new URL('/register', window.location.origin)
      url.searchParams.set('invite', String(data))
      setInviteUrl(url.toString())
      setInviteCount(count => count + 1)
    }
    setBusy(false)
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setNotice('Invitation link copied.')
    } catch {
      setError('Could not copy the link. Select and copy it instead.')
    }
  }

  const remaining = Math.max(0, inviteLimit - inviteCount)

  return (
    <section className={`panel invite-hero${compact ? ' invite-hero-compact' : ''}`}>
      <div className="invite-rings"><UserPlus size={27} /></div>
      <span className="section-kicker">GROW THE COMMUNITY</span>
      <h2>Invite a friend</h2>
      <p>Create a personal invitation link. When your friend joins through it, they are connected to you in the community.</p>
      <div className="invite-stats-inline">{remaining} invitation{remaining === 1 ? '' : 's'} remaining</div>
      {!inviteUrl ? (
        <button className="primary-btn compact" onClick={() => void createInvite()} disabled={busy || remaining === 0}>
          <UserPlus size={16} /> {busy ? 'Creating link…' : 'Create invite link'}
        </button>
      ) : (
        <div className="copy-field">
          <input aria-label="Invitation link" readOnly value={inviteUrl} onFocus={event => event.currentTarget.select()} />
          <button type="button" onClick={() => void copyInvite()}><Copy size={15} /> Copy</button>
        </div>
      )}
      {notice && <p className="community-notice" role="status">{notice}</p>}
      {error && <div className="form-error" role="alert">{error}</div>}
    </section>
  )
}

export function CommunityPage({ userId }: { userId: string }) {
  const { members, presence, error: memberError } = useMembers()
  const [query, setQuery] = useState('')
  const [chatError, setChatError] = useState('')
  const navigate = useNavigate()
  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return members.filter(member =>
      member.id !== userId &&
      (!normalized ||
        member.full_name.toLowerCase().includes(normalized) ||
        member.username.toLowerCase().includes(normalized)),
    )
  }, [members, query, userId])
  const presenceById = useMemo(
    () => new Map(presence.map(item => [item.user_id, item])),
    [presence],
  )
  const onlineCount = members.filter(member => isOnline(presenceById.get(member.id))).length

  async function startChat(memberId: string) {
    if (!supabase) return
    const { data, error: chatResultError } = await supabase.rpc('start_direct_conversation', {
      target_user_id: memberId,
    })
    if (chatResultError) {
      setChatError(chatResultError.message)
      return
    }
    navigate(`/chat?conversation=${encodeURIComponent(String(data))}`)
  }

  return (
    <main className="app-content">
      <div className="page-heading">
        <div>
          <span className="section-kicker">YOUR COMMUNITY</span>
          <h1>Members</h1>
          <p>{onlineCount} member{onlineCount === 1 ? '' : 's'} online now</p>
        </div>
        <Link className="secondary-btn" to="/chat"><MessageCircle size={16} /> Open chat</Link>
      </div>

      <div className="community-grid">
        <InvitePanel />
        <section className="panel member-directory">
          <div className="panel-title">
            <h2><Users size={19} /> Community members</h2>
            <span>{members.length} members</span>
          </div>
          <label className="member-search">
            <Search size={17} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a member…" />
          </label>
          {(memberError || chatError) && <div className="form-error" role="alert">{memberError || chatError}</div>}
          <div className="member-list">
            {filteredMembers.map(member => {
              const online = isOnline(presenceById.get(member.id))
              return (
                <article className="member-row" key={member.id}>
                  <div className="avatar member-avatar">
                    {member.avatar_url
                      ? <img src={member.avatar_url} alt="" />
                      : member.full_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="member-details">
                    <strong>{member.full_name}</strong>
                    <span>@{member.username}</span>
                  </div>
                  <span className={`presence-label${online ? ' online' : ''}`}>
                    <i /> {online ? 'Online' : 'Offline'}
                  </span>
                  <button className="secondary-btn compact member-message" onClick={() => void startChat(member.id)}>
                    <MessageCircle size={15} /><span>Message</span>
                  </button>
                </article>
              )
            })}
            {!memberError && filteredMembers.length === 0 && (
              <p className="community-empty">{members.length ? 'No members match your search.' : 'No other members have joined yet.'}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

export function ChatPage({ userId }: { userId: string }) {
  const { members, presence, error: presenceError } = useMembers()
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [likes, setLikes] = useState<{ message_id: string; user_id: string }[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const conversationId = searchParams.get('conversation')
  const selected = conversations.find(conversation => conversation.id === conversationId)
  const presenceById = useMemo(
    () => new Map(presence.map(item => [item.user_id, item])),
    [presence],
  )

  useEffect(() => {
    let cancelled = false

    async function loadConversations() {
      if (!supabase) {
        setError('Supabase is not configured.')
        setLoading(false)
        return
      }

      const { data: memberships, error: membershipsError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId)

      if (membershipsError) {
        if (!cancelled) {
          setError(membershipsError.message)
          setLoading(false)
        }
        return
      }

      const ids = [...new Set((memberships || []).map(item => item.conversation_id))]
      if (!ids.length) {
        if (!cancelled) {
          setConversations([])
          setLoading(false)
        }
        return
      }

      const [conversationResult, memberResult] = await Promise.all([
        supabase.from('conversations').select('id,title,created_at').in('id', ids)
          .order('created_at', { ascending: false }),
        supabase.from('conversation_members').select('conversation_id,user_id').in('conversation_id', ids),
      ])

      if (cancelled) return
      if (conversationResult.error) {
        setError(conversationResult.error.message)
      } else if (memberResult.error) {
        setError(memberResult.error.message)
      } else {
        const nameById = new Map(members.map(member => [member.id, member.full_name]))
        const next = (conversationResult.data || []).map(conversation => {
          const memberIds = (memberResult.data || [])
            .filter(item => item.conversation_id === conversation.id)
            .map(item => item.user_id)
          const peerId = memberIds.find(id => id !== userId)
          const peerPresence = peerId ? presenceById.get(peerId) : undefined
          return {
            ...conversation,
            memberIds,
            name: conversation.title || (peerId ? nameById.get(peerId) : '') || 'Conversation',
            online: isOnline(peerPresence),
          }
        })
        setConversations(next)
        setError('')
        if (!conversationId && next[0]) {
          setSearchParams({ conversation: next[0].id }, { replace: true })
        }
      }
      setLoading(false)
    }

    void loadConversations()
    return () => {
      cancelled = true
    }
  }, [userId, members, presenceById, conversationId, setSearchParams])

  useEffect(() => {
    let cancelled = false

    async function loadMessages() {
      if (!supabase || !conversationId) {
        setMessages([])
        setLikes([])
        return
      }

      setLoading(true)
      const { data, error: messagesError } = await supabase
        .from('messages')
        .select('id,conversation_id,sender_id,body,created_at')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (cancelled) return
      if (messagesError) {
        setError(messagesError.message)
        setLoading(false)
        return
      }

      const rows = (data || []) as Message[]
      setMessages(rows)
      if (rows.length) {
        const { data: likeRows, error: likesError } = await supabase
          .from('message_likes').select('message_id,user_id')
          .in('message_id', rows.map(message => message.id))
        if (cancelled) return
        if (likesError) setError(likesError.message)
        else setLikes(likeRows || [])
      } else {
        setLikes([])
      }
      setLoading(false)
    }

    void loadMessages()
    const timer = window.setInterval(() => void loadMessages(), 5_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [conversationId])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = body.trim()
    if (!supabase || !conversationId || !message || busy) return

    setBusy(true)
    setError('')
    const { error: sendError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      body: message,
    })
    if (sendError) setError(sendError.message)
    else {
      setBody('')
      const { data } = await supabase.from('messages')
        .select('id,conversation_id,sender_id,body,created_at')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
      if (data) setMessages(data as Message[])
    }
    setBusy(false)
  }

  async function toggleLike(messageId: string) {
    if (!supabase) return
    const alreadyLiked = likes.some(like => like.message_id === messageId && like.user_id === userId)
    setError('')
    if (alreadyLiked) {
      const { error: unlikeError } = await supabase.from('message_likes')
        .delete().eq('message_id', messageId).eq('user_id', userId)
      if (unlikeError) setError(unlikeError.message)
      else setLikes(current => current.filter(like => !(like.message_id === messageId && like.user_id === userId)))
    } else {
      const { error: likeError } = await supabase.from('message_likes')
        .insert({ message_id: messageId, user_id: userId })
      if (likeError) setError(likeError.message)
      else setLikes(current => [...current, { message_id: messageId, user_id: userId }])
    }
  }

  return (
    <main className="app-content chat-page">
      <div className="page-heading">
        <div>
          <span className="section-kicker">MEMBER MESSAGES</span>
          <h1>Community chat</h1>
        </div>
        <Link className="secondary-btn" to="/community"><Users size={16} /> Find members</Link>
      </div>

      {(error || presenceError) && <div className="form-error" role="alert">{error || presenceError}</div>}
      <div className={`chat-layout${conversationId ? '' : ' mobile-show-list'}`}>
        <aside className="chat-sidebar">
          <div className="chat-sidebar-heading">
            <strong>Conversations</strong>
            <Link to="/community" aria-label="Start a conversation"><UserPlus size={17} /></Link>
          </div>
          {loading && conversations.length === 0 && <p className="chat-empty">Loading chats…</p>}
          {!loading && conversations.length === 0 && (
            <p className="chat-empty">No conversations yet. <Link to="/community">Choose a member to message.</Link></p>
          )}
          {conversations.map(conversation => (
            <button
              className={`conversation${conversation.id === conversationId ? ' active' : ''}`}
              key={conversation.id}
              onClick={() => setSearchParams({ conversation: conversation.id })}
            >
              <div className="avatar small">{conversation.name.slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{conversation.name}</strong>
                <span>{conversation.online ? 'Online' : 'Conversation'}</span>
              </div>
              {conversation.online && <i className="presence-dot" />}
            </button>
          ))}
        </aside>

        <section className={`chat-main${selected ? '' : ' chat-main-empty'}`}>
          {selected ? (
            <>
              <header>
                <button className="chat-back" onClick={() => setSearchParams({})}>‹</button>
                <div className="avatar small">{selected.name.slice(0, 1).toUpperCase()}</div>
                <div><strong>{selected.name}</strong><span>{selected.online ? 'Online now' : 'Member'}</span></div>
              </header>
              <div className="messages">
                {messages.map(message => {
                  const messageLikes = likes.filter(like => like.message_id === message.id)
                  const liked = messageLikes.some(like => like.user_id === userId)
                  const sender = members.find(member => member.id === message.sender_id)
                  return (
                    <article className={`message${message.sender_id === userId ? ' sent' : ' received'}`} key={message.id}>
                      {message.sender_id !== userId && <strong>{sender?.full_name || 'Member'}</strong>}
                      <p>{message.body}</p>
                      <div className="message-footer">
                        <time>{new Date(message.created_at).toLocaleString()}</time>
                        <button
                          className={`message-like${liked ? ' active' : ''}`}
                          aria-label={liked ? 'Unlike message' : 'Like message'}
                          aria-pressed={liked}
                          onClick={() => void toggleLike(message.id)}
                        >
                          <Heart size={14} fill={liked ? 'currentColor' : 'none'} /> {messageLikes.length}
                        </button>
                      </div>
                    </article>
                  )
                })}
                {!loading && messages.length === 0 && <p className="chat-empty">Send a message to start the conversation.</p>}
              </div>
              <form className="message-input" onSubmit={event => void sendMessage(event)}>
                <input
                  aria-label="Write a message"
                  value={body}
                  onChange={event => setBody(event.target.value)}
                  placeholder="Write a message…"
                  maxLength={4000}
                />
                <button className="send-button" type="submit" disabled={busy || !body.trim()} aria-label="Send message">
                  <Send size={17} />
                </button>
              </form>
            </>
          ) : (
            <div className="chat-placeholder">
              <MessageCircle size={32} />
              <h2>Choose a conversation</h2>
              <p>Start chatting with a community member.</p>
              <Link to="/community" className="primary-btn compact">Find members</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
