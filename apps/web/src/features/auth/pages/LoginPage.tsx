"use client";
import { useEffect, useRef, useState } from 'react'
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
import { normalizeCodeInput, MFA_CODE_LENGTH } from '../schemas'
import { useAuth } from '../hooks/useAuth'
import { useLoginProfiles } from '../hooks/useLoginProfiles'
import { useRequestPasswordReset } from '../hooks/usePasswordReset'
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
  const { user, signIn, supportsPassword, signInWithPassword, mfaPending, verifyMfa, cancelMfa } = useAuth()
  const { data, isLoading, isError, refetch } = useLoginProfiles()
  const requestReset = useRequestPasswordReset()
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
  const [code, setCode] = useState('')
  const codeInput = useRef<HTMLInputElement>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
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
    if (mfaPending) codeInput.current?.focus()
  }, [mfaPending])

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
      // La animación nunca debe bloquear el acceso: en una pestaña en segundo plano el navegador la pausa.
      await Promise.race([
        animate('.access-content',
          { opacity: .15, ...(reduced ? {} : { y: -motionTokens.distance.sm, scale: motionTokens.scale.press }) },
          { duration: reduced ? motionTokens.duration.fast : motionTokens.duration.normal, ease: motionTokens.easing.smooth }),
        new Promise((resolve) => setTimeout(resolve, 700)),
      ])
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
            <h2 id="access-title">{mfaPending ? 'Verifica tu identidad' : recovering ? 'Recupera tu acceso' : 'Inicia sesión'}</h2>
            {mfaPending && <p>Escribe el código de 6 dígitos de tu aplicación de autenticación.</p>}
            {recovering && !mfaPending && <p>Indica el correo de tu cuenta y te enviaremos un enlace.</p>}
          </div>
          {mfaPending ? (
            <form className="access-form" noValidate onSubmit={async event => {
              event.preventDefault()
              if (code.length !== MFA_CODE_LENGTH) {
                setCodeError('Escribe el código de 6 dígitos.')
                return
              }
              setCodeError(null)
              setSubmitting(true)
              try {
                await verifyMfa(code)
                navigate(from, { replace: true })
              } catch (reason) {
                setCodeError(reason instanceof Error ? reason.message : 'No pudimos verificar el código. Inténtalo de nuevo.')
              } finally {
                setSubmitting(false)
              }
            }}>
              <label htmlFor="login-code">Código de verificación</label>
              <input id="login-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={MFA_CODE_LENGTH}
                placeholder="000000" value={code} ref={codeInput} aria-invalid={codeError ? true : undefined}
                aria-describedby={codeError ? 'login-code-error' : undefined}
                onChange={event => setCode(normalizeCodeInput(event.target.value))} />
              {codeError && <p id="login-code-error" role="alert" className="access-error">{codeError}</p>}
              <button type="submit" className="access-submit" disabled={submitting}>
                {submitting ? 'Verificando…' : 'Verificar'}<ArrowUpRight size={17} aria-hidden="true" />
              </button>
              <button type="button" className="access-text-button access-back" disabled={submitting}
                onClick={() => { setCode(''); setCodeError(null); void cancelMfa() }}>Volver</button>
            </form>
          ) : (
          <form className="access-form" onSubmit={async event => {
            event.preventDefault()
            if (supportsPassword && !recovering) {
              const data = new FormData(event.currentTarget)
              setCredentialsError(null)
              setSubmitting(true)
              try {
                const outcome = await signInWithPassword(String(data.get('email') ?? ''), String(data.get('password') ?? ''))
                if (outcome === 'done') navigate(from, { replace: true })
              } catch (reason) {
                setCredentialsError(reason instanceof Error ? reason.message : 'No pudimos entrar. Inténtalo de nuevo.')
              } finally {
                setSubmitting(false)
              }
              return
            }
            if (recovering) {
              const email = String(new FormData(event.currentTarget).get('email') ?? '')
              setCredentialsError(null)
              setFormNotice(null)
              setSubmitting(true)
              try {
                await requestReset.mutateAsync(email)
                // Mismo aviso exista o no la cuenta: no se revela quién está registrado.
                setFormNotice('Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva. Revisa también el spam.')
              } catch (reason) {
                setCredentialsError(reason instanceof Error ? reason.message : 'No pudimos enviar el enlace. Inténtalo de nuevo.')
              } finally {
                setSubmitting(false)
              }
              return
            }
            setFormNotice('El acceso con correo y contraseña estará disponible al conectar las cuentas. Por ahora puedes entrar a la demo de abajo.')
          }}>
            <label htmlFor="login-email">Correo electrónico</label>
            <input id="login-email" name="email" type="email" autoComplete="email" placeholder="tu@vexa.space" required maxLength={254} />
            {!recovering && <>
              <div className="access-password-label"><label htmlFor="login-password">Contraseña</label>
                <button type="button" className="access-text-button min-h-11" onClick={() => { setRecovering(true); setFormNotice(null); setCredentialsError(null) }}>¿La olvidaste?</button>
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
              {recovering ? (submitting ? 'Enviando…' : 'Enviar enlace de recuperación') : submitting ? 'Entrando…' : 'Iniciar sesión'}<ArrowUpRight size={17} aria-hidden="true" />
            </motion.button>
            {recovering && <button type="button" className="access-text-button access-back" onClick={() => { setRecovering(false); setFormNotice(null); setCredentialsError(null) }}>Volver al inicio de sesión</button>}
            {credentialsError && <p role="alert" className="access-error">{credentialsError}</p>}
            {formNotice && <motion.output className="access-form-notice" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: motionTokens.duration.fast }}>{formNotice}</motion.output>}
          </form>
          )}
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
