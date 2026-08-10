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
  { id:'escola_batismo',  label:'Escola de batismo', desc:'Preparação doutrinária', icon:'ti-book', accent:'ember' },
  { id:'capacitacao',     label:'Capacitação',       desc:'Treinamento para servir', icon:'ti-school', accent:'ember' },
  { id:'voluntariado',    label:'Voluntariado',      desc:'Primeiros passos servindo', icon:'ti-hand-stop', accent:'ember' },
];
const SUB_ORDER = ['consolidacao', 'escola_batismo', 'capacitacao', 'voluntariado'];

function nextStageId(stageId){
  if(ENTRY_STAGES.includes(stageId)) return 'gc';
  var i = LINEAR_STAGES.indexOf(stageId);
  if(i === -1 || i === LINEAR_STAGES.length-1) return null;
  return LINEAR_STAGES[i+1];
}
function prevStageId(stageId, person){
  if(stageId === 'gc'){
    var origem = person && person.origem;
    return ENTRY_STAGES.includes(origem) ? origem : null;
  }
  var i = LINEAR_STAGES.indexOf(stageId);
  if(i === 0 || i === -1) return null;
  return LINEAR_STAGES[i-1];
}
function nextSubStageId(subStageId){
  var i = SUB_ORDER.indexOf(subStageId);
  if(i === -1 || i === SUB_ORDER.length-1) return null;
  return SUB_ORDER[i+1];
}
function prevSubStageId(subStageId){
  var i = SUB_ORDER.indexOf(subStageId);
  if(i === 0 || i === -1) return null;
  return SUB_ORDER[i-1];
}

const Store = {
  _key: 'jornada_pessoas',
  _keyResp: 'jornada_responsaveis',
  _keyApi: 'jornada_api_config',
  _keyDeptos: 'jornada_departamentos',
  getPeople(){
    return JSON.parse(localStorage.getItem(this._key) || '[]');
  },
  _savePeople(list){
    localStorage.setItem(this._key, JSON.stringify(list));
  },
  addPerson(data){
    var list = this.getPeople();
    var stage = data.stage || 'visitante';
    var p = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      nome: data.nome || '',
      telefone: data.telefone || '',
      email: data.email || '',
      bairro: data.bairro || '',
      idade: data.idade || '',
      estadoCivil: data.estadoCivil || '',
      igrejaAnterior: data.igrejaAnterior || '',
      temCarta: data.temCarta || '',
      funcaoMinisterial: data.funcaoMinisterial || '',
      quisGC: data.quisGC || '',
      pedidoOracao: data.pedidoOracao || '',
      congregacao: data.congregacao || '',
      quemColeta: data.quemColeta || '',
      departamento: data.departamento || '',
      agenteIntegrante: data.agenteIntegrante || '',
      subStage: data.subStage || '',
      notas: data.notas || '',
      foto: data.foto || null,
      stage: stage,
      origem: stage,
      createdAt: new Date().toISOString(),
      history: [{ stage: stage, date: new Date().toISOString() }],
      subHistory: [],
    };
    list.push(p);
    this._savePeople(list);
    if(stage !== 'visitante'){ this.syncPreCadastro(p); }
    return p;
  },
  updatePerson(id, data){
    var list = this.getPeople();
    var p = list.find(function(x){ return x.id === id; });
    if(!p) return null;
    Object.assign(p, data);
    this._savePeople(list);
    return p;
  },
  movePerson(id, newStageId){
    var list = this.getPeople();
    var p = list.find(function(x){ return x.id === id; });
    if(!p) return null;
    p.stage = newStageId;
    p.history = p.history || [];
    p.history.push({ stage: newStageId, date: new Date().toISOString() });
    this._savePeople(list);
    if(newStageId === 'membro'){ Store.syncMembroFinal(p); }
    return p;
  },
  moveSubStage(id, newSubStageId){
    var list = this.getPeople();
    var p = list.find(function(x){ return x.id === id; });
    if(!p) return null;
    p.subStage = newSubStageId;
    p.subHistory = p.subHistory || [];
    p.subHistory.push({ subStage: newSubStageId, date: new Date().toISOString() });
    this._savePeople(list);
    return p;
  },
  deletePerson(id){
    var list = this.getPeople().filter(function(p){ return p.id !== id; });
    this._savePeople(list);
  },
  peopleInStage(stageId, congregacao){
    return this.getPeople().filter(function(p){
      return p.stage === stageId && (!congregacao || congregacao === 'todas' || p.congregacao === congregacao);
    });
  },
  peopleInSubStage(subStageId){
    return this.getPeople().filter(function(p){
      return p.stage === 'jornada_membro' && p.subStage === subStageId;
    });
  },
  congregacoes(){
    return Array.from(new Set(this.getPeople().map(function(p){ return p.congregacao; }).filter(Boolean))).sort();
  },
  getResponsaveis(){
    return JSON.parse(localStorage.getItem(this._keyResp) || '{}');
  },
  setResponsavel(stageId, nome){
    var r = this.getResponsaveis();
    r[stageId] = nome;
    localStorage.setItem(this._keyResp, JSON.stringify(r));
  },
  getDepartamentos(){
    var saved = JSON.parse(localStorage.getItem(this._keyDeptos) || 'null');
    return saved || ['UCADERV', 'MAAD', 'UMADERV', 'USADERV', 'HCP'];
  },
  setDepartamentos(list){
    localStorage.setItem(this._keyDeptos, JSON.stringify(list));
  },
  getApiConfig(){
    return JSON.parse(localStorage.getItem(this._keyApi) || '{}');
  },
  setApiConfig(cfg){
    localStorage.setItem(this._keyApi, JSON.stringify(cfg));
  },
  async syncPreCadastro(person){
    var cfg = this.getApiConfig();
    if(!cfg.baseUrl){ this.updatePerson(person.id, { pendingSync:true }); return; }
    try{
      this.updatePerson(person.id, { pendingSync:false });
    }catch(err){ this.updatePerson(person.id, { pendingSync:true }); }
  },
  async syncMembroFinal(person){
    var cfg = this.getApiConfig();
    if(!cfg.baseUrl){ this.updatePerson(person.id, { pendingSyncMembro:true }); return; }
    try{
      this.updatePerson(person.id, { pendingSyncMembro:false });
    }catch(err){ this.updatePerson(person.id, { pendingSyncMembro:true }); }
  },
};
function initials(name){
  return (name||'?').trim().split(/\s+/).slice(0,2).map(function(w){ return w[0]; }).join('').toUpperCase();
}
function avatarHtml(p, size){
  if(p.foto){ return '<img class="avatar" src="'+p.foto+'" style="width:'+size+'px;height:'+size+'px">'; }
  return '<div class="avatar" style="width:'+size+'px;height:'+size+'px;font-size:'+Math.round(size*0.36)+'px">'+initials(p.nome)+'</div>';
}
function daysSince(dateStr){
  var d = Math.floor((Date.now() - new Date(dateStr).getTime())/86400000);
  if(d === 0 || d === -1) return 'hoje';
  if(d === 1) return 'há 1 dia';
  return 'há '+d+' dias';
}
function lastHistoryDate(p){
  if(p.history && p.history.length) return p.history[p.history.length-1].date;
  return p.createdAt;
}
