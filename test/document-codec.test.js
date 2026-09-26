const test = require('node:test');
const assert = require('node:assert/strict');
const codec = require('../document-codec.js');

test('カード種類の表示名・順序・色を新しい6種類へ引き継ぐ', () => {
  assert.deepEqual(
    codec.TYPES.map(({ ui, color }) => ({ ui, color })),
    [
      { ui: '主題', color: 'blue' },
      { ui: 'アイデア', color: 'green' },
      { ui: '対象', color: 'gray' },
      { ui: '参考', color: 'orange' },
      { ui: '意見', color: 'green' },
      { ui: '決定', color: 'orange' },
    ],
  );
});

test('Markdown記号を本文のプレーンテキストとして保存・読み込みする', () => {
  const document = codec.newDocument();
  const original = '*半角斜体* と **半角太字**、＊全角斜体＊ と ＊＊全角太字＊＊';
  document.cards.push(codec.createCard('protagonist', original));

  const serialized = codec.serialize(document);
  assert.equal(JSON.parse(serialized).cards[0].text, original);
  assert.equal(codec.parse(serialized).cards[0].body, original);
});

test('Android版JSONをorder順で読み込み、6種類へ変換する', () => {
  const document = codec.parse(JSON.stringify({
    title: '雨の日',
    templateName: 'シナリオ',
    protagonistName: '葵',
    partnerName: '蓮',
    cards: [
      { type: '相手', text: '先のカード', order: 1 },
      { type: '主人公', text: '後のカード', order: 0 },
      { type: '心情', text: '心の中', order: 2 },
    ],
  }));

  assert.equal(document.settings.title, '雨の日');
  assert.deepEqual(document.cards.map((card) => card.type), ['protagonist', 'partner', 'inner']);
  assert.deepEqual(document.cards.map((card) => card.body), ['後のカード', '先のカード', '心の中']);
});

test('保存時にAndroid版形式を保ち、未知の項目を残す', () => {
  const document = codec.parse(JSON.stringify({
    title: '作品',
    futureRootField: { enabled: true },
    cards: [{ type: 'Partner', text: '元の文', order: 8, futureCardField: 42 }],
  }));
  document.cards[0].body = '変更後';
  document.cards.push(codec.createCard('action', '走り出す。'));
  const saved = JSON.parse(codec.serialize(document));

  assert.deepEqual(saved.futureRootField, { enabled: true });
  assert.equal(saved.cards[0].futureCardField, 42);
  assert.equal(saved.cards[0].type, 'Partner');
  assert.equal(saved.cards[0].text, '変更後');
  assert.equal(saved.cards[0].order, 0);
  assert.equal(saved.cards[1].type, 'アクション');
  assert.equal(saved.cards[1].order, 1);
});

test('正式6分類の既存日本語・英語保存値を読み、元の保存値を維持する', () => {
  const storedTypes = [
    '主人公', '相手', 'ナレーション', 'アクション', '心情', '効果音',
    'Protagonist', 'Partner', 'Narration', 'Action', 'Emotion', 'SoundEffect',
  ];
  const expectedIds = [
    'protagonist', 'partner', 'narration', 'action', 'inner', 'sound',
    'protagonist', 'partner', 'narration', 'action', 'inner', 'sound',
  ];
  const document = codec.parse(JSON.stringify({
    cards: storedTypes.map((type, order) => ({ type, text: type, order })),
  }));

  assert.deepEqual(document.cards.map((card) => card.type), expectedIds);
  assert.deepEqual(
    JSON.parse(codec.serialize(document)).cards.map((card) => card.type),
    storedTypes,
  );
});

test('新規カードは正式6分類の既存日本語保存値を使う', () => {
  const document = codec.newDocument();
  for (const type of codec.TYPES) document.cards.push(codec.createCard(type.id, type.ui));

  assert.deepEqual(
    JSON.parse(codec.serialize(document)).cards.map((card) => card.type),
    ['主人公', '相手', 'ナレーション', 'アクション', '心情', '効果音'],
  );
});

test('旧AndroidのHeroは主題として読み、保存値Heroを維持する', () => {
  const document = codec.parse(JSON.stringify({ cards: [{ type: 'Hero', text: '主人公候補' }] }));

  assert.equal(document.cards[0].type, 'protagonist');
  assert.equal(JSON.parse(codec.serialize(document)).cards[0].type, 'Hero');
});

test('未知分類は表示用の既定分類へ落としても元の分類値と付随情報を維持する', () => {
  const document = codec.parse(JSON.stringify({
    cards: [{
      type: 'Partner2',
      label: '旧Android分類',
      color: 'purple',
      text: '意味を推測しない',
      futureCardField: { keep: true },
    }],
  }));

  assert.equal(document.cards[0].type, 'narration');
  const saved = JSON.parse(codec.serialize(document));
  assert.equal(saved.cards[0].type, 'Partner2');
  assert.equal(saved.cards[0].label, '旧Android分類');
  assert.equal(saved.cards[0].color, 'purple');
  assert.deepEqual(saved.cards[0].futureCardField, { keep: true });
});

test('未知分類カードを明示的に別分類へ変更した場合は新しい分類値で保存する', () => {
  const document = codec.parse(JSON.stringify({ cards: [{ type: 'FutureType', text: '変更する' }] }));
  document.cards[0].type = 'action';

  const saved = JSON.parse(codec.serialize(document));
  assert.equal(saved.cards[0].type, 'アクション');
  assert.equal(saved.cards[0].label, 'アクション');
  assert.equal(saved.cards[0].color, 'orange');
});

test('settings入れ子形式を壊さずに保存する', () => {
  const document = codec.parse(JSON.stringify({
    settings: { title: '入れ子', protagonistName: 'A', custom: 'keep' },
    cards: [],
  }));
  document.settings.title = '変更';
  const saved = JSON.parse(codec.serialize(document));
  assert.equal(saved.settings.title, '変更');
  assert.equal(saved.settings.custom, 'keep');
  assert.equal(Object.hasOwn(saved, 'title'), false);
});

test('cardsのないJSONは明確なエラーにする', () => {
  assert.throws(() => codec.parse('{"title":"作品"}'), /cards が見つかりません/);
});
