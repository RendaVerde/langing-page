/* Receptor Apps Script das LPs iGreen. Configure SPREADSHEET_ID nas propriedades
   do projeto e implante como Web app executando como o proprietário. */
const LEADS_SITE_ID = 'rendaverde-igreen';
const LEADS_TABS = { licenciado: 'Licenciados', cliente: 'Clientes' };
const LEADS_HEADERS = {
  licenciado: [
    'Data', 'Lead ID', 'Nome', 'WhatsApp', 'Email', 'Cidade', 'Objetivo',
    'Tempo', 'Perfil', 'Momento', 'Score', 'Rota resultado', 'Origem',
    'Mídia', 'Campanha', 'Conteúdo', 'GCLID', 'FBCLID', 'Página',
  ],
  cliente: [
    'Data', 'Lead ID', 'Nome', 'WhatsApp', 'Email', 'Cidade', 'Interesse',
    'Perfil', 'Observação', 'Origem', 'Mídia', 'Campanha', 'Conteúdo',
    'GCLID', 'FBCLID', 'Página',
  ],
};

const LEADS_COLUMNS = {
  data: 'created_at', 'data hora': 'created_at', 'data cadastro': 'created_at',
  'data e hora': 'created_at', timestamp: 'created_at',
  'lead id': 'lead_id', 'id do lead': 'lead_id', id: 'lead_id',
  nome: 'nome', 'nome completo': 'nome',
  whatsapp: 'whatsapp', telefone: 'whatsapp', celular: 'whatsapp',
  email: 'email', cidade: 'cidade', 'cidade uf': 'cidade',
  objetivo: 'objetivo', interesse: 'interesse',
  tempo: 'tempo', 'tempo disponivel': 'tempo',
  perfil: 'perfil', 'perfil comercial': 'perfil', momento: 'momento',
  score: 'score', pontuacao: 'score',
  rota: 'rota_resultado', 'rota resultado': 'rota_resultado',
  'proximo passo': 'rota_resultado',
  observacao: 'observacao',
  origem: 'utm_source', 'utm source': 'utm_source',
  midia: 'utm_medium', 'utm medium': 'utm_medium',
  campanha: 'utm_campaign', 'utm campaign': 'utm_campaign',
  conteudo: 'utm_content', 'utm content': 'utm_content',
  gclid: 'gclid', fbclid: 'fbclid',
  pagina: 'page_url', 'page url': 'page_url', url: 'page_url',
  tipo: 'tipo', 'site id': 'site_id', 'landing id': 'landing_id',
};

function leadsHeaderKey_(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function leadsText_(value) {
  const text = String(value == null ? '' : value).trim().slice(0, 2000);
  // setValues/appendRow interpretam uma célula iniciada por = como fórmula.
  return /^[=+@-]/.test(text) ? "'" + text : text;
}

function leadsResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return leadsResponse_({ ok: true, service: 'igreen-leads' });
}

function doPost(e) {
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (!raw) throw new Error('Parâmetro payload ausente');
    const lead = JSON.parse(raw);
    if (lead.site_id !== LEADS_SITE_ID) throw new Error('site_id inválido');
    // A LP compacta anterior ainda usa lead_type; mantém compatibilidade.
    if (!lead.tipo && lead.lead_type === 'licenciado') lead.tipo = 'licenciado';
    if (!Object.prototype.hasOwnProperty.call(LEADS_TABS, lead.tipo)) {
      throw new Error('Tipo de lead inválido');
    }
    if (!lead.lead_id || !lead.nome || !lead.whatsapp) {
      throw new Error('Lead ID, nome e WhatsApp são obrigatórios');
    }
    const sheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!sheetId) throw new Error('SPREADSHEET_ID não configurado');
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(LEADS_TABS[lead.tipo]);
      if (!sheet) throw new Error('Aba ' + LEADS_TABS[lead.tipo] + ' não encontrada');
      let headers;
      if (sheet.getLastRow() === 0) {
        headers = LEADS_HEADERS[lead.tipo].slice();
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      } else {
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
      let fields = headers.map((header) => LEADS_COLUMNS[leadsHeaderKey_(header)] || '');
      if (!fields.includes('nome') || !fields.includes('whatsapp')) {
        throw new Error('Cabeçalho deve conter Nome e WhatsApp');
      }
      if (!fields.includes('lead_id')) {
        sheet.getRange(1, headers.length + 1).setValue('Lead ID');
        headers.push('Lead ID');
        fields.push('lead_id');
      }
      const idColumn = fields.indexOf('lead_id') + 1;
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const ids = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
        if (ids.some((row) => String(row[0]) === String(lead.lead_id))) {
          return leadsResponse_({ ok: true, status: 'duplicate', tipo: lead.tipo });
        }
      }
      const values = {
        ...lead,
        // Algumas tabelas existentes usam Interesse no lugar de Objetivo.
        interesse: lead.interesse || lead.objetivo || '',
        objetivo: lead.objetivo || lead.interesse || '',
        created_at: new Date(),
      };
      const row = fields.map((field) => {
        if (!field) return '';
        const value = values[field];
        return value instanceof Date || typeof value === 'number'
          ? value : leadsText_(value);
      });
      sheet.appendRow(row);
      SpreadsheetApp.flush();
      return leadsResponse_({ ok: true, status: 'saved', tipo: lead.tipo });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error('Falha ao registrar lead:', error);
    return leadsResponse_({ ok: false, error: String(error.message || error) });
  }
}
