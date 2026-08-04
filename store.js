// Camada de dados. Hoje tudo é salvo em localStorage (por navegador/dispositivo).
// Quando a integração com a API da plataforma estiver pronta, é aqui que entram
// as chamadas fetch — o resto do site (painel.html e cadastro.html) só fala
// com o objeto Store, então trocar o back-end não exige mexer nas telas.

const STAGES = [
  { id:'cadastro',      label:'Novo cadastro',        desc:'Chegou à igreja e foi registrado', icon:'ti-user-plus',  accent:'blue'  },
  { id:'consolidacao',  label:'Consolidação',         desc:'Conhecendo a igreja e desenvolvendo habilidades', icon:'ti-compass', accent:'blue' },
  { id:'gc',            label:'Grupo de crescimento', desc:'Em célula e discipulado', icon:'ti-users', accent:'blue' },
  { id:'batismo',       label:'Batismo',               desc:'Pronta para o batismo', icon:'ti-droplet', accent:'ember' },
  { id:'membro',        label:'Membro',                 desc:'Jornada concluída', icon:'ti-award', accent:'green' },
];

const Store = {
  _key: 'jornada_pessoas',
  _keyResp: 'jornada_responsaveis',
  _keyApi: 'jornada_api_config',

  getPeople(){
    return JSON.parse(localStorage.getItem(this._key) || '[]');
  },
  _savePeople(list){
    localStorage.setItem(this._key, JSON.stringify(list));
  },
  addPerson(data){
    const list = this.getPeople();
    const p = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      nome: data.nome || '',
      telefone: data.telefone || '',
      situacao: data.situacao || 'Novo convertido',
      congregacao: data.congregacao || '',
      responsavel: data.responsavel || '',
      notas: data.notas || '',
      foto: data.foto || null,
      stage: data.stage || 'cadastro',
      createdAt: new Date().toISOString(),
      history: [{ stage: data.stage || 'cadastro', date: new Date().toISOString() }],
    };
    list.push(p);
    this._savePeople(list);
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
    if(newStageId === 'membro'){ Store.syncMemberToAPI(p); }
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

  getApiConfig(){
    return JSON.parse(localStorage.getItem(this._keyApi) || '{}');
  },
  setApiConfig(cfg){
    localStorage.setItem(this._keyApi, JSON.stringify(cfg));
  },

  // Chamado automaticamente quando alguém chega em "Membro".
  // Troque o corpo da função pela chamada real assim que a API estiver pronta.
  async syncMemberToAPI(person){
    const cfg = this.getApiConfig();
    if(!cfg.baseUrl){
      this.updatePerson(person.id, { pendingSync:true });
      return;
    }
    try{
      // const res = await fetch(`${cfg.baseUrl}/membros`, {
      //   method:'POST',
      //   headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${cfg.token}` },
      //   body: JSON.stringify({ nome:person.nome, telefone:person.telefone, congregacao:person.congregacao }),
      // });
      // if(!res.ok) throw new Error('Falha ao sincronizar');
      this.updatePerson(person.id, { pendingSync:false });
    }catch(err){
      this.updatePerson(person.id, { pendingSync:true });
    }
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
