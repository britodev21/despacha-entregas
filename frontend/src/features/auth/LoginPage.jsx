import { ClipboardList, Navigation, PackageCheck, UserCheck } from "lucide-react";
import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { toApiError } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import { canAccessPath, homePathFor } from "@/auth/permissions";
import { Logo } from "@/components/brand/Logo";
import { Alert } from "@/components/ui/Alert/Alert";
import { Button } from "@/components/ui/Button/Button";
import { FullPageLoader } from "@/components/ui/FullPageLoader/FullPageLoader";
import { PasswordField } from "@/components/ui/TextField/PasswordField";
import { TextField } from "@/components/ui/TextField/TextField";
import { ThemeToggle } from "@/components/ui/ThemeToggle/ThemeToggle";

import styles from "./LoginPage.module.css";

const FLOW = [
  { Icon: ClipboardList, title: "Cadastrar", text: "Pedido, cliente e endereço em segundos." },
  { Icon: UserCheck, title: "Distribuir", text: "Atribua ao entregador disponível." },
  { Icon: Navigation, title: "Acompanhar", text: "Status e localização durante a rota." },
  { Icon: PackageCheck, title: "Finalizar", text: "Comprovante e histórico de cada entrega." },
];

/**
 * Para onde ir após o login: a página que o usuário tentou abrir, desde que
 * seja um caminho interno (nunca outro site) e que o perfil possa acessar.
 * Senão, a tela inicial do perfil.
 */
function redirectTarget(path, user) {
  const internal =
    typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && path !== "/login";
  return internal && canAccessPath(user, path) ? path : homePathFor(user);
}

export function LoginPage() {
  const { status, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const identifierRef = useRef(null);
  const passwordRef = useRef(null);

  if (status === "loading") return <FullPageLoader label="Verificando sessão" />;
  if (status === "authenticated") {
    return <Navigate to={redirectTarget(location.state?.from, user)} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = {};
    if (!identifier.trim()) errors.identifier = "Informe seu e-mail ou telefone.";
    if (!password) errors.password = "Informe sua senha.";
    setFieldErrors(errors);
    setFormError(null);

    if (errors.identifier) return identifierRef.current?.focus();
    if (errors.password) return passwordRef.current?.focus();

    setSubmitting(true);
    try {
      const loggedUser = await login(identifier.trim(), password);
      navigate(redirectTarget(location.state?.from, loggedUser), { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      setFormError(
        apiError.status === 429
          ? "Muitas tentativas seguidas. Aguarde um minuto e tente novamente."
          : apiError.message,
      );
      setPassword("");
      // O alerta (role="alert") é anunciado por leitores de tela sozinho;
      // o foco vai para a senha, pronta para ser digitada de novo.
      requestAnimationFrame(() => passwordRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <aside className={styles.brand}>
        <Logo size="md" className={styles.brandLogo} />
        <div className={styles.brandBody}>
          <p className={styles.tagline}>Gestão de entregas simples e eficiente.</p>
          <ol className={styles.flow}>
            {FLOW.map(({ Icon, title, text }) => (
              <li key={title} className={styles.step}>
                <span className={styles.stepIcon}>
                  <Icon aria-hidden="true" />
                </span>
                <span>
                  <strong className={styles.stepTitle}>{title}</strong>
                  <span className={styles.stepText}>{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <svg className={styles.route} viewBox="0 0 400 120" aria-hidden="true">
          <path d="M10 100 C 90 100, 110 30, 190 40 S 300 100, 390 20" />
          <circle cx="10" cy="100" r="6" />
          <circle cx="390" cy="20" r="8" className={styles.routeEnd} />
        </svg>
      </aside>

      <main className={styles.main}>
        <ThemeToggle className={styles.theme} />

        <div className={styles.panel}>
          <Logo className={styles.mobileLogo} />
          <header className={styles.header}>
            <h1 className={styles.title}>Entrar</h1>
            <p className={styles.subtitle}>Acesse com seu e-mail ou telefone.</p>
          </header>

          {formError && <Alert tone="danger">{formError}</Alert>}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <TextField
              ref={identifierRef}
              label="E-mail ou telefone"
              name="identifier"
              size="lg"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              error={fieldErrors.identifier}
            />
            <PasswordField
              ref={passwordRef}
              label="Senha"
              name="password"
              size="lg"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password}
            />
            <Button type="submit" size="lg" fullWidth loading={submitting}>
              Entrar
            </Button>
          </form>

          <p className={styles.help}>
            Esqueceu a senha? Peça ao administrador da sua empresa para redefini-la.
          </p>
        </div>
      </main>
    </div>
  );
}
