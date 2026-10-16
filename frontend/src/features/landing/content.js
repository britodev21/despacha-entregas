import {
  Camera,
  CircleCheck,
  ClipboardList,
  Contact,
  FileCheck2,
  FileSpreadsheet,
  LockKeyhole,
  MapPinned,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  UsersRound,
  Wallet,
} from "lucide-react";

import farmaciaImg from "./assets/fotos/farmacia.webp";
import mercadoImg from "./assets/fotos/mercado.webp";
import restauranteImg from "./assets/fotos/restaurante.webp";

// Textos da apresentação. Regras (ver docs/superpowers/specs):
// - só afirmar o que o sistema faz de verdade (nada de depoimentos ou
//   números de clientes inventados);
// - sem travessões; um nome por intenção ("Agendar demonstração", "Entrar",
//   "Falar com o suporte").

export const SEGMENTS = [
  "Restaurantes",
  "Lanchonetes",
  "Pizzarias",
  "Farmácias",
  "Mercados",
  "Hortifrútis",
  "Pet shops",
  "Floriculturas",
  "Água e gás",
  "Lojas locais",
];

export const PAINS = [
  "Pedidos no papel ou perdidos no grupo do WhatsApp",
  "Ligações a toda hora para saber onde está o entregador",
  "Cliente diz que não recebeu e não há como provar",
  "Troco errado e cobrança esquecida na porta",
];

export const GAINS = [
  "Todas as entregas numa tela, organizadas por status",
  "Mapa ao vivo de quem está em rota",
  "Comprovante com foto, assinatura e horário",
  "Valor a cobrar e troco claros para o entregador",
];

export const STEPS = [
  {
    Icon: ClipboardList,
    title: "Cadastrar",
    text: "Cliente e endereço em segundos. O CEP preenche a rua sozinho.",
  },
  {
    Icon: UserCheck,
    title: "Distribuir",
    text: "Escolha o entregador com um toque. Ele vê a entrega na hora.",
  },
  {
    Icon: MapPinned,
    title: "Acompanhar",
    text: "Mapa ao vivo e status em tempo real. Problemas aparecem primeiro.",
  },
  {
    Icon: Camera,
    title: "Finalizar",
    text: "Quem recebeu, foto e assinatura viram o comprovante.",
  },
];

export const SMALL_FEATURES = [
  {
    Icon: CircleCheck,
    title: "Comprovante digital",
    text: "Nome de quem recebeu, foto e assinatura na tela. Você escolhe o que é obrigatório.",
    tone: "success",
  },
  {
    Icon: TriangleAlert,
    title: "Ocorrências em destaque",
    text: "Cliente ausente ou endereço errado: o operador vê na hora e decide o que fazer.",
  },
  {
    Icon: Contact,
    title: "Clientes e endereços",
    text: "Cadastro com CEP automático e endereços salvos para o próximo pedido.",
  },
  {
    Icon: Wallet,
    title: "Cobrança e troco",
    text: "O entregador sabe quanto cobrar, como receber e quanto levar de troco.",
    tone: "accent",
  },
  {
    Icon: FileSpreadsheet,
    title: "Histórico e relatórios",
    text: "Filtros por período e entregador, com exportação para planilha.",
  },
  {
    Icon: ScrollText,
    title: "Auditoria",
    text: "Quem fez o quê e quando, para resolver qualquer dúvida da operação.",
  },
];

export const AUDIENCE = [
  {
    title: "Restaurantes e lanchonetes",
    text: "O pedido sai da cozinha direto para o entregador certo, sem confusão no balcão.",
    image: restauranteImg,
    width: 900,
    height: 675,
    alt: "Cozinheiro preparando pedidos numa cozinha profissional",
  },
  {
    title: "Farmácias",
    text: "Registro de quem recebeu, com data e hora.",
    image: farmaciaImg,
    width: 900,
    height: 640,
    alt: "Farmacêutica pegando um medicamento na prateleira",
  },
  {
    title: "Mercados e hortifrútis",
    text: "Cobrança na porta e troco já calculado.",
    image: mercadoImg,
    width: 900,
    height: 558,
    alt: "Compras de mercado com maçãs, repolho e bananas",
  },
];

export const STATS = [
  { value: "0", label: "aplicativos para instalar" },
  { value: "15 s", label: "para o mapa se atualizar" },
  { value: "4", label: "passos do pedido à entrega" },
  { value: "30 dias", label: "e a localização é apagada" },
];

export const TRUST = [
  { Icon: UsersRound, title: "Dados separados", text: "Cada empresa vê só os próprios dados." },
  {
    Icon: LockKeyhole,
    title: "Acesso por perfil",
    text: "Administrador, operador e entregador veem só o que precisam.",
  },
  {
    Icon: FileCheck2,
    title: "Conexão segura e backup",
    text: "HTTPS em todas as telas e backups cifrados todos os dias.",
  },
  {
    Icon: ShieldCheck,
    title: "LGPD",
    text: "Localização só durante a entrega, apagada em 30 dias.",
  },
];

export const HOME_FAQ = [
  {
    q: "Preciso instalar algum aplicativo?",
    a: "Não. O DESPACHA funciona no navegador do computador e do celular. O entregador recebe um acesso, entra pelo navegador e pode criar um atalho na tela inicial.",
  },
  {
    q: "Funciona em qualquer celular?",
    a: "Em qualquer smartphone recente com navegador atualizado (Chrome, Safari, Edge). Para aparecer no mapa ao vivo, o entregador só precisa permitir a localização.",
  },
  {
    q: "A localização do entregador fica ligada o tempo todo?",
    a: "Não. Ela é compartilhada só enquanto há uma entrega em rota. Fora disso, nada é coletado, e as posições antigas são apagadas automaticamente depois de 30 dias.",
  },
  {
    q: "Como provo que a entrega foi feita?",
    a: "Ao finalizar, o entregador registra quem recebeu e, se a sua empresa exigir, tira uma foto e colhe a assinatura na tela. Tudo fica no histórico com data e hora.",
  },
  {
    q: "Quanto custa?",
    a: "O plano é montado conforme o tamanho da sua operação. Agende uma demonstração: mostramos o sistema funcionando e enviamos uma proposta.",
  },
];
