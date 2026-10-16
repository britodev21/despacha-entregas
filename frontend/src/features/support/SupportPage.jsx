import { ArrowRight, Search, SearchX } from "lucide-react";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";

import { CONTACT_URL } from "@/features/landing/contact";
import { SupportButton } from "@/features/landing/DemoButton";
import { FaqList } from "@/features/landing/FaqList";
import { PublicLayout } from "@/layouts/PublicLayout";
import { cx } from "@/lib/cx";
import { matchesQuery } from "@/lib/searchText";
import { useReveal } from "@/lib/useReveal";

import { FAQ_CATEGORIES, GUIDES } from "./content";
import styles from "./support.module.css";

const STATUS_TEXT = {
  checking: "Verificando o sistema",
  ok: "Todos os sistemas funcionando",
  down: "Instabilidade detectada, estamos verificando",
};

/** Consulta o /health da própria API (mesma origem; nada vai para terceiros). */
function useSystemStatus() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    fetch("/api/v1/health", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json().then((body) => response.ok && body.status === "ok"))
      .then((ok) => setStatus(ok ? "ok" : "down"))
      .catch(() => setStatus("down"))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);
  return status;
}

/**
 * Abas de guia por perfil, no padrão ARIA (tablist/tab/tabpanel): setas,
 * Home e End trocam de aba; só a aba ativa entra na ordem do Tab.
 */
function GuideTabs() {
  const baseId = useId();
  const [active, setActive] = useState(0);
  const tabRefs = useRef([]);

  const select = (index) => {
    const next = (index + GUIDES.length) % GUIDES.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event) => {
    const keys = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: GUIDES.length - 1 };
    if (event.key in keys) {
      event.preventDefault();
      select(keys[event.key]);
    }
  };

  const guide = GUIDES[active];
  const GuideIcon = guide.Icon;

  return (
    <div className={styles.tabs}>
      <div role="tablist" aria-label="Escolha o seu perfil" className={styles.tablist}>
        {GUIDES.map(({ id, role, Icon }, index) => (
          <button
            key={id}
            ref={(element) => (tabRefs.current[index] = element)}
            type="button"
            role="tab"
            id={`${baseId}-tab-${id}`}
            aria-selected={index === active}
            aria-controls={`${baseId}-panel`}
            tabIndex={index === active ? 0 : -1}
            className={styles.tab}
            onClick={() => setActive(index)}
            onKeyDown={onKeyDown}
          >
            <Icon aria-hidden="true" />
            {role}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${guide.id}`}
        className={styles.panel}
        tabIndex={0}
      >
        <div className={styles.panelText}>
          <span className={styles.panelIcon} aria-hidden="true">
            <GuideIcon />
          </span>
          <h3>{guide.role}</h3>
          <p className={styles.panelSummary}>{guide.summary}</p>
          <ol className={styles.steps}>
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <figure className={guide.image.phone ? styles.panelPhone : styles.panelShot}>
          <img
            key={guide.id}
            src={guide.image.src}
            width={guide.image.width}
            height={guide.image.height}
            alt={guide.image.alt}
            decoding="async"
          />
        </figure>
      </div>
    </div>
  );
}

/** Central de ajuda pública: busca, status, guias em abas e perguntas filtráveis. */
export function SupportPage() {
  const pageRef = useRef(null);
  useReveal(pageRef);
  const status = useSystemStatus();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todas");
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () =>
      FAQ_CATEGORIES.filter((group) => category === "todas" || group.id === category).flatMap(
        (group) => group.items.filter((item) => matchesQuery(`${item.q} ${item.a}`, deferredQuery)),
      ),
    [category, deferredQuery],
  );
  const searching = deferredQuery.trim().length > 0;

  return (
    <PublicLayout>
      <div ref={pageRef}>
        {/* ============================================================ topo */}
        <section className={styles.hero} aria-labelledby="ajuda-title">
          <div className={styles.heroInner}>
            <p className={styles.eyebrow}>Central de ajuda</p>
            <h1 id="ajuda-title" className={styles.title}>
              Como podemos ajudar?
            </h1>
            <form
              role="search"
              className={styles.search}
              onSubmit={(event) => {
                event.preventDefault();
                document.getElementById("perguntas")?.scrollIntoView();
              }}
            >
              <label htmlFor="busca-ajuda" className="sr-only">
                Buscar nas perguntas frequentes
              </label>
              <Search aria-hidden="true" className={styles.searchIcon} />
              <input
                id="busca-ajuda"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busque por senha, GPS, comprovante, mapa"
                autoComplete="off"
                enterKeyHint="search"
              />
            </form>
            <div className={styles.heroMeta}>
              <p className={styles.status} role="status" data-state={status}>
                <span className={styles.statusDot} aria-hidden="true" />
                {STATUS_TEXT[status]}
              </p>
              <nav aria-label="Atalhos da ajuda" className={styles.quickLinks}>
                <a href="#guias">Guias por perfil</a>
                <a href="#perguntas">Perguntas frequentes</a>
              </nav>
            </div>
          </div>
        </section>

        {/* ===================================================== guias (abas) */}
        <section
          id="guias"
          className={cx(styles.section, styles.anchor)}
          aria-labelledby="guias-title"
        >
          <div className={styles.sectionHead} data-reveal>
            <h2 id="guias-title" className={styles.sectionTitle}>
              Comece em 4 passos, seja qual for o seu papel
            </h2>
          </div>
          <div data-reveal>
            <GuideTabs />
          </div>
        </section>

        {/* ========================================================= perguntas */}
        <section
          id="perguntas"
          className={cx(styles.section, styles.anchor, styles.faq)}
          aria-labelledby="perguntas-title"
        >
          <div className={styles.sectionHead} data-reveal>
            <h2 id="perguntas-title" className={styles.sectionTitle}>
              Perguntas frequentes
            </h2>
          </div>

          <div className={styles.filters} role="group" aria-label="Filtrar por assunto">
            {[{ id: "todas", title: "Todas" }, ...FAQ_CATEGORIES].map((group) => (
              <button
                key={group.id}
                type="button"
                aria-pressed={category === group.id}
                className={styles.filter}
                onClick={() => setCategory(group.id)}
              >
                {group.title}
              </button>
            ))}
          </div>

          <p className={styles.resultCount} aria-live="polite">
            {searching &&
              (results.length === 1
                ? "1 resposta encontrada"
                : `${results.length} respostas encontradas`)}
          </p>

          {results.length > 0 ? (
            <FaqList items={results} />
          ) : (
            <div className={styles.empty}>
              <SearchX aria-hidden="true" />
              <p>
                Nada encontrado para “{deferredQuery.trim()}”. Tente outras palavras
                {CONTACT_URL ? " ou fale com a gente." : "."}
              </p>
              <SupportButton size="md" />
            </div>
          )}
        </section>

        {/* ====================================================== chamada final */}
        <section className={styles.cta} aria-labelledby="ajuda-cta-title" data-reveal>
          <div>
            <h2 id="ajuda-cta-title">Ainda precisa de ajuda?</h2>
            <p>
              {CONTACT_URL
                ? "Conte o que aconteceu e, se puder, mande um print da tela. A gente resolve com você."
                : "Fale com o administrador da sua empresa."}
            </p>
          </div>
          {CONTACT_URL ? (
            <SupportButton />
          ) : (
            <a href="/login" className={styles.ctaLink}>
              Entrar <ArrowRight aria-hidden="true" />
            </a>
          )}
        </section>
      </div>
    </PublicLayout>
  );
}
