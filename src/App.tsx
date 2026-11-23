import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell, Bookmark, ChevronRight, Clock3, Download, Film, Heart, Home, Menu,
  MessageCircle, Search, Settings, Share2, ShieldCheck, Sparkles, Upload,
  UserPlus, Users, X, LogOut, Copy, Check, BarChart3,
  AlertTriangle, Eye, EyeOff, Trash2
} from 'lucide-react'
import { demoMovies } from './data'
import type { Movie } from './data'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import './App.css'

type SessionUser = { id: string; name: string; email: string; role: 'user' | 'admin' }

async function fetchUserRole(userId: string): Promise<'user' | 'admin'> {
  if (!supabase) return 'user'
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return data?.role === 'admin' ? 'admin' : 'user'
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark"><Film size={20} /></div>
      <span>CINEMAX</span>
      <small>COMMUNITY</small>
    </div>
  )
}

function Landing({ movies }: { movies: Movie[] }) {
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
        <section className="hero-section" style={{ backgroundImage: linear-gradient(90deg, rgba(5,5,5,.98) 15%, rgba(5,5,5,.72) 55%, rgba(5,5,5,.2)), url(${movies[0]?.backdrop || demoMovies[0].backdrop}) }}>
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
          <MovieRail movies={movies} />
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
            <button className="poster-action" aria-label={Open ${movie.title}}><ChevronRight /></button>
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
    const email = String(form.get('email') || '').trim()
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
            const role = await fetchUserRole(result.data.user.id)
            setUser({ id: result.data.user.id, name: String(result.data.user.user_metadata.full_name || 'Member'), email, role })
            navigate(role === 'admin' ? '/admin' : '/dashboard')
          }
        } else {
          await new Promise(resolve => setTimeout(resolve, 650))
          const role = email.startsWith('admin') ? 'admin' : 'user'
          setUser({ id: 'demo-member', name: mode === 'register' ? String(form.get('name') || 'New Member') : 'Alex Morgan', email, role })
          navigate(role === 'admin' ? '/admin' : '/dashboard')
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

function AppShell({ user, setUser, movies, onRefreshMovies }: { user: SessionUser; setUser: (user: SessionUser | null) => void; movies: Movie[]; onRefreshMovies: () => Promise<void> }) {
  function NotificationsPage() {
  return <><PageHeading eyebrow="UPDATES" title="Notifications" action={<button className="secondary-btn compact">Mark all as read</button>} /><div className="panel notification-list"><div className="notification-item unread"><div className="stat-icon green"><Film /></div><div><strong>Welcome to Cinemax Community</strong><p>Your account is ready. Start exploring the movie library.</p><time>Just now</time></div></div></div></>
}

function InvitePage() {
  const [copied, setCopied] = useState(false)
  const link = ${window.location.origin}/register?ref=CINEMAX-DEMO
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

function AdminPage({ movies, onOpenUpload, onRefreshMovies }: { movies: Movie[]; onOpenUpload: () => void; onRefreshMovies: () => Promise<void> }) {
  async function deleteMovie(id: string) {
    if (!supabase) return
    await supabase.from('movies').delete().eq('id', id)
    await onRefreshMovies()
  }

  const adminStats = [
    { label: 'Registered users', value: '1+', icon: Users },
    { label: 'Total movies', value: String(movies.length), icon: Film },
    { label: 'Total downloads', value: '0', icon: Download },
    { label: 'Pending reports', value: '0', icon: AlertTriangle },
  ]
  return (
    <>
      <PageHeading eyebrow="ADMIN CONTROL" title="Platform overview" action={<button className="primary-btn compact" onClick={onOpenUpload}><Upload size={16} /> Upload Movie</button>} />
      <div className="stats-grid admin-stats">{adminStats.map(stat => <article className="stat-card" key={stat.label}><div className="stat-icon green"><stat.icon /></div><div><strong>{stat.value}</strong><span>{stat.label}</span></div></article>)}</div>
      <div className="admin-grid">
        <section className="panel admin-chart">
          <div className="panel-title"><h3>Uploaded Movies ({movies.length})</h3><span>Manage catalog</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {movies.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <div><strong>{m.title}</strong> <span style={{ opacity: 0.6, fontSize: 13 }}>({m.genre} • {m.year})</span></div>
                {m.id.length > 5 && <button onClick={() => deleteMovie(m.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Delete movie"><Trash2 size={16} /></button>}
              </div>
            ))}
          </div>
        </section>
        <section className="panel admin-actions">
          <h3>Quick actions</h3>
          <button onClick={onOpenUpload}><Upload /> Upload new movie <ChevronRight /></button>
          <button><Users /> Manage users <ChevronRight /></button>
          <button><Bell /> Send announcement <ChevronRight /></button>
          <button><BarChart3 /> View analytics <ChevronRight /></button>
        </section>
      </div>
    </>
  )
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="empty-state"><div>{icon}</div><h2>{title}</h2><p>{text}</p></div>
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [movies, setMovies] = useState<Movie[]>(demoMovies)

  async function loadMovies() {
    if (!supabase) return
    const { data } = await supabase.from('movies').select('*').order('created_at', { ascending: false })
    if (data && data.length > 0) {
      setMovies([...(data as Movie[]), ...demoMovies])
    } else {
      setMovies(demoMovies)
    }
  }

  useEffect(() => {
    void loadMovies()
    if (!supabase) return
    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const role = await fetchUserRole(data.session.user.id)
        setUser({ id: data.session.user.id, name: String(data.session.user.user_metadata.full_name || 'Member'), email: data.session.user.email || '', role })
      }
    })
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing movies={movies} />} />
        <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} /> : <AuthPage mode="login" setUser={setUser} />} />
        <Route path="/register" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} /> : <AuthPage mode="register" setUser={setUser} />} />
        <Route path="/terms" element={<Landing movies={movies} />} />
        <Route path="/privacy" element={<Landing movies={movies} />} />
        <Route path="/*" element={user ? <AppShell user={user} setUser={setUser} movies={movies} onRefreshMovies={loadMovies} /> : <Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
