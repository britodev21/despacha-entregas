import { SupportButton } from "@/features/landing/DemoButton";
import { PublicLayout } from "@/layouts/PublicLayout";

import styles from "./privacy.module.css";

// Resumo em linguagem simples do tratamento de dados (LGPD). Descreve o que o
// sistema faz de fato (ver docs/SEGURANCA.md). Não substitui o contrato e deve
// passar por revisão jurídica antes do uso com clientes.

const SECTIONS = [
  {
    id: "papeis",
    title: "Quem é quem",
    body: [
      "A empresa que contrata o DESPACHA decide quais dados cadastra e para quê: pela LGPD, ela é a controladora dos dados dos próprios clientes e da equipe.",
      "O DESPACHA guarda e processa esses dados para fazer o sistema funcionar, seguindo as instruções da empresa: atua como operador.",
    ],
  },
  {
    id: "dados",
    title: "Quais dados tratamos",
    list: [
      "Equipe: nome, e-mail ou celular e perfil de acesso. A senha é guardada de forma irreversível (hash Argon2): ninguém consegue lê-la, nem nós.",
      "Clientes da empresa: nome, telefone e endereços de entrega cadastrados pelo operador.",
      "Entregas: valores, forma de pagamento, observações e o histórico de cada etapa.",
      "Comprovantes: nome de quem recebeu, foto e assinatura (quando a empresa exige) e o local no momento da finalização.",
      "Localização do entregador: só enquanto ele tem uma entrega em rota.",
      "Registros de segurança: data, hora e endereço IP de acessos e ações importantes (auditoria).",
    ],
  },
  {
    id: "finalidade",
    title: "Para que usamos",
    list: [
      "Organizar, acompanhar e comprovar as entregas da empresa.",
      "Proteger as contas e investigar usos indevidos.",
      "Prestar suporte quando a empresa pede ajuda.",
    ],
    note: "Não vendemos dados, não exibimos anúncios e não usamos os dados para outros fins.",
  },
  {
    id: "retencao",
    title: "Por quanto tempo",
    list: [
      "Localização dos entregadores: apagada automaticamente depois de 30 dias.",
      "Sessões vencidas ou encerradas: removidas automaticamente.",
      "Cópias de segurança (backup): guardadas por 14 dias, cifradas.",
      "Demais dados: enquanto a empresa usar o DESPACHA, ou até ela pedir a exclusão.",
    ],
  },
  {
    id: "seguranca",
    title: "Como protegemos",
    list: [
      "Conexão cifrada (HTTPS) em todas as telas.",
      "Cada empresa só enxerga os próprios dados.",
      "Acesso por perfil: administrador, operador e entregador veem só o que precisam.",
      "Fotos e assinaturas só abrem para usuários autorizados da empresa.",
      "Backups diários cifrados e testados.",
    ],
  },
  {
    id: "cookies",
    title: "Cookies e armazenamento no navegador",
    body: [
      "Usamos apenas um cookie essencial, que mantém você conectado com segurança. No próprio navegador guardamos só a preferência de tema (claro ou escuro) e se você já entrou antes.",
      "Não usamos cookies de publicidade nem ferramentas de rastreamento.",
    ],
  },
  {
    id: "direitos",
    title: "Seus direitos",
    body: [
      "Você pode pedir acesso, correção ou exclusão dos seus dados. Se você é cliente de uma empresa que usa o DESPACHA, fale primeiro com essa empresa, que é a controladora. Se você é usuário do sistema ou quer falar com o DESPACHA, use o suporte.",
    ],
  },
];

/** Resumo público de privacidade e LGPD. */
export function PrivacyPage() {
  return (
    <PublicLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Privacidade e LGPD</p>
          <h1 className={styles.title}>Como o DESPACHA trata dados pessoais</h1>
          <p className={styles.lead}>
            Um resumo em linguagem simples. Ele não substitui o contrato de prestação de serviço.
          </p>
          <p className={styles.updated}>Atualizado em outubro de 2026</p>
        </header>

        <div className={styles.layout}>
          <nav className={styles.toc} aria-label="Nesta página">
            <p>Nesta página</p>
            <ol>
              {SECTIONS.map(({ id, title }) => (
                <li key={id}>
                  <a href={`#${id}`}>{title}</a>
                </li>
              ))}
            </ol>
          </nav>

          <article className={styles.article}>
            {SECTIONS.map(({ id, title, body, list, note }) => (
              <section key={id} id={id} className={styles.block} aria-labelledby={`${id}-title`}>
                <h2 id={`${id}-title`}>{title}</h2>
                {body?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {list && (
                  <ul>
                    {list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {note && <p className={styles.note}>{note}</p>}
              </section>
            ))}
            <div className={styles.contact}>
              <p>Dúvidas sobre privacidade?</p>
              <SupportButton size="md" />
            </div>
          </article>
        </div>
      </div>
    </PublicLayout>
  );
}
