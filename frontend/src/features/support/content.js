import { Bike, Headset, ShieldCheck } from "lucide-react";

import configuracoesImg from "@/features/landing/assets/configuracoes.webp";
import entregadorImg from "@/features/landing/assets/entregador.webp";
import operacaoImg from "@/features/landing/assets/operacao.webp";

// Conteúdo da Central de ajuda. Os nomes de botões e telas são os mesmos do
// sistema — se mudar um rótulo lá, atualize aqui.

export const GUIDES = [
  {
    id: "administrador",
    Icon: ShieldCheck,
    role: "Administrador",
    summary: "Monta a equipe e define as regras da empresa.",
    image: {
      src: configuracoesImg,
      width: 1440,
      height: 900,
      alt: "Tela de Configurações com as opções do comprovante de entrega",
    },
    steps: [
      "Entre com seu e-mail e senha em “Entrar”.",
      "Em Usuários, cadastre os operadores (e-mail) e os entregadores (celular).",
      "Em Configurações, defina o que o comprovante exige: nome de quem recebeu, foto e/ou assinatura.",
      "Acompanhe o dia no Painel e consulte a Auditoria quando precisar saber quem fez o quê.",
    ],
  },
  {
    id: "operador",
    Icon: Headset,
    role: "Operador",
    summary: "Cria as entregas e acompanha a operação.",
    image: {
      src: operacaoImg,
      width: 1440,
      height: 900,
      alt: "Quadro da operação com as entregas organizadas por status",
    },
    steps: [
      "Em Operação, toque em “Nova entrega”.",
      "Busque o cliente ou cadastre um novo. O CEP preenche o endereço sozinho.",
      "Informe valor, forma de pagamento e troco, e escolha o entregador.",
      "Acompanhe pelo quadro e pelo Mapa. Ocorrências aparecem em destaque.",
    ],
  },
  {
    id: "entregador",
    Icon: Bike,
    role: "Entregador",
    summary: "Recebe, entrega e registra o comprovante pelo celular.",
    image: {
      src: entregadorImg,
      width: 780,
      height: 1688,
      alt: "Tela do entregador com endereço, valor a cobrar e botão de finalizar",
      phone: true,
    },
    steps: [
      "Abra o endereço do sistema no navegador do celular e entre com seu celular e senha.",
      "Permita a localização quando o navegador pedir. Ela só é usada durante a entrega.",
      "Abra a entrega, toque em “Iniciar entrega” e use o Google Maps ou o Waze.",
      "No cliente, toque em “Finalizar entrega” e registre o comprovante. Se algo der errado, use “Registrar ocorrência”.",
    ],
  },
];

export const FAQ_CATEGORIES = [
  {
    id: "primeiros-passos",
    title: "Primeiros passos",
    items: [
      {
        q: "Como começo a usar o DESPACHA?",
        a: "Agende uma demonstração pelo WhatsApp. Criamos o acesso da sua empresa e do administrador; depois, o administrador cadastra a equipe em Usuários.",
      },
      {
        q: "Quanto tempo leva para começar?",
        a: "Cadastrar a equipe leva poucos minutos: dá para começar a despachar no mesmo dia.",
      },
      {
        q: "Preciso de computador?",
        a: "O painel do operador fica melhor no computador ou tablet, mas tudo também funciona no celular. O entregador usa só o celular.",
      },
    ],
  },
  {
    id: "entregadores",
    title: "Entregadores e celular",
    items: [
      {
        q: "O entregador precisa instalar um aplicativo?",
        a: "Não. Ele usa o navegador. Para abrir mais rápido, crie um atalho: no Chrome (Android), menu ⋮ → “Adicionar à tela inicial”; no iPhone (Safari), botão Compartilhar → “Adicionar à Tela de Início”.",
      },
      {
        q: "Apareceu “GPS bloqueado”. O que fazer?",
        a: "A localização foi negada para o site. Toque no cadeado ao lado do endereço, em Permissões, libere a Localização e recarregue a página.",
      },
      {
        q: "O entregador perdeu o celular. E agora?",
        a: "O administrador pode encerrar as sessões dele na tela Usuários. A própria pessoa também pode usar “Sair de todos os dispositivos” no menu da conta, em outro aparelho.",
      },
    ],
  },
  {
    id: "mapa",
    title: "Mapa e localização",
    items: [
      {
        q: "Por que o entregador não aparece no mapa?",
        a: "Ele só aparece quando tem uma entrega em rota e a localização está permitida no celular. A posição é atualizada a cada 15 segundos; sem sinal recente, o mapa avisa.",
      },
      {
        q: "A localização fica guardada?",
        a: "Só a coletada durante entregas em rota, para acompanhar a operação. Ela é apagada automaticamente depois de 30 dias.",
      },
    ],
  },
  {
    id: "comprovantes",
    title: "Comprovantes e ocorrências",
    items: [
      {
        q: "Como exigir foto ou assinatura na entrega?",
        a: "O administrador define em Configurações, no comprovante de entrega: nome de quem recebeu, foto e/ou assinatura.",
      },
      {
        q: "Onde vejo o comprovante de uma entrega?",
        a: "No detalhe da entrega, pelo Histórico. Fotos e assinaturas só abrem para usuários da sua empresa.",
      },
      {
        q: "O que é uma ocorrência?",
        a: "É quando algo impede a entrega: cliente ausente, endereço errado, recusa ou produto avariado. O entregador registra pelo celular e ela aparece em destaque para o operador decidir o próximo passo.",
      },
    ],
  },
  {
    id: "conta",
    title: "Conta e segurança",
    items: [
      {
        q: "Esqueci minha senha.",
        a: "Peça ao administrador da sua empresa para redefinir a senha na tela Usuários.",
      },
      {
        q: "Como troco minha senha?",
        a: "Abra o menu da conta (suas iniciais, no canto superior direito) e escolha “Alterar senha”.",
      },
      {
        q: "Aparece “muitas tentativas” ao entrar.",
        a: "Por segurança, o acesso é bloqueado por alguns minutos depois de várias senhas erradas. Aguarde e tente de novo, ou peça ao administrador para redefinir a senha.",
      },
    ],
  },
  {
    id: "planos",
    title: "Planos e dados",
    items: [
      {
        q: "Quanto custa?",
        a: "O plano é montado conforme o tamanho da sua operação. Fale com a gente pelo WhatsApp para uma demonstração e uma proposta.",
      },
      {
        q: "Consigo tirar meus dados do sistema?",
        a: "Sim. O histórico e os relatórios podem ser exportados para planilha (CSV) a qualquer momento.",
      },
    ],
  },
];
