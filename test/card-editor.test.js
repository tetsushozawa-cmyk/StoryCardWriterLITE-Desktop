const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const codec = require('../document-codec.js');
const cardEditor = require('../card-editor.js');

function commit(document, overrides = {}) {
  return cardEditor.commitInput(document, {
    body: '',
    selectedType: 'protagonist',
    editingCardId: null,
    insertingAfterCardId: null,
    ...overrides,
  }, codec.createCard);
}

test('未確定入力を選択中の種類のカードとして確定する', () => {
  const document = codec.newDocument();
  const result = commit(document, { body: '  保存したいアイデア\n', selectedType: 'inner' });

  assert.deepEqual(result, { committed: true, action: 'added' });
  assert.equal(document.cards.length, 1);
  assert.equal(document.cards[0].type, 'inner');
  assert.equal(document.cards[0].body, '保存したいアイデア');
});

test('空白と改行だけの入力はカードにしない', () => {
  const document = codec.newDocument();
  const result = commit(document, { body: ' \n\t ' });

  assert.deepEqual(result, { committed: false, action: null });
  assert.equal(document.cards.length, 0);
});

test('既に追加した後の空の入力は二重追加しない', () => {
  const document = codec.newDocument();
  commit(document, { body: '一度だけ' });
  commit(document, { body: '' });

  assert.equal(document.cards.length, 1);
  assert.equal(document.cards[0].body, '一度だけ');
});

test('カード追加なしの入力を.scwに保存し、閉じて再度開ける', async (context) => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'story-card-writer-lite-'));
  context.after(() => fs.rm(temporaryDirectory, { recursive: true, force: true }));
  const filePath = path.join(temporaryDirectory, 'round-trip.scw');
  const document = codec.newDocument();
  commit(document, { body: '再起動後も残る文章', selectedType: 'action' });

  await fs.writeFile(filePath, codec.serialize(document), 'utf8');
  const reopened = codec.parse(await fs.readFile(filePath, 'utf8'));

  assert.equal(reopened.cards.length, 1);
  assert.equal(reopened.cards[0].type, 'action');
  assert.equal(reopened.cards[0].body, '再起動後も残る文章');
});
