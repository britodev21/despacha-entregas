import {
  Camera,
  Check,
  ClipboardList,
  FileCheck2,
  LockKeyhole,
  MapPinned,
  MessageCircle,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button/Button";

import entregadorImg from "./assets/entregador.webp";
import mapaImg from "./assets/mapa.webp";
import operacaoImg from "./assets/operacao.webp";
import painelImg from "./assets/painel.webp";
import { CONTACT_URL } from "./contact";
import styles from "./landing.module.css";

const YEAR = new Date().getFullYear();

const STEPS = [
  {
    Icon: ClipboardList,
    title: "Cadastrar",
    text: "Cliente e endereço em segundos. O CEP preenche a rua sozinho.",
  },
  {
    Icon: UserCheck,
    title: "Distribuir",
    text: "Escolha o entregador com um toque. Ele vê a entrega na hora, no celular.",
  },
  {
    Icon: MapPinned,
    title: "Acompanhar",
    text: "Veja no mapa quem está em rota e o que precisa da sua atenção.",
  },
  {
    Icon: Camera,
    title: "Finalizar",
    text: "Foto e assinatura de quem recebeu viram o comprovante da entrega.",
  },
];

const FEATURES = [
  {
    eyebrow: "Painel do dia",
    title: "Saiba como está o dia sem perguntar a ninguém",
    text: "Quantas entregas saíram, quantas faltam e quais tiveram problema — atualizado sozinho, numa tela só.",
    bullets: ["Ocorrências sempre em destaque", "Histórico e relatório por entregador"],
    image: {
      src: painelImg,
      width: 1120,
      height: 240,
      alt: "Painel do DESPACHA com entregas do dia, pendentes, atribuídas e em rota",
    },
  },
  {
    eyebrow: "Mapa ao vivo",
    title: "Chega de perguntar “cadê o motoboy?”",
    text: "Acompanhe cada entregador enquanto ele faz a entrega. Fora da rota, a localização não é coletada.",
    bullets: ["Atualiza a cada 15 segundos", "Privacidade do entregador respeitada"],
    image: {
      src: mapaImg,
      width: 1200,
      height: 750,
      alt: "Mapa com a posição de três entregadores em rota e a entrega de cada um",
    },
  },
  {
    eyebrow: "No celular do entregador",
    title: "Tudo o que ele precisa, sem instalar nada",
    text: "Endereço, um toque para abrir no Google Maps ou Waze, quanto cobrar e o troco já calculado. No fim, foto e assinatura.",
    bullets: ["Funciona no navegador do celular", "Botões grandes, feitos para a rua"],
    image: {
      src: entregadorImg,
      width: 780,
      height: 1688,
      alt: "Tela do entregador com endereço, botões de navegação, valor a cobrar e botão de finalizar",
      phone: true,
    },
  },
];

const TRUST = [
  { Icon: UsersRound, text: "Cada empresa vê só os próprios dados" },
  { Icon: LockKeyhole, text: "Acesso por perfil: administrador, operador e entregador" },
  { Icon: FileCheck2, text: "Comprovante com foto, assinatura e horário" },
  { Icon: ShieldCheck, text: "LGPD: localização só durante a entrega, apagada em 30 dias" },
];

function DemoButton({ size = "lg", className }) {
  if (!CONTACT_URL) return null;
  return (
    <Button
      as="a"
      href={CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      size={size}
      className={className}
    >
      <MessageCircle aria-hidden="true" />
      Agendar demonstração
      <span className="sr-only"> (abre o WhatsApp)</span>
    </Button>
  );
}

/** Apresentação pública do DESPACHA (raiz do site, para visitantes). */
export function LandingPage() {
  return (
    <div className={styles.page}>
      <a href="#conteudo" className="sr-only">
        Pular para o conteúdo
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Logo size="sm" />
          <nav className={styles.headerNav} aria-label="Acesso">
            <Button as={Link} to="/login" variant="ghost">
              Entrar
            </Button>
            <DemoButton size="md" className={styles.headerDemo} />
          </nav>
        </div>
      </header>

      <main id="conteudo">
        {/* ------------------------------------------------------------ hero */}
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>Gestão de entregas para pequenos negócios</p>
            <h1 id="hero-title" className={styles.heroTitle}>
              Saiba onde está cada entrega, do pedido à porta do cliente.
            </h1>
            <p className={styles.lead}>
              O DESPACHA organiza seus entregadores, mostra o mapa ao vivo e guarda o comprovante de
              cada entrega. Funciona no navegador do celular — sem instalar nada.
            </p>
            <div className={styles.heroActions}>
              <DemoButton />
              <Button as={Link} to="/login" variant="secondary" size="lg">
                Já sou cliente
              </Button>
            </div>
            <ul className={styles.heroChecks}>
              {["Sem instalar aplicativo", "Comece no mesmo dia", "Dados protegidos (LGPD)"].map(
                (item) => (
                  <li key={item}>
                    <Check aria-hidden="true" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>

          <div className={styles.heroVisual}>
            <figure className={styles.browser}>
              <div className={styles.browserBar} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <img
                src={operacaoImg}
                width="1440"
                height="900"
                alt="Quadro de operação do DESPACHA com entregas pendentes, atribuídas, em rota e com ocorrência"
                fetchPriority="high"
              />
            </figure>
            <figure className={styles.heroPhone}>
              <img
                src={entregadorImg}
                width="780"
                height="1688"
                alt="A mesma entrega no celular do entregador"
                decoding="async"
              />
            </figure>
          </div>
        </section>

        {/* -------------------------------------------------- como funciona */}
        <section className={styles.section} aria-labelledby="passos-title">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Como funciona</p>
            <h2 id="passos-title" className={styles.sectionTitle}>
              Do pedido à entrega em 4 passos
            </h2>
          </div>
          <ol className={styles.steps}>
            {STEPS.map(({ Icon, title, text }, index) => (
              <li key={title} className={styles.step}>
                <span className={styles.stepIcon} aria-hidden="true">
                  <Icon />
                </span>
                <h3 className={styles.stepTitle}>
                  <span className={styles.stepNumber}>{index + 1}.</span> {title}
                </h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------------ benefícios */}
        <section className={styles.section} aria-label="O que o DESPACHA faz por você">
          <div className={styles.features}>
            {FEATURES.map(({ eyebrow, title, text, bullets, image }, index) => (
              <article
                key={eyebrow}
                className={index % 2 === 1 ? `${styles.feature} ${styles.reverse}` : styles.feature}
              >
                <div className={styles.featureText}>
                  <p className={styles.eyebrow}>{eyebrow}</p>
                  <h3 className={styles.featureTitle}>{title}</h3>
                  <p className={styles.featureLead}>{text}</p>
                  <ul className={styles.bullets}>
                    {bullets.map((bullet) => (
                      <li key={bullet}>
                        <Check aria-hidden="true" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
                <figure className={image.phone ? styles.featurePhone : styles.featureShot}>
                  <img
                    src={image.src}
                    width={image.width}
                    height={image.height}
                    alt={image.alt}
                    loading="lazy"
                    decoding="async"
                  />
                </figure>
              </article>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------- confiança */}
        <section className={styles.section} aria-labelledby="seguranca-title">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Segurança</p>
            <h2 id="seguranca-title" className={styles.sectionTitle}>
              Seus dados e os dos seus clientes, protegidos
            </h2>
          </div>
          <ul className={styles.trust}>
            {TRUST.map(({ Icon, text }) => (
              <li key={text}>
                <Icon aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------- chamada final */}
        <section className={styles.cta} aria-labelledby="cta-title">
          <h2 id="cta-title" className={styles.ctaTitle}>
            Quer ver funcionando com as suas entregas?
          </h2>
          <p className={styles.ctaText}>
            {CONTACT_URL
              ? "Uma conversa de 15 minutos pelo WhatsApp, com o sistema rodando."
              : "Já tem acesso? Entre e comece agora."}
          </p>
          <div className={styles.ctaActions}>
            {CONTACT_URL ? (
              <DemoButton />
            ) : (
              <Button as={Link} to="/login" size="lg">
                Entrar
              </Button>
            )}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Logo size="sm" />
        <p>© {YEAR} DESPACHA · Gestão de entregas simples para pequenos negócios</p>
        <Link to="/login" className={styles.footerLink}>
          Entrar
        </Link>
      </footer>
    </div>
  );
}
