import { ArrowRight, BookOpen, Check, CircleCheck, Headset, Navigation, X } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button/Button";
import { PublicLayout } from "@/layouts/PublicLayout";
import { cx } from "@/lib/cx";
import { useReveal } from "@/lib/useReveal";

import entregadorImg from "./assets/entregador.webp";
import garupaImg from "./assets/fotos/garupa.webp";
import scooterImg from "./assets/fotos/scooter-noite.webp";
import suporteImg from "./assets/fotos/suporte.webp";
import mapaImg from "./assets/mapa.webp";
import operacaoImg from "./assets/operacao.webp";
import { CONTACT_URL } from "./contact";
import {
  AUDIENCE,
  GAINS,
  HOME_FAQ,
  PAINS,
  SEGMENTS,
  SMALL_FEATURES,
  STATS,
  STEPS,
  TRUST,
} from "./content";
import { DemoButton, SupportButton } from "./DemoButton";
import { FaqList } from "./FaqList";
import styles from "./landing.module.css";

/** Apresentação pública do DESPACHA (raiz do site, para visitantes). */
export function LandingPage() {
  const pageRef = useRef(null);
  useReveal(pageRef);

  return (
    <PublicLayout>
      <div ref={pageRef}>
        {/* ============================================================ hero */}
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroText}>
              <p className={styles.badge}>Gestão de entregas para pequenos negócios</p>
              <h1 id="hero-title" className={styles.heroTitle}>
                Saiba onde está <mark className={styles.highlight}>cada entrega</mark>.
              </h1>
              <p className={styles.lead}>
                Organize seus entregadores, acompanhe o mapa ao vivo e guarde o comprovante. Tudo
                pelo navegador, sem instalar nada.
              </p>
              <div className={styles.heroActions}>
                <DemoButton />
                <Button as={Link} to="/#como-funciona" variant="secondary" size="lg">
                  Ver como funciona
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div className={styles.heroVisual}>
              <figure className={styles.browser}>
                <div className={styles.browserBar} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <p className={styles.browserUrl}>Operação</p>
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
                  alt="A mesma entrega no celular do entregador, com botão para finalizar"
                  decoding="async"
                />
              </figure>
              {/* Cartões ilustrativos do que o sistema mostra (decorativos). */}
              <div className={cx(styles.floatCard, styles.floatTop)} aria-hidden="true">
                <span className={cx(styles.floatIcon, styles.floatSuccess)}>
                  <CircleCheck />
                </span>
                <span>
                  <strong>Entrega #3 concluída</strong>
                  <small>Foto e assinatura salvas</small>
                </span>
              </div>
              <div className={cx(styles.floatCard, styles.floatBottom)} aria-hidden="true">
                <span className={cx(styles.floatIcon, styles.floatRoute)}>
                  <Navigation />
                </span>
                <span>
                  <strong>Carla está em rota</strong>
                  <small>Posição atualizada há 15 s</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================= segmentos */}
        <section className={styles.segments} aria-label="Ramos atendidos">
          <p>Para quem entrega todo dia:</p>
          <ul>
            {SEGMENTS.map((segment) => (
              <li key={segment}>{segment}</li>
            ))}
          </ul>
        </section>

        {/* ===================================================== antes/depois */}
        <section className={styles.section} aria-labelledby="problema-title">
          <div className={styles.compare}>
            <figure className={styles.comparePhoto} data-reveal>
              <img
                src={garupaImg}
                width="1200"
                height="800"
                alt="Entregador de scooter com caixa de entregas na garupa, em movimento pela cidade"
                loading="lazy"
                decoding="async"
              />
            </figure>
            <div data-reveal>
              <h2 id="problema-title" className={styles.sectionTitle}>
                Entregar bem não precisa ser no grito
              </h2>
              <p className={styles.sectionText}>
                Troque o vai e vem de mensagens por um quadro que mostra tudo.
              </p>
              <div className={styles.compareCols}>
                <div className={styles.compareCard}>
                  <h3>Sem o DESPACHA</h3>
                  <ul>
                    {PAINS.map((item) => (
                      <li key={item}>
                        <X aria-hidden="true" className={styles.iconBad} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={cx(styles.compareCard, styles.compareGood)}>
                  <h3>Com o DESPACHA</h3>
                  <ul>
                    {GAINS.map((item) => (
                      <li key={item}>
                        <Check aria-hidden="true" className={styles.iconGood} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ como funciona (timeline) */}
        <section
          id="como-funciona"
          className={cx(styles.section, styles.anchor)}
          aria-labelledby="passos-title"
        >
          <div className={styles.sectionHead} data-reveal>
            <h2 id="passos-title" className={styles.sectionTitle}>
              Do pedido à porta em 4 passos
            </h2>
            <p className={styles.sectionText}>Se a sua equipe usa WhatsApp, ela usa o DESPACHA.</p>
          </div>
          <ol className={styles.timeline}>
            {STEPS.map(({ Icon, title, text }) => (
              <li key={title} className={styles.timelineItem} data-reveal>
                <span className={styles.timelineIcon} aria-hidden="true">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ============================================= funcionalidades (bento) */}
        <section
          id="funcionalidades"
          className={cx(styles.section, styles.anchor)}
          aria-labelledby="func-title"
        >
          <div className={styles.sectionHead} data-reveal>
            <p className={styles.eyebrow}>Funcionalidades</p>
            <h2 id="func-title" className={styles.sectionTitle}>
              Tudo o que a sua entrega precisa, num lugar só
            </h2>
          </div>
          <div className={styles.bento}>
            <article className={cx(styles.tile, styles.tileWide, styles.tileBrand)} data-reveal>
              <div className={styles.tileText}>
                <h3>Quadro da operação</h3>
                <p>Pendentes, em rota e ocorrências em colunas que se atualizam sozinhas.</p>
              </div>
              <div className={styles.tileShot}>
                <img
                  src={operacaoImg}
                  width="1440"
                  height="900"
                  alt="Quadro da operação com as entregas organizadas por status"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </article>
            <article className={cx(styles.tile, styles.tileTall, styles.tileDark)} data-reveal>
              <div className={styles.tileText}>
                <h3>No celular do entregador</h3>
                <p>Endereço, Maps ou Waze com um toque e botões grandes, feitos para a rua.</p>
              </div>
              <div className={styles.tilePhone}>
                <img
                  src={entregadorImg}
                  width="780"
                  height="1688"
                  alt="Tela do entregador com endereço, valor a cobrar e botão de finalizar"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </article>
            <article className={cx(styles.tile, styles.tileWide)} data-reveal>
              <div className={styles.tileText}>
                <h3>Mapa ao vivo</h3>
                <p>Quem está em rota e onde, a cada 15 segundos. Fora da rota, nada é coletado.</p>
              </div>
              <div className={styles.tileShot}>
                <img
                  src={mapaImg}
                  width="1200"
                  height="750"
                  alt="Mapa com a posição de três entregadores em rota"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </article>
            {SMALL_FEATURES.map(({ Icon, title, text, tone }) => (
              <article
                key={title}
                className={cx(
                  styles.tileSmall,
                  tone === "success" && styles.toneSuccess,
                  tone === "accent" && styles.toneAccent,
                )}
                data-reveal
              >
                <span className={styles.tileIcon} aria-hidden="true">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ========================================================= números */}
        <section className={styles.stats} aria-label="O DESPACHA em números">
          <ul>
            {STATS.map(({ value, label }) => (
              <li key={label} data-reveal>
                <strong>{value}</strong>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ======================================== para quem é (assimétrico) */}
        <section
          id="segmentos"
          className={cx(styles.section, styles.anchor)}
          aria-labelledby="seg-title"
        >
          <div className={styles.sectionHead} data-reveal>
            <h2 id="seg-title" className={styles.sectionTitle}>
              Do balcão à porta, em qualquer ramo
            </h2>
            <p className={styles.sectionText}>
              Tem entregadores próprios? O DESPACHA organiza o caminho de cada pedido.
            </p>
          </div>
          <div className={styles.audience}>
            {AUDIENCE.map(({ title, text, image, width, height, alt }, index) => (
              <article
                key={title}
                className={cx(styles.audienceCard, index === 0 && styles.audienceMain)}
                data-reveal
              >
                <img
                  src={image}
                  width={width}
                  height={height}
                  alt={alt}
                  loading="lazy"
                  decoding="async"
                />
                <div className={styles.audienceText}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ======================================================= segurança */}
        <section className={styles.section} aria-labelledby="seguranca-title">
          <div className={styles.trustPanel} data-reveal>
            <div className={styles.trustIntro}>
              <p className={styles.eyebrow}>Segurança</p>
              <h2 id="seguranca-title" className={styles.sectionTitle}>
                Seus dados e os dos seus clientes, protegidos
              </h2>
              <Link to="/privacidade" className={styles.textLink}>
                Como tratamos os dados (LGPD) <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <ul className={styles.trust}>
              {TRUST.map(({ Icon, title, text }) => (
                <li key={title}>
                  <Icon aria-hidden="true" />
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ================================================ suporte + perguntas */}
        <section id="faq" className={cx(styles.section, styles.anchor)} aria-labelledby="faq-title">
          <div className={styles.help}>
            <aside className={styles.helpAside} data-reveal>
              <h2 id="faq-title" className={styles.sectionTitle}>
                Dúvidas? A gente responde.
              </h2>
              <p className={styles.sectionText}>
                Suporte de gente de verdade, em português, do primeiro cadastro ao dia a dia.
              </p>
              <figure className={styles.helpPhoto}>
                <img
                  src={suporteImg}
                  width="1000"
                  height="821"
                  alt="Atendente de suporte com headset sorrindo em frente ao computador"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <ul className={styles.helpList}>
                <li>
                  <Headset aria-hidden="true" />
                  Ajuda para cadastrar a equipe no começo
                </li>
                <li>
                  <BookOpen aria-hidden="true" />
                  Central de ajuda com guias para cada perfil
                </li>
              </ul>
              <div className={styles.helpActions}>
                <SupportButton variant="secondary" />
                <Link to="/suporte" className={styles.textLink}>
                  Abrir a Central de ajuda <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </aside>
            <div className={styles.helpFaq} data-reveal>
              <FaqList items={HOME_FAQ} />
            </div>
          </div>
        </section>

        {/* =================================================== chamada final */}
        <section className={styles.cta} aria-labelledby="cta-title" data-reveal>
          <img src={scooterImg} alt="" loading="lazy" decoding="async" className={styles.ctaBg} />
          <div className={styles.ctaContent}>
            <h2 id="cta-title" className={styles.ctaTitle}>
              Pronto para entregar com mais controle?
            </h2>
            <p className={styles.ctaText}>
              {CONTACT_URL
                ? "Em 15 minutos pelo WhatsApp você vê o DESPACHA rodando com o seu jeito de entregar."
                : "Já tem acesso? Entre e comece agora."}
            </p>
            <div className={styles.ctaActions}>
              <DemoButton />
              <Button as={Link} to="/login" variant="secondary" size="lg">
                Entrar
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
