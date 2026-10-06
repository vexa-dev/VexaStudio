"use client";
import { useEffect, useState } from 'react'
import { motion, useAnimate } from 'motion/react'
import { BrandLogo } from '@/components/BrandLogo'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { ArrowUpRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { ThemeToggle } from '@/app/ThemeToggle'
import { BackgroundLines } from '@/components/BackgroundLines'
import { RobotIdleArtwork } from '@/components/RobotIdleArtwork'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { motionTokens } from '@/lib/motion-tokens'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { stagger } from '@/lib/utils'
import { useAuth } from '../hooks/useAuth'
import { useLoginProfiles } from '../hooks/useLoginProfiles'
import './login.css'

const LAST_USER_KEY = 'vexa-studio.last-user'

function readLastUser(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY)
  } catch {
    return null
  }
}

export default function LoginPage() {
  const { user, signIn, supportsPassword, signInWithPassword } = useAuth()
  const { data, isLoading, isError, refetch } = useLoginProfiles()
  const navigate = useNavigate()
  const location = useLocation()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [lastUserId] = useState(readLastUser)
  const [error, setError] = useState<string | null>(null)
  const [blinking, setBlinking] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [formNotice, setFormNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [credentialsError, setCredentialsError] = useState<string | null>(null)
  const reduced = useReducedMotion()
  const [scope, animate] = useAnimate()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  useEffect(() => {
    if (!scope.current) return
    const selectors = ['.access-topbar', '.access-intro', '.access-panel', '.access-footer']
    const controls = selectors.map((selector, index) => animate(selector,
      { opacity: [.35, 1], ...(reduced ? {} : { y: [motionTokens.distance.md, 0] }) },
      { duration: reduced ? motionTokens.duration.fast : motionTokens.duration.slow,
        delay: reduced ? 0 : index * motionTokens.login.staggerSeconds, ease: motionTokens.easing.smooth }))
    return () => controls.forEach(control => control.stop())
  }, [animate, reduced, scope])

  useEffect(() => {
    if (reduced) return
    const timing = motionTokens.mascot
    const delay = blinking ? timing.blinkMs : timing.blinkPauseMs.min + Math.random() * (timing.blinkPauseMs.max - timing.blinkPauseMs.min)
    const timeout = setTimeout(() => setBlinking(value => !value), delay)
    return () => clearTimeout(timeout)
  }, [blinking, reduced])

  if (user && pendingId === null) return <Navigate to={from} replace />

  // El último usuario va primero: volver a entrar es un toque.
  const profiles = data ? [...data].sort((a, b) => Number(b.id === lastUserId) - Number(a.id === lastUserId)) : data

  const choose = async (userId: string) => {
    setError(null)
    setPendingId(userId)
    try {
      await animate('.access-content',
        { opacity: .15, ...(reduced ? {} : { y: -motionTokens.distance.sm, scale: motionTokens.scale.press }) },
        { duration: reduced ? motionTokens.duration.fast : motionTokens.duration.normal, ease: motionTokens.easing.smooth })
      await signIn(userId)
      try {
        localStorage.setItem(LAST_USER_KEY, userId)
      } catch {
        // Sin localStorage no se recuerda el último usuario.
      }
      navigate(from, { replace: true })
    } catch {
      setError('No pudimos entrar. Inténtalo de nuevo.')
      await animate('.access-content', { opacity: 1, y: 0, scale: 1 }, { duration: motionTokens.duration.fast })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <main ref={scope} className="access-shell" data-entering={pendingId !== null}>
      <BackgroundLines />
      <header className="access-topbar">
        <div className="flex items-center gap-3"><BrandLogo className="size-10" decorative /><span className="font-display text-sm font-semibold">VEXA Studio</span></div>
        <ThemeToggle />
      </header>
      <div className="access-content">
        <div className="access-intro">
          <p className="access-eyebrow">UN MISMO HORIZONTE</p>
          <h1>Tu espacio.<br /><span>Tu ritmo.</span></h1>
          <p className="access-description">Un lugar para crear, avanzar y trabajar juntos.</p>
          <div className="access-mascot"><RobotIdleArtwork blinking={blinking} still={reduced} /></div>
        </div>
        <section className="access-panel" aria-labelledby="access-title">
          <div className="access-panel-heading">
            <h2 id="access-title">{recovering ? 'Recupera tu acceso' : 'Inicia sesión'}</h2>
            {recovering && <p>Indica el correo de tu cuenta.</p>}
          </div>
          <form className="access-form" onSubmit={async event => {
            event.preventDefault()
            if (supportsPassword && !recovering) {
              const data = new FormData(event.currentTarget)
              setCredentialsError(null)
              setSubmitting(true)
              try {
                await signInWithPassword(String(data.get('email') ?? ''), String(data.get('password') ?? ''))
                navigate(from, { replace: true })
              } catch (reason) {
                setCredentialsError(reason instanceof Error ? reason.message : 'No pudimos entrar. Inténtalo de nuevo.')
              } finally {
                setSubmitting(false)
              }
              return
            }
            setFormNotice(recovering
              ? (supportsPassword
                ? 'Para recuperar tu acceso, pide a un administrador de VEXA que te envíe una invitación nueva.'
                : 'La recuperación estará disponible al conectar las cuentas. Por ahora puedes entrar a la demo de abajo.')
              : 'El acceso con correo y contraseña estará disponible al conectar las cuentas. Por ahora puedes entrar a la demo de abajo.')
          }}>
            <label htmlFor="login-email">Correo electrónico</label>
            <input id="login-email" name="email" type="email" autoComplete="email" placeholder="tu@vexa.space" required maxLength={254} />
            {!recovering && <>
              <div className="access-password-label"><label htmlFor="login-password">Contraseña</label>
                <button type="button" className="access-text-button" onClick={() => { setRecovering(true); setFormNotice(null) }}>¿La olvidaste?</button>
              </div>
              <div className="access-password">
                <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Tu contraseña" required />
                <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
            </>}
            <motion.button type="submit" className="access-submit" disabled={pendingId !== null || submitting}
              whileHover={reduced ? undefined : { y: -motionTokens.login.hoverPx }}
              whileTap={reduced ? undefined : { scale: motionTokens.scale.press }}
              transition={{ duration: motionTokens.duration.fast }}>
              {recovering ? (supportsPassword ? 'Ver cómo recuperarla' : 'Enviar enlace de recuperación') : submitting ? 'Entrando…' : 'Iniciar sesión'}<ArrowUpRight size={17} aria-hidden="true" />
            </motion.button>
            {recovering && <button type="button" className="access-text-button access-back" onClick={() => { setRecovering(false); setFormNotice(null) }}>Volver al inicio de sesión</button>}
            {credentialsError && <p role="alert" className="access-error">{credentialsError}</p>}
            {formNotice && <motion.output className="access-form-notice" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: motionTokens.duration.fast }}>{formNotice}</motion.output>}
          </form>
          {!supportsPassword && <>
          <div className="access-demo-divider"><span>O explora la demo</span></div>
          {error && <p role="alert" className="access-error">{error}</p>}
      {isError ? (
        <ErrorState message="No se pudo cargar la lista de socios." onRetry={() => refetch()} />
      ) : (
        <ul className="access-profiles" aria-label="Perfiles de acceso" aria-busy={pendingId !== null || isLoading}>
          {isLoading
            ? Array.from({ length: 4 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-[52px]" />
                </li>
              ))
            : profiles?.map((profile, index) => (
                <li key={profile.id} className="enter" style={stagger(index + 1)}>
                  <motion.button
                    type="button"
                    disabled={pendingId !== null}
                    onClick={() => choose(profile.id)}
                    className="access-profile"
                    whileHover={reduced ? undefined : { y: -motionTokens.login.hoverPx }}
                    whileTap={reduced ? undefined : { scale: motionTokens.scale.press }}
                    transition={{ duration: motionTokens.duration.fast }}
                  >
                    <Avatar name={profile.name} src={profile.avatarUrl} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{profile.name.split(' ')[0]}</span>
                      {profile.id === lastUserId ? <span className="text-xs text-muted">Último acceso</span> : null}
                    </span>
                    {pendingId === profile.id ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowUpRight className="access-arrow size-4" aria-hidden="true" />}
                  </motion.button>
                </li>
              ))}
        </ul>
      )}
          <p className="access-note">Perfiles de prueba · Sin contraseña</p>
          </>}
          <output className="sr-only" aria-live="polite">{pendingId ? 'Entrando al estudio…' : ''}</output>
        </section>
      </div>
      <footer className="access-footer">Ideas distintas. Un espacio compartido.</footer>
    </main>
  )
}
