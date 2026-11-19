import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell, Bookmark, ChevronRight, Clock3, Download, Film, Heart, Home, Menu,
  MessageCircle, Search, Settings, Share2, ShieldCheck, Sparkles, Upload,
  UserPlus, Users, X, LogOut, Copy, Check, BarChart3,
  AlertTriangle, Eye, EyeOff
} from 'lucide-react'
import { demoMovies } from './data'
import type { Movie } from './data'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './App.css'

type SessionUser = { id: string; name: string; email: string; role: 'user' | 'admin' }

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark"><Film size={20} /></div>
      <span>CINEMAX</span>
      <small>COMMUNITY</small>
    </div>
  )
}

function Landing() {
  const navigate = useNavigate()
  return (
    <div className="landing">
      <nav className="public-nav">
        <Brand />
        <div className="nav-actions">
          <Link to="/login" className="nav-login">Log in</Link>
          <Link to="/register" className="primary-btn compact">Join Community</Link>
        </div>
      </nav>
      <main>
        <section className="hero-section" style={{ backgroundImage: `linear-gradient(90deg, rgba(5,5,5,.98) 15%, rgba(5,5,5,.72) 55%, rgba(5,5,5,.2)), url(${demoMovies[0].backdrop})` }}>
          <motion.div className="hero-copy" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <div className="eyebrow"><Sparkles size={14} /> Members-only screening</div>
            <h1>YOUR MOVIES.<br /><span>YOUR COMMUNITY.</span><br />YOUR WORLD.</h1>
            <p>Discover extraordinary films, connect with people, and enjoy an exclusive movie community.</p>
            <div className="hero-actions">
              <button className="primary-btn" onClick={() => navigate('/register')}>Join the Community <ChevronRight size={18} /></button>
              <button className="secondary-btn" onClick={() => navigate('/library')}>Explore Movies</button>
            </div>
          </motion.div>
        </section>
        <section className="landing-section">
          <div className="section-heading">
            <div><span className="section-kicker">NOW SHOWING</span><h2>Featured Movies</h2></div>
            <button className="text-btn" onClick={() => navigate('/library')}>View all <ChevronRight size={16} /></button>
          </div>
          <MovieRail movies={demoMovies} />
        </section>
        <section className="landing-section community-section">
          <div className="section-heading centered">
            <span className="section-kicker">WHY CINEMAX</span>
            <h2>More than a movie library</h2>
          </div>
          <div className="feature-grid">
            <Feature icon={<ShieldCheck />} title="Secure access" text="Protected movie access with authorized downloads and secure account management." />
            <Feature icon={<MessageCircle />} title="Real-time community" text="Chat directly or create groups and stay connected with members worldwide." />
            <Feature icon={<UserPlus />} title="Invite your circle" text="Share a personal invitation link and grow the community with up to five members." />
          </div>
        </section>
      </main>
      <footer><Brand /><span>© 2026 Cinemax Community</span></footer>
    </div>
  )
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <article className="feature-card"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>
}

function MovieRail({ movies, onOpen }: { movies: Movie[]; onOpen?: (movie: Movie) => void }) {
  return (
    <div className="movie-rail">
      {movies.map((movie, index) => (
        <motion.article className="movie-card" key={movie.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .05 }}>
          <div className="poster-wrap" onClick={() => onOpen?.(movie)}>
            <img src={movie.poster} alt={movie.title} />
            <div className="poster-gradient" />
            {movie.featured && <span className="featured-tag">FEATURED</span>}
            <button className="poster-action" aria-label={`Open ${movie.title}`}><ChevronRight /></button>
          </div>
          <h3>{movie.title}</h3>
          <div className="movie-meta"><span>{movie.year}</span><i /> <span>{movie.genre}</span><b>{movie.rating}</b></div>
        </motion.article>
      ))}
    </div>
  )
}

function AuthPage({ mode, setUser }: { mode: 'login' | 'register'; setUser: (user: SessionUser | null) => void }) {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '')
    const password = String(form.get('password') || '')
    if (!email || !password || (mode === 'register' && password.length < 8)) {
      setError(mode === 'register' ? 'Password must be at least 8 characters.' : 'Enter your email and password.')
      setLoading(false)
      return
    }
    void (async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          const result = mode === 'login'
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password, options: { data: { full_name: form.get('name'), username: form.get('username') } } })
          if (result.error) throw result.error
          if (result.data.user) {
            setUser({ id: result.data.user.id, name: String(result.data.user.user_metadata.full_name || 'Member'), email, role: email.startsWith('admin') ? 'admin' : 'user' })
            navigate(email.startsWith('admin') ? '/admin' : '/dashboard')
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 650))
          setUser({ id: 'demo-member', name: mode === 'register' ? String(form.get('name') || 'New Member') : 'Alex Morgan', email, role: email.startsWith('admin') ? 'admin' : 'user' })
          navigate(email.startsWith('admin') ? '/admin' : '/dashboard')
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Authentication failed.')
      } finally {
        setLoading(false)
      }
    })()
  }

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div className="auth-overlay" />
        <Brand />
        <div className="auth-quote"><p>“Cinema is not just entertainment. It's where we find each other.”</p></div>
      </div>
      <main className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <Link to="/" className="mobile-brand"><Brand /></Link>
          <span className="section-kicker">{mode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR ACCOUNT'}</span>
          <h1>{mode === 'login' ? 'Enter Cinemax' : 'Join the community'}</h1>
          {mode === 'register' && (
            <>
              <label>Full name<input name="name" placeholder="Alex Morgan" required /></label>
              <label>Username<input name="username" placeholder="alexm" required /></label>
            </>
          )}
          <label>Email address<input name="email" type="email" placeholder="you@example.com" required /></label>
          <label>Password<div className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} placeholder="Minimum 8 characters" required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
          {mode === 'login' && <div className="form-options"><label className="check-label"><input type="checkbox" /> Remember me</label><button type="button" className="text-btn">Forgot password?</button></div>}
          {error && <div className="form-error"><AlertTriangle size={16} />{error}</div>}
          <button className="primary-btn auth-submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}<ChevronRight size={18} /></button>
          <p className="auth-switch">{mode === 'login' ? 'New to Cinemax?' : 'Already a member?'} <Link to={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create account' : 'Sign in'}</Link></p>
          {!isSupabaseConfigured && <p className="config-note">Demo mode: Supabase is not configured. Configure .env for persistent accounts.</p>}
        </form>
      </main>
    </div>
  )
}

const userNav = [
  { label: 'Dashboard', icon: Home, path: '/dashboard' },
  { label: 'Movies', icon: Film, path: '/library' },
  { label: 'Downloads', icon: Download, path: '/downloads' },
  { label: 'Community Chat', icon: MessageCircle, path: '/chat' },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
  { label: 'Invite Friends', icon: UserPlus, path: '/invite' },
  { label: 'My Profile', icon: Users, path: '/profile' },
  { label: 'Settings', icon: Settings, path: '/settings' },
]

function AppShell({ user, setUser }: { user: SessionUser; setUser: (user: SessionUser | null) => void }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null)
  const navigate = useNavigate()

  async function logout() {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    navigate('/')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand"><Brand /><button className="close-menu" onClick={() => setMobileOpen(false)}><X /></button></div>
        <nav>
          {userNav.map(item => <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}><item.icon size={19} /><span>{item.label}</span></Link>)}
        </nav>
        <div className="sidebar-footer">
          {user.role === 'admin' && <Link to="/admin" className="admin-link"><ShieldCheck size={18} /> Admin Panel</Link>}
          <button onClick={logout}><LogOut size={18} /> Log out</button>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <div className="app-main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)}><Menu /></button>
          <div className="global-search"><Search size={17} /><input placeholder="Search movies, people, or groups" /></div>
          <div className="topbar-actions">
            <Link to="/notifications" className="icon-button"><Bell size={20} /><span className="notification-dot" /></Link>
            <Link to="/chat" className="icon-button"><MessageCircle size={20} /></Link>
            <Link to="/profile" className="profile-chip"><div className="avatar">{user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div><span>{user.name}</span></Link>
          </div>
        </header>
        <main className="app-content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/library" element={<Library onOpen={setActiveMovie} />} />
            <Route path="/downloads" element={<DownloadsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/invite" element={<InvitePage />} />
            <Route path="/profile" element={<ProfilePage user={user} />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={user.role === 'admin' ? <AdminPage /> : <Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
      <AnimatePresence>{activeMovie && <MovieModal movie={activeMovie} onClose={() => setActiveMovie(null)} />}</AnimatePresence>
    </div>
  )
}

function PageHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <span className="section-kicker">{eyebrow}</span>}<h1>{title}</h1></div>{action}</div>
}

function Dashboard({ user }: { user: SessionUser }) {
  const navigate = useNavigate()
  const stats = [
    { label: 'Available Movies', value: '5', icon: Film, tone: 'green' },
    { label: 'Downloaded', value: '0', icon: Download, tone: 'blue' },
    { label: 'Friends Invited', value: '0', icon: UserPlus, tone: 'purple' },
    { label: 'Unread Messages', value: '0', icon: MessageCircle, tone: 'orange' },
  ]
  return (
    <>
      <section className="welcome-panel">
        <div><span className="online-status"><i /> Online</span><h1>Welcome back, {user.name}</h1><p>{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p></div>
        <button className="primary-btn" onClick={() => navigate('/library')}>Browse Movies <ChevronRight size={18} /></button>
      </section>
      <div className="stats-grid">{stats.map(stat => <article className="stat-card" key={stat.label}><div className={`stat-icon ${stat.tone}`}><stat.icon /></div><div><strong>{stat.value}</strong><span>{stat.label}</span></div></article>)}</div>
      <section className="content-section">
        <div className="section-heading"><div><span className="section-kicker">NEW RELEASES</span><h2>Latest Movies</h2></div><button className="text-btn" onClick={() => navigate('/library')}>View all <ChevronRight size={16} /></button></div>
        <MovieRail movies={demoMovies.slice(0, 4)} />
      </section>
      <section className="dashboard-grid">
        <article className="panel invite-panel"><div className="panel-icon"><UserPlus /></div><div><span>INVITE FRIENDS</span><h3>Grow the community</h3><p>You have 5 invitation slots remaining.</p></div><button onClick={() => navigate('/invite')}>Invite <ChevronRight size={16} /></button></article>
        <article className="panel activity-panel"><div className="panel-title"><h3>Recent Activity</h3><button className="text-btn">View all</button></div><div className="empty-activity"><Clock3 /><p>No recent account activity</p></div></article>
      </section>
    </>
  )
}

function Library({ onOpen }: { onOpen: (movie: Movie) => void }) {
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('All')
  const filtered = useMemo(() => demoMovies.filter(movie => (genre === 'All' || movie.genre === genre) && movie.title.toLowerCase().includes(query.toLowerCase())), [query, genre])
  return (
    <>
      <PageHeading eyebrow="MOVIE LIBRARY" title="Discover movies" action={<button className="primary-btn compact"><Upload size={16} /> Uploads managed by admin</button>} />
      <div className="filters"><div className="filter-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search movies..." /></div><select value={genre} onChange={e => setGenre(e.target.value)}><option>All</option>{[...new Set(demoMovies.map(movie => movie.genre))].map(item => <option key={item}>{item}</option>)}</select></div>
      {filtered.length ? <div className="library-grid">{filtered.map(movie => <LibraryCard key={movie.id} movie={movie} onOpen={() => onOpen(movie)} />)}</div> : <EmptyState icon={<Film />} title="No movies found" text="Try changing your search or genre filter." />}
    </>
  )
}

function LibraryCard({ movie, onOpen }: { movie: Movie; onOpen: () => void }) {
  const [favorite, setFavorite] = useState(false)
  return (
    <article className="library-card">
      <div className="library-poster"><img src={movie.poster} alt={movie.title} /><button className={favorite ? 'favorite active' : 'favorite'} onClick={() => setFavorite(!favorite)}><Heart fill={favorite ? 'currentColor' : 'none'} /></button></div>
      <div className="library-info"><h3>{movie.title}</h3><p>{movie.description}</p><div className="movie-meta"><span>{movie.genre}</span><i /><span>{movie.year}</span><span>{movie.duration}</span></div><button className="download-btn" onClick={onOpen}><Download size={17} /> View & download</button></div>
    </article>
  )
}

function MovieModal({ movie, onClose }: { movie: Movie; onClose: () => void }) {
  const [downloading, setDownloading] = useState(false)
  const [complete, setComplete] = useState(false)
  function download() {
    setDownloading(true)
    setTimeout(() => { setDownloading(false); setComplete(true) }, 900)
  }
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
      <motion.div className="movie-modal" initial={{ scale: .96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .96, y: 20 }} onMouseDown={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X /></button>
        <div className="modal-backdrop-image" style={{ backgroundImage: `linear-gradient(90deg, #111 10%, rgba(17,17,17,.35)), url(${movie.backdrop})` }}>
          <div className="modal-copy"><span className="section-kicker">{movie.genre}</span><h2>{movie.title}</h2><div className="movie-meta"><span>{movie.year}</span><i /><span>{movie.duration}</span><b>{movie.rating}</b></div></div>
        </div>
        <div className="modal-body"><p>{movie.description}</p><div className="modal-actions"><button className="primary-btn" onClick={download} disabled={downloading}>{downloading ? 'Preparing secure link…' : complete ? <><Check size={18} /> Ready</> : <><Download size={18} /> Download</>}</button><button className="secondary-btn"><Bookmark size={18} /> Watchlist</button></div></div>
      </motion.div>
    </motion.div>
  )
}

function DownloadsPage() {
  return <><PageHeading eyebrow="YOUR LIBRARY" title="Downloads" /><EmptyState icon={<Download />} title="No downloads yet" text="Movies you download will appear here." /></>
}

function ChatPage() {
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState<string[]>([])
  function send() { if (message.trim()) { setSent([...sent, message.trim()]); setMessage('') } }
  return (
    <div className="chat-layout">
      <aside className="chat-sidebar"><div className="chat-search"><Search /><input placeholder="Search conversations" /></div><button className="conversation active"><div className="avatar">CS</div><div><strong>Cinemax Community</strong><span>Welcome to the community</span></div><time>Now</time></button></aside>
      <section className="chat-main"><header><div className="avatar">CS</div><div><strong>Cinemax Community</strong><span><i /> 12 members online</span></div></header><div className="messages"><div className="message received"><div className="avatar small">CM</div><div><strong>Cinemax Team</strong><p>Welcome to the community. Introduce yourself!</p><time>Just now</time></div></div>{sent.map((item, index) => <div className="message sent" key={index}><p>{item}</p><time>Now <Check size={12} /></time></div>)}</div><div className="message-input"><button>+</button><input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Write a message…" /><button className="send-button" onClick={send}><ChevronRight /></button></div></section>
    </div>
  )
}

function NotificationsPage() {
  return <><PageHeading eyebrow="UPDATES" title="Notifications" action={<button className="secondary-btn compact">Mark all as read</button>} /><div className="panel notification-list"><div className="notification-item unread"><div className="stat-icon green"><Film /></div><div><strong>Welcome to Cinemax Community</strong><p>Your account is ready. Start exploring the movie library.</p><time>Just now</time></div></div></div></>
}

function InvitePage() {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/register?ref=CINEMAX-DEMO`
  async function copy() { await navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <>
      <PageHeading eyebrow="GROW THE COMMUNITY" title="Invite friends" />
      <div className="invite-layout">
        <section className="panel invite-hero"><div className="invite-rings"><Share2 /></div><h2>Share the experience</h2><p>Invite people you trust. Your community grows when great movies are shared responsibly.</p><label>Your unique invitation link<div className="copy-field"><input readOnly value={link} /><button onClick={copy}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}</button></div></label></section>
        <aside className="panel invite-stats"><h3>Invitation statistics</h3><div className="slot-count"><strong>0</strong><span>Invited</span></div><div className="progress-track"><div /></div><div className="slot-labels"><span>0 used</span><strong>5 remaining</strong></div></aside>
      </div>
    </>
  )
}

function ProfilePage({ user }: { user: SessionUser }) {
  return <><PageHeading eyebrow="MEMBER PROFILE" title="My profile" /><section className="profile-layout"><aside className="panel profile-card"><div className="profile-avatar">{user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div><h2>{user.name}</h2><p>{user.email}</p><span className="role-badge">{user.role}</span></aside><section className="panel profile-form"><h3>Profile details</h3><div className="form-grid"><label>Full name<input defaultValue={user.name} /></label><label>Username<input defaultValue="alexm" /></label><label>Email<input defaultValue={user.email} type="email" /></label><label>Bio<textarea placeholder="Tell the community about yourself…" /></label></div><button className="primary-btn">Save changes</button></section></section></>
}

function SettingsPage() {
  return <><PageHeading eyebrow="ACCOUNT" title="Settings" /><section className="settings-list"><div className="panel setting-row"><div><h3>Push notifications</h3><p>Receive notifications for messages and new releases.</p></div><button className="toggle active"><span /></button></div><div className="panel setting-row"><div><h3>Email updates</h3><p>Receive community announcements by email.</p></div><button className="toggle"><span /></button></div><div className="panel setting-row"><div><h3>Change password</h3><p>Update your account password securely.</p></div><button className="secondary-btn compact">Change</button></div></section></>
}

function AdminPage() {
  const adminStats = [
    { label: 'Registered users', value: '0', icon: Users },
    { label: 'Total movies', value: String(demoMovies.length), icon: Film },
    { label: 'Total downloads', value: '0', icon: Download },
    { label: 'Pending reports', value: '0', icon: AlertTriangle },
  ]
  return (
    <>
      <PageHeading eyebrow="ADMIN CONTROL" title="Platform overview" action={<button className="primary-btn compact"><Upload size={16} /> Upload Movie</button>} />
      <div className="stats-grid admin-stats">{adminStats.map(stat => <article className="stat-card" key={stat.label}><div className="stat-icon green"><stat.icon /></div><div><strong>{stat.value}</strong><span>{stat.label}</span></div></article>)}</div>
      <div className="admin-grid"><section className="panel admin-chart"><div className="panel-title"><h3>Platform activity</h3><span>Last 7 days</span></div><div className="chart-bars">{[32, 48, 40, 62, 54, 76, 68].map((height, i) => <div key={i}><span style={{ height: `${height}%` }} /><small>{['M','T','W','T','F','S','S'][i]}</small></div>)}</div></section><section className="panel admin-actions"><h3>Quick actions</h3><button><Users /> Manage users <ChevronRight /></button><button><Film /> Manage movies <ChevronRight /></button><button><Bell /> Send announcement <ChevronRight /></button><button><BarChart3 /> View analytics <ChevronRight /></button></section></div>
    </>
  )
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="empty-state"><div>{icon}</div><h2>{title}</h2><p>{text}</p></div>
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser({ id: data.session.user.id, name: String(data.session.user.user_metadata.full_name || 'Member'), email: data.session.user.email || '', role: 'user' })
    })
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <AuthPage mode="login" setUser={setUser} />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <AuthPage mode="register" setUser={setUser} />} />
        <Route path="/terms" element={<Landing />} />
        <Route path="/privacy" element={<Landing />} />
        <Route path="/*" element={user ? <AppShell user={user} setUser={setUser} /> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
