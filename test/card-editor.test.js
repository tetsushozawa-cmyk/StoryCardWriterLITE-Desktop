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

test('新規入力中に過去カードの編集を始めても入力が通常カードとして残る', () => {
  const document = codec.newDocument();
  const existing = codec.createCard('action', '過去のカード');
  document.cards.push(existing);

  const result = cardEditor.commitPendingCard(
    document,
    'inner',
    '入力中の新規カード',
    codec.createCard,
  );

  assert.deepEqual(result, { committed: true, action: 'added' });
  assert.deepEqual(document.cards.map((card) => card.body), [
    '過去のカード',
    '入力中の新規カード',
  ]);
  assert.equal(document.cards[1].type, 'inner');
});

test('新規入力を確定後に編集モードへ入っても同じ内容を二重登録しない', () => {
  const document = codec.newDocument();
  const existing = codec.createCard('action', '過去のカード');
  document.cards.push(existing);

  cardEditor.commitPendingCard(document, 'inner', '入力中の新規カード', codec.createCard);
  commit(document, { body: existing.body, editingCardId: existing.id });

  assert.deepEqual(document.cards.map((card) => card.body), [
    '過去のカード',
    '入力中の新規カード',
  ]);
});

test('空白入力中に過去カードの編集を始めてもカードは増えない', () => {
  const document = codec.newDocument();
  document.cards.push(codec.createCard('action', '過去のカード'));

  const result = cardEditor.commitPendingCard(document, 'inner', ' \n\t ', codec.createCard);

  assert.deepEqual(result, { committed: false, action: null });
  assert.equal(document.cards.length, 1);
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
