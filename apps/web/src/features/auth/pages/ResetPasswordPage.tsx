import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowUpRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { BackgroundLines } from '@/components/BackgroundLines'
import { ThemeToggle } from '@/app/ThemeToggle'
import { resetPasswordSchema } from '../schemas'
import { useCompletePasswordReset, usePasswordRecovery } from '../hooks/usePasswordReset'
import './login.css'

/** Pantalla pública a la que llega el enlace del correo de recuperación. */
export default function ResetPasswordPage() {
  const recovery = usePasswordRecovery()
  const complete = useCompletePasswordReset()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const parsed = resetPasswordSchema.safeParse({
      newPassword: String(data.get('newPassword') ?? ''),
      confirmPassword: String(data.get('confirmPassword') ?? ''),
    })
    if (!parsed.success) {
      const next: typeof errors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'confirmPassword' ? 'confirmPassword' : 'newPassword'
        next[key] ??= issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    setFailure(null)
    try {
      await complete.mutateAsync(parsed.data.newPassword)
      toast.success('Contraseña actualizada. Inicia sesión con la nueva.')
      navigate('/login', { replace: true })
    } catch (reason) {
      setFailure(reason instanceof Error ? reason.message : 'No pudimos actualizar la contraseña. Inténtalo de nuevo.')
    }
  }

  return (
    <main className="access-shell">
      <BackgroundLines />
      <header className="access-topbar">
        <div className="flex items-center gap-3"><BrandLogo className="size-10" decorative /><span className="font-display text-sm font-semibold">VEXA Studio</span></div>
        <ThemeToggle />
      </header>
      <div className="mx-auto my-auto w-full max-w-[440px] py-6">
        <section className="access-panel" aria-labelledby="reset-title">
          <div className="access-panel-heading">
            <h2 id="reset-title">{recovery === 'invalid' ? 'Enlace no válido' : 'Crea tu nueva contraseña'}</h2>
            {recovery === 'ready' && <p>Usa al menos 12 caracteres, con mayúsculas, minúsculas y números.</p>}
          </div>
          {recovery === 'checking' && (
            <output className="flex min-h-11 items-center justify-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Verificando tu enlace…
            </output>
          )}
          {recovery === 'invalid' && (
            <div className="access-form">
              <p className="access-form-notice" role="alert">El enlace venció, ya se usó o no es válido. Pide uno nuevo desde el inicio de sesión.</p>
              <Link to="/login" className="access-submit">Volver al inicio de sesión<ArrowUpRight size={17} aria-hidden="true" /></Link>
            </div>
          )}
          {recovery === 'ready' && (
            <form className="access-form" noValidate onSubmit={submit}>
              <label htmlFor="reset-password">Nueva contraseña</label>
              <div className="access-password">
                <input id="reset-password" name="newPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                  required aria-invalid={errors.newPassword ? true : undefined}
                  aria-describedby={errors.newPassword ? 'reset-password-error' : undefined} />
                <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword}
                  onClick={() => setShowPassword(value => !value)}>
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </div>
              {errors.newPassword && <p id="reset-password-error" role="alert" className="access-error">{errors.newPassword}</p>}
              <label htmlFor="reset-confirm">Confirma la contraseña</label>
              <input id="reset-confirm" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                required aria-invalid={errors.confirmPassword ? true : undefined}
                aria-describedby={errors.confirmPassword ? 'reset-confirm-error' : undefined} />
              {errors.confirmPassword && <p id="reset-confirm-error" role="alert" className="access-error">{errors.confirmPassword}</p>}
              {failure && <p role="alert" className="access-error">{failure}</p>}
              <button type="submit" className="access-submit" disabled={complete.isPending}>
                {complete.isPending ? 'Guardando…' : 'Guardar contraseña'}<ArrowUpRight size={17} aria-hidden="true" />
              </button>
            </form>
          )}
        </section>
      </div>
      <footer className="access-footer">Ideas distintas. Un espacio compartido.</footer>
    </main>
  )
}
