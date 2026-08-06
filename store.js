// Camada de dados. Hoje tudo é salvo em localStorage (por navegador/dispositivo).
// Quando a integração com a API da plataforma (inChurch) estiver pronta, é aqui que
// entram as chamadas fetch — o resto do site só fala com o objeto Store, então trocar
// o back-end não exige mexer nas telas.

// A jornada tem 4 "portas de entrada" (a pessoa começa em UMA delas, de acordo com a
// situação dela) e depois um caminho único: todo mundo passa por GC, pela jornada do
// membro (consolidação/batismo) e por capacitação até virar Membro de fato.
const ENTRY_STAGES = ['visitante', 'convertido', 'reconciliado', 'novo_membro'];
const LINEAR_STAGES = ['gc', 'jornada_membro', 'capacitacao', 'membro'];

const STAGES = [
  { id:'visitante',      label:'Visitante',                desc:'Veio conhecer a igreja', icon:'ti-door-enter', accent:'blue' },
  { id:'convertido',     label:'Aceitou a Jesus',           desc:'Novo convertido, primeira vez', icon:'ti-sparkles', accent:'blue' },
  { id:'reconciliado',   label:'Reconciliado',              desc:'Voltou a andar com Jesus', icon:'ti-refresh', accent:'blue' },
  { id:'novo_membro',    label:'Novo membro',               desc:'Veio de outra igreja (transferência)', icon:'ti-suitcase', accent:'blue' },
  { id:'gc',             label:'Grupo de crescimento',      desc:'Em célula, sendo integrado', icon:'ti-users', accent:'blue' },
  { id:'jornada_membro', label:'Jornada do membro',         desc:'Consolidação e/ou escola de batismo', icon:'ti-compass', accent:'ember' },
  { id:'capacitacao',    label:'Capacitação e voluntariado', desc:'Treinamento e primeiros passos servindo', icon:'ti-school', accent:'ember' },
  { id:'membro',         label:'Membro',                    desc:'Jornada concluída', icon:'ti-award', accent:'green' },
];

function nextStageId(stageId){
  if(ENTRY_STAGES.includes(stageId)) return 'gc';
  const i = LINEAR_STAGES.indexOf(stageId);
  if(i === -1 || i === LINEAR_STAGES.length-1) return null;
  return LINEAR_STAGES[i+1];
}
function prevStageId(stageId, person){
  if(stageId === 'gc'){
    const origem = person && person.origem;
    return ENTRY_STAGES.includes(origem) ? origem : null;
  }
  const i = LINEAR_STAGES.indexOf(stageId);
  if(i <= 0) return null;
  return LINEAR_STAGES[i-1];
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
    const list = this.getPeople();
    const stage = data.stage || 'visitante';
    const p = {
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
      notas: data.notas || '',
      foto: data.foto || null,
      stage,
      origem: stage,
      createdAt: new Date().toISOString(),
      history: [{ stage, date: new Date().toISOString() }],
    };
    list.push(p);
    this._savePeople(list);
    if(stage !== 'visitante'){ this.syncPreCadastro(p); }
    return p;
  },
  updatePerson(id, data){
    const list = this.getPeople();
    const p = list.find(x=>x.id===id);
    if(!p) return null;
    Object.assign(p, data);
    this._savePeople(list);
    return p;
  },
  movePerson(id, newStageId){
    const list = this.getPeople();
    const p = list.find(x=>x.id===id);
    if(!p) return null;
    p.stage = newStageId;
    p.history = p.history || [];
    p.history.push({ stage:newStageId, date:new Date().toISOString() });
    this._savePeople(list);
    if(newStageId === 'membro'){ Store.syncMembroFinal(p); }
    return p;
  },
  deletePerson(id){
    const list = this.getPeople().filter(p=>p.id!==id);
    this._savePeople(list);
  },
  peopleInStage(stageId, congregacao){
    return this.getPeople().filter(p =>
      p.stage === stageId && (!congregacao || congregacao==='todas' || p.congregacao===congregacao)
    );
  },
  congregacoes(){
    return Array.from(new Set(this.getPeople().map(p=>p.congregacao).filter(Boolean))).sort();
  },

  getResponsaveis(){
    return JSON.parse(localStorage.getItem(this._keyResp) || '{}');
  },
  setResponsavel(stageId, nome){
    const r = this.getResponsaveis();
    r[stageId] = nome;
    localStorage.setItem(this._keyResp, JSON.stringify(r));
  },

  // Lista de departamentos é editável — os nomes abaixo são um ponto de partida
  // (confira as siglas certinho com a igreja antes de usar; vieram só de exemplo).
  getDepartamentos(){
    const saved = JSON.parse(localStorage.getItem(this._keyDeptos) || 'null');
    return saved || ['MAAD', 'UMADERJ', 'ADV', 'HCP'];
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

  // Pré-cadastro no inChurch — dispara assim que a pessoa entra como convertido,
  // reconciliado ou novo membro (visitante não precisa de conta no app).
  // Troque o corpo pela chamada real quando a integração estiver pronta.
  async syncPreCadastro(person){
    const cfg = this.getApiConfig();
    if(!cfg.baseUrl){ this.updatePerson(person.id, { pendingSync:true }); return; }
    try{
      // const res = await fetch(`${cfg.baseUrl}/pre-cadastro`, {
      //   method:'POST',
      //   headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${cfg.token}` },
      //   body: JSON.stringify({ nome:person.nome, telefone:person.telefone, email:person.email }),
      // });
      // if(!res.ok) throw new Error('Falha ao pré-cadastrar');
      this.updatePerson(person.id, { pendingSync:false });
    }catch(err){ this.updatePerson(person.id, { pendingSync:true }); }
  },
  // Confirmação final — dispara quando a pessoa conclui a jornada e chega em "Membro".
  async syncMembroFinal(person){
    const cfg = this.getApiConfig();
    if(!cfg.baseUrl){ this.updatePerson(person.id, { pendingSyncMembro:true }); return; }
    try{
      // const res = await fetch(`${cfg.baseUrl}/membros/${person.id}/confirmar`, {
      //   method:'POST',
      //   headers:{ 'Authorization':`Bearer ${cfg.token}` },
      // });
      // if(!res.ok) throw new Error('Falha ao confirmar membro');
      this.updatePerson(person.id, { pendingSyncMembro:false });
    }catch(err){ this.updatePerson(person.id, { pendingSyncMembro:true }); }
  },
};

function initials(name){
  return (name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
}
function avatarHtml(p, size){
  if(p.foto){ return `<img class="avatar" src="${p.foto}" style="width:${size}px;height:${size}px">`; }
  return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.36)}px">${initials(p.nome)}</div>`;
}
function daysSince(dateStr){
  const d = Math.floor((Date.now() - new Date(dateStr).getTime())/86400000);
  return d <= 0 ? 'hoje' : (d===1 ? 'há 1 dia' : `há ${d} dias`);
}
function lastHistoryDate(p){
  if(p.history && p.history.length) return p.history[p.history.length-1].date;
  return p.createdAt;
}
