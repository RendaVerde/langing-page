const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const server = fs.readFileSync(path.join(__dirname, '..', 'integrations', 'google-sheets', 'Code.gs'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

function sheet(initialRows = []) {
  const rows = initialRows.map((row) => row.slice());
  return {
    rows,
    getLastRow() { return rows.length; },
    getLastColumn() { return Math.max(0, ...rows.map((row) => row.length)); },
    getRange(row, column, height = 1, width = 1) {
      return {
        getValues() { return Array.from({ length: height }, (_, offset) =>
          Array.from({ length: width }, (_, col) => rows[row - 1 + offset]?.[column - 1 + col] ?? '')); },
        setValues(values) { values.forEach((data, index) => { rows[row - 1 + index] = data.slice(); }); },
        setValue(value) { rows[row - 1] ||= []; rows[row - 1][column - 1] = value; },
      };
    },
    appendRow(row) { rows.push(row.slice()); },
  };
}

function serverHarness(tabs = {}) {
  const errors = [];
  let flushes = 0;
  const context = vm.createContext({
    console: { error(...args) { errors.push(args); } },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput(text) { return { text, setMimeType() { return this; } }; },
    },
    PropertiesService: { getScriptProperties() { return { getProperty() { return 'sheet-test-id'; } }; } },
    SpreadsheetApp: {
      openById(id) { assert.equal(id, 'sheet-test-id'); return { getSheetByName(name) { return tabs[name] || null; } }; },
      flush() { flushes++; },
    },
    LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
  });
  vm.runInContext(server, context);
  const post = (lead) => JSON.parse(context.doPost({ parameter: { payload: JSON.stringify(lead) } }).text);
  return { post, errors, flushes: () => flushes };
}

const licensee = {
  site_id: 'rendaverde-igreen', tipo: 'licenciado', lead_id: 'license-001',
  nome: 'Pessoa Teste', whatsapp: '(00) 00000-0000', email: 'teste@example.invalid',
  cidade: 'Cidade Teste', objetivo: 'Renda extra', tempo: 'Meio período',
  perfil: 'Vendas', momento: 'Agora', score: 4, rota_resultado: 'WhatsApp',
  utm_source: 'campanha', page_url: 'https://example.invalid/',
};

test('doPost insere o licenciado na aba certa e preserva a ordem da tabela existente', () => {
  const licensed = sheet([['WhatsApp', 'Nome', 'Cidade/UF', 'Interesse', 'Origem', 'Lead ID']]);
  const clients = sheet([['Nome', 'WhatsApp', 'Lead ID']]);
  const h = serverHarness({ Licenciados: licensed, Clientes: clients });
  assert.deepEqual(h.post(licensee), { ok: true, status: 'saved', tipo: 'licenciado' });
  assert.equal(licensed.rows.length, 2);
  assert.equal(clients.rows.length, 1);
  assert.deepEqual(licensed.rows[1], [licensee.whatsapp, licensee.nome, licensee.cidade,
    licensee.objetivo, licensee.utm_source, licensee.lead_id]);
  assert.equal(h.flushes(), 1);
  assert.deepEqual(h.post(licensee), { ok: true, status: 'duplicate', tipo: 'licenciado' });
  assert.equal(licensed.rows.length, 2);
});

test('adiciona Lead ID à aba existente sem modificar os outros cabeçalhos', () => {
  const licensed = sheet([['Nome', 'WhatsApp', 'Email']]);
  const h = serverHarness({ Licenciados: licensed });
  assert.equal(h.post(licensee).status, 'saved');
  assert.deepEqual(licensed.rows[0], ['Nome', 'WhatsApp', 'Email', 'Lead ID']);
  assert.equal(licensed.rows[1][3], licensee.lead_id);
  assert.equal(h.post(licensee).status, 'duplicate');
});

test('recebe o contrato da LP compacta anterior no mesmo endpoint', () => {
  const licensed = sheet([['Nome', 'WhatsApp', 'Lead ID']]);
  const h = serverHarness({ Licenciados: licensed });
  const compact = { ...licensee, lead_id: 'compact-001', lead_type: 'licenciado' };
  delete compact.tipo;
  assert.equal(h.post(compact).status, 'saved');
  assert.equal(licensed.rows[1][2], 'compact-001');
});

test('não desvia licenciados para Clientes quando a aba ou colunas faltam', () => {
  const clients = sheet([['Nome', 'WhatsApp']]);
  const missing = serverHarness({ Clientes: clients });
  assert.equal(missing.post(licensee).ok, false);
  assert.equal(clients.rows.length, 1);
  const unusable = sheet([['Descrição', 'Celular']]);
  assert.equal(serverHarness({ Licenciados: unusable }).post(licensee).ok, false);
  assert.equal(unusable.rows.length, 1);
});

test('valida site e tipo e evita que textos de leads virem fórmulas', () => {
  const licensed = sheet();
  const h = serverHarness({ Licenciados: licensed });
  assert.equal(h.post({ ...licensee, site_id: 'outro' }).ok, false);
  assert.equal(h.post({ ...licensee, tipo: 'desconhecido' }).ok, false);
  assert.equal(h.post({ ...licensee, nome: '=IMPORTXML("url")' }).status, 'saved');
  const nameColumn = licensed.rows[0].indexOf('Nome');
  assert.equal(licensed.rows[1][nameColumn], "'=IMPORTXML(\"url\")");
});

test('frontend envia contrato da aba Licenciados e distingue transporte de gravação', async () => {
  assert.match(frontend, /tipo:\s*"licenciado"/);
  assert.doesNotMatch(frontend, /trackConversionEvent\("lead_salvo"/);
  const source = frontend.slice(frontend.indexOf('async function saveLeadToSheet(data)'));
  const beacons = [];
  const context = vm.createContext({
    CONFIG: { sheetEndpoint: 'https://example.invalid/exec', sheetSiteId: 'rendaverde-igreen' },
    URLSearchParams, AbortController, console,
    navigator: { sendBeacon(url, body) { beacons.push({ url, body }); return true; } },
    window: { setTimeout, clearTimeout }, fetch: async () => { throw Error('fetch não deveria executar'); },
  });
  vm.runInContext(source, context);
  assert.equal(await context.saveLeadToSheet(licensee), true);
  const payload = JSON.parse(beacons[0].body.get('payload'));
  assert.equal(payload.site_id, 'rendaverde-igreen');
  assert.equal(payload.tipo, 'licenciado');
  assert.equal(payload.lead_id, 'license-001');
  assert.equal(payload.nome, licensee.nome);
});

test('frontend trata exceção do Beacon e erro HTTP visível no fallback', async () => {
  const source = frontend.slice(frontend.indexOf('async function saveLeadToSheet(data)'));
  let request;
  const context = vm.createContext({
    CONFIG: { sheetEndpoint: 'https://example.invalid/exec', sheetSiteId: 'rendaverde-igreen' },
    URLSearchParams, AbortController, console: { warn() {}, error() {} },
    navigator: { sendBeacon() { throw Error('bloqueado'); } },
    window: { setTimeout, clearTimeout },
    fetch: async (_url, init) => { request = init; return { type: 'basic', ok: false, status: 500 }; },
  });
  vm.runInContext(source, context);
  assert.equal(await context.saveLeadToSheet(licensee), false);
  assert.equal(request.method, 'POST');
  assert.equal(request.mode, 'no-cors');
  assert.equal(JSON.parse(request.body.get('payload')).lead_id, 'license-001');
});
