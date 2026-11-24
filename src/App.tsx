import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Film, LogOut, Upload, X } from 'lucide-react'
import { Upload as TusUpload } from 'tus-js-client'
import { isSupabaseConfigured, supabase, supabaseUrl } from './lib/supabase'
import './App.css'

type SessionUser = {
  id: string
  name: string
  email: string
  role: 'user' | 'admin'
}

type AdminMovie = {
  id: string
  title: string
  release_year: number
  created_at: string
}

async function getSessionUser(authUser: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}): Promise<SessionUser> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', authUser.id)
    .single()

  if (error) throw error

  return {
    id: authUser.id,
    name: String(authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Member'),
    email: authUser.email || '',
    role: data.role === 'admin' ? 'admin' : 'user',
  }
}

function AuthPage({
  onSignedIn,
  initialError,
}: {
  onSignedIn: (user: SessionUser) => void
  initialError: string
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!supabase) {
      setError('Supabase is not configured. Add your Supabase URL and anon key to .env.')
      return
    }

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')

    if (!email || !password) {
      setError('Enter your email and password.')
      return
    }

    if (mode === 'register' && password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }

    setBusy(true)

    try {
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: String(form.get('name') || ''),
                username: String(form.get('username') || ''),
              },
            },
          })

      if (result.error) throw result.error

      if (!result.data.user || !result.data.session) {
        setError('Account created. Confirm your email, then sign in.')
        return
      }

      const user = await getSessionUser(result.data.user)
      onSignedIn(user)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div className="brand">
            <div className="brand-mark"><Film size={20} /></div>
            <span>CINEMAX</span>
            <small>COMMUNITY</small>
          </div>

          <span className="section-kicker">
            {mode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR ACCOUNT'}
          </span>
          <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>

          {mode === 'register' && (
            <>
              <label>Full name<input name="name" required /></label>
              <label>Username<input name="username" required /></label>
            </>
          )}

          <label>Email address<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" minLength={8} required /></label>

          {error && <div className="form-error" role="alert">{error}</div>}

          {!isSupabaseConfigured && (
            <p className="config-note">
              Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.
            </p>
          )}

          <button className="primary-btn auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <p className="auth-switch">
            {mode === 'login' ? 'Need an account?' : 'Already registered?'}{' '}
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setError('')
                setMode(mode === 'login' ? 'register' : 'login')
              }}
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </form>
      </section>
    </main>
  )
}

function uploadMovieResumable(
  file: File,
  path: string,
  accessToken: string,
  contentType: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!supabaseUrl) {
      reject(new Error('Supabase URL is not configured.'))
      return
    }

    const uploader = new TusUpload(file, {
      endpoint: `${supabaseUrl.replace(/\/$/, '')}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-upsert': 'false',
      },
      metadata: {
        bucketName: 'movies',
        objectName: path,
        contentType,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      removeFingerprintOnSuccess: true,
      onError: reject,
      onProgress: (uploaded, total) => {
        onProgress(Math.round((uploaded / total) * 100))
      },
      onSuccess: () => resolve(),
    })

    uploader.start()
  })
}

function MovieUploadForm({
  user,
  onClose,
  onUploaded,
}: {
  user: SessionUser
  onClose: () => void
  onUploaded: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }

    const form = new FormData(event.currentTarget)
    const file = form.get('movie_file')
    const title = String(form.get('title') || '').trim()
    const description = String(form.get('description') || '').trim()
    const language = String(form.get('language') || 'English').trim()
    const releaseYear = Number(form.get('release_year'))
    const durationMinutes = Number(form.get('duration_minutes') || 0)
    const featured = form.get('featured') === 'on'

    if (!(file instanceof File) || file.size === 0) {
      setError('Choose a movie file.')
      return
    }

    if (file.size > 1024 * 1024 * 1024) {
      setError('The movie exceeds the 1 GB limit set in this form.')
      return
    }

    if (!title || !description || !Number.isInteger(releaseYear) || releaseYear < 1888 || releaseYear > 2100) {
      setError('Enter a title, description, and valid release year.')
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    const contentTypes: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      mkv: 'video/x-matroska',
    }
    const contentType = file.type || contentTypes[extension]

    if (!contentType || !Object.values(contentTypes).includes(contentType)) {
      setError('Use an MP4, WebM, MOV, or MKV movie file.')
      return
    }

    setBusy(true)

    let moviePath = ''

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      const session = sessionData.session
      if (!session || session.user.id !== user.id) {
        throw new Error('Your session expired. Sign in again.')
      }

      const { data: roleRow, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single()

      if (roleError) throw roleError
      if (roleRow.role !== 'admin') {
        throw new Error('Only an admin can upload movies.')
      }

      const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'mp4'
      moviePath = `${session.user.id}/${crypto.randomUUID()}.${safeExtension}`

      await uploadMovieResumable(file, moviePath, session.access_token, contentType, setProgress)

      const { error: insertError } = await supabase.from('movies').insert({
        title,
        description,
        video_path: moviePath,
        release_year: releaseYear,
        language,
        duration_seconds: durationMinutes > 0 ? Math.round(durationMinutes * 60) : null,
        file_size_bytes: file.size,
        featured,
        published: true,
        created_by: session.user.id,
      })

      if (insertError) throw insertError

      onUploaded()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Movie upload failed.'

      if (moviePath) {
        const { error: cleanupError } = await supabase.storage.from('movies').remove([moviePath])
        if (cleanupError) {
          setError(`${message} Cleanup failed: ${cleanupError.message}`)
          setBusy(false)
          return
        }
      }

      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => !busy && onClose()}>
      <section
        className="movie-modal upload-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} disabled={busy} aria-label="Close">
          <X />
        </button>

        <form className="upload-form" onSubmit={submit}>
          <span className="section-kicker">ADMIN MOVIE LIBRARY</span>
          <h2 id="upload-title">Upload a movie</h2>

          <label>Movie title<input name="title" required maxLength={200} /></label>
          <label>Description<textarea name="description" required maxLength={5000} rows={4} /></label>
          <label>Release year<input name="release_year" type="number" min="1888" max="2100" required /></label>
          <label>Language<input name="language" defaultValue="English" required maxLength={80} /></label>
          <label>Duration (minutes)<input name="duration_minutes" type="number" min="0" /></label>
          <label>
            Movie file (MP4, WebM, MOV, or MKV; max 1 GB)
            <input name="movie_file" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" required />
          </label>
          <label className="upload-featured">
            <input name="featured" type="checkbox" />
            Feature this movie
          </label>

          {busy && (
            <div className="upload-progress">
              <progress value={progress} max="100" />
              <span>{progress}% uploaded</span>
            </div>
          )}

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="upload-actions">
            <button type="button" className="secondary-btn" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={busy}>
              {busy ? 'Uploading…' : 'Upload Movie'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function AdminPage({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [movies, setMovies] = useState<AdminMovie[]>([])
  const [loadingMovies, setLoadingMovies] = useState(true)
  const [error, setError] = useState('')

  async function loadMovies() {
    if (!supabase) return

    setLoadingMovies(true)
    setError('')

    const { data, error: queryError } = await supabase
      .from('movies')
      .select('id,title,release_year,created_at')
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message)
    } else {
      setMovies(data || [])
    }

    setLoadingMovies(false)
  }

  useEffect(() => {
    void loadMovies()
  }, [])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand">
            <div className="brand-mark"><Film size={20} /></div>
            <span>CINEMAX</span>
            <small>COMMUNITY</small>
          </div>
        </div>
        <div className="sidebar-footer">
          <button onClick={onSignOut}><LogOut size={18} /> Log out</button>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <span>Signed in as {user.email} · Admin</span>
        </header>

        <div className="app-content">
          <div className="page-heading">
            <div>
              <span className="section-kicker">ADMIN CONTROL</span>
              <h1>Movie management</h1>
            </div>
            <button className="primary-btn compact" onClick={() => setUploadOpen(true)}>
              <Upload size={16} /> Upload Movie
            </button>
          </div>

          <section className="panel notification-list">
            <h2>Uploaded movies ({movies.length})</h2>

            {loadingMovies && <p>Loading movies…</p>}
            {error && <div className="form-error" role="alert">{error}</div>}
            {!loadingMovies && !error && movies.length === 0 && <p>No movies uploaded yet.</p>}

            {movies.map(movie => (
              <div className="notification-item" key={movie.id}>
                <div className="stat-icon green"><Film /></div>
                <div>
                  <strong>{movie.title}</strong>
                  <p>{movie.release_year} · Added {new Date(movie.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>

      {uploadOpen && (
        <MovieUploadForm
          user={user}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false)
            void loadMovies()
          }}
        />
      )}
    </div>
  )
}

function MemberPage({ user, onSignOut }: { user: SessionUser; onSignOut: () => void }) {
  return (
    <main className="app-content">
      <div className="page-heading">
        <div>
          <span className="section-kicker">CINEMAX COMMUNITY</span>
          <h1>Welcome, {user.name}</h1>
          <p>Your account is signed in as a member.</p>
        </div>
        <button className="secondary-btn" onClick={onSignOut}>
          <LogOut size={16} /> Log out
        </button>
      </div>
    </main>
  )
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [startupError, setStartupError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      if (!supabase) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.getSession()
      if (error) throw error

      if (data.session?.user) {
        const restoredUser = await getSessionUser(data.session.user)
        if (!cancelled) setUser(restoredUser)
      }

      if (!cancelled) setLoading(false)
    }

    void restoreSession().catch(caught => {
      if (!cancelled) {
        setStartupError(caught instanceof Error ? caught.message : 'Could not load your account.')
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  async function signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setStartupError(error.message)
        return
      }
    }

    setUser(null)
  }

  if (loading) {
    return <main className="app-content"><p>Loading your account…</p></main>
  }

  if (!user) {
    return <AuthPage onSignedIn={setUser} initialError={startupError} />
  }

  if (user.role === 'admin') {
    return <AdminPage user={user} onSignOut={() => void signOut()} />
  }

  return <MemberPage user={user} onSignOut={() => void signOut()} />
}
