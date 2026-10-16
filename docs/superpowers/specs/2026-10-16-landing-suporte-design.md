# Landing, Central de ajuda e Privacidade — desenho

Data: 2026-10-16 · Branch: `feat/landing-page` · Status: aprovado

## Objetivo

Apresentar o DESPACHA a donos de pequenos negócios (restaurantes, farmácias,
mercados, lojas com entregadores próprios). O texto precisa ser curto, os
prints são reais e o caminho até "Agendar demonstração" (WhatsApp) deve ser
claro. A página também serve de autoatendimento para quem já é cliente.

**Leitura de design:** landing de SaaS para público não técnico. Linguagem
prática e confiável. Usa os tokens existentes: Manrope, azul de marca e
laranja de ação. Variação 6, movimento 5, densidade 4.

## Rotas

| Rota | Conteúdo | Carregamento |
|---|---|---|
| `/` | Apresentação para visitantes. Quem tem sessão vai para a sua área. | No pacote inicial |
| `/suporte` | Central de ajuda | Sob demanda |
| `/privacidade` | Resumo LGPD | Sob demanda |

As três usam um `PublicLayout` compartilhado:

- **Topo:** logo, navegação em uma linha (Funcionalidades, Como funciona,
  Para quem é, Suporte), "Entrar" e "Agendar demonstração".
- **Celular:** um menu em `<dialog>` nativo substitui a navegação.
- **Rodapé:** colunas Produto, Suporte e Legal, mais o seletor de tema.

## Landing: uma família de layout por seção

1. **Hero dividido.** Rótulo curto, título "Saiba onde está cada entrega."
   (máximo de 2 linhas), subtítulo de até 20 palavras e 2 botões. O visual é o
   print real da operação, com o celular sobreposto e 2 cartões flutuantes
   decorativos (`aria-hidden`).
2. **Faixa de segmentos:** pílulas com os ramos atendidos.
3. **Antes/depois:** foto e a comparação "Sem / Com o DESPACHA".
4. **Como funciona:** linha do tempo horizontal com 4 verbos (Cadastrar,
   Distribuir, Acompanhar, Finalizar), sem cards nem numeração genérica.
5. **Funcionalidades em bento:** 3 blocos com print e 6 menores, alguns com
   fundo colorido. A contagem de células é exata.
6. **Números verdadeiros:** 0 apps, 15 s de atualização, 4 passos, 30 dias de
   retenção.
7. **Para quem é:** grade assimétrica, com o restaurante grande e a farmácia
   e o mercado menores.
8. **Segurança:** painel colorido com 4 garantias e link para `/privacidade`.
9. **Suporte e perguntas:** coluna fixa com foto e "Falar com o suporte", ao
   lado do acordeão de perguntas.
10. **Chamada final:** foto do entregador ao fundo, com véu escuro.

### Regras de texto

- Nenhum travessão. No máximo 1 rótulo pequeno de seção a cada 3 seções.
- Um nome por intenção em todo o site: "Agendar demonstração" (vendas),
  "Entrar" (login) e "Falar com o suporte" (ajuda).
- Só afirmar o que o sistema faz. Nada de depoimentos, logos de clientes ou
  números inventados.

## Central de ajuda

- **Hero:** busca que ignora acentos e maiúsculas, status do sistema ao vivo
  (`/api/v1/health`, mesma origem) e atalhos.
- **Guias em abas por perfil** (Administrador, Operador, Entregador): o padrão
  ARIA de abas, navegável por setas. Cada aba mostra 4 passos com os nomes
  reais de telas e botões, mais o print daquele perfil.
- **Perguntas:** filtro por categoria em pílulas, mais a busca. Quando nada é
  encontrado, a página oferece "Falar com o suporte".
- **Chamada final** para o suporte.

## Privacidade

Resumo em linguagem simples, com índice lateral fixo no desktop. Seções:

- Quem é quem: a empresa cliente é a controladora e o DESPACHA é o operador.
- Dados tratados.
- Para que são usados.
- Por quanto tempo: localização por 30 dias e backups por 14.
- Segurança.
- Cookies: apenas o de sessão e preferências locais, sem rastreamento.
- Direitos e contato.

A página se declara um resumo, que não substitui o contrato. Recomenda-se
revisão jurídica antes de usar com clientes.

## Fotos

Unsplash, licença gratuita. Fotos com marcas de terceiros foram descartadas.
Os créditos estão em `frontend/src/features/landing/assets/fotos/CREDITOS.md`.
As imagens são WebP com dimensões declaradas (sem salto de layout) e as que
ficam abaixo da dobra carregam sob demanda.

## Técnica e qualidade

- **Dependências:** nenhuma nova. CSS Modules e tokens. Ícones `lucide-react`,
  que o projeto já usa.
- **Movimento:**
  - entrada ao rolar com IntersectionObserver (`useReveal`);
  - leve inclinação e flutuação no hero;
  - tudo desligado com `prefers-reduced-motion`.
- **Contato:** o WhatsApp vem de `VITE_CONTACT_WHATSAPP` no build
  (`CONTACT_WHATSAPP` no `.env` do servidor), nunca do repositório. Sem número,
  os botões de contato somem.
- **Testes:** Vitest para `whatsappUrl`, `matchesQuery` e
  `installStaleChunkReload`. Validação com Playwright em 320/390/1440 px, nos
  temas claro e escuro. Critérios: sem rolagem horizontal, sem erros no
  console e um único `h1` por página.
