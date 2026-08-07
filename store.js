// Camada de dados. Hoje tudo é salvo em localStorage (por navegador/dispositivo).
// Quando a integração com a API da plataforma (inChurch) estiver pronta, é aqui que
// entram as chamadas fetch — o resto do site só fala com o objeto Store, então trocar
// o back-end não exige mexer nas telas.
const ENTRY_STAGES = ['visitante', 'convertido', 'reconciliado', 'novo_membro'];
const LINEAR_STAGES = ['gc', 'jornada_membro', 'membro'];
const STAGES = [
  { id:'visitante',      label:'Visitante',           desc:'Veio conhecer a igreja', icon:'ti-door-enter', accent:'blue' },
  { id:'convertido',     label:'Aceitou a Jesus',      desc:'Novo convertido, primeira vez', icon:'ti-sparkles', accent:'blue' },
  { id:'reconciliado',   label:'Reconciliado',         desc:'Voltou a andar com Jesus', icon:'ti-refresh', accent:'blue' },
  { id:'novo_membro',    label:'Novo membro',          desc:'Veio de outra igreja (transferência)', icon:'ti-suitcase', accent:'blue' },
  { id:'gc',             label:'Grupo de crescimento', desc:'Em célula, sendo integrado', icon:'ti-users', accent:'blue' },
  { id:'jornada_membro', label:'Jornada do membro',    desc:'Consolidação e/ou escola de batismo', icon:'ti-compass', accent:'ember' },
  { id:'membro',         label:'Membro',               desc:'Jornada concluída', icon:'ti-award', accent:'green' },
];

// Sub-funil dentro de "Jornada do Membro"
// Consolidação OU Escola de batismo (condicional) → Capacitação → Voluntariado → Membro
const SUB_STAGES = [
  { id:'consolidacao',    label:'Consolidação',      desc:'Acompanhamento e discipulado', icon:'ti-heart-handshake', accent:'ember' },
  { 
