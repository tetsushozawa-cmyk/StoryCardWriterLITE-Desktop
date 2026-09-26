(function attachCodec(globalObject) {
  const TYPES = [
    { id: 'protagonist', ui: '主題', json: '主人公', english: 'Protagonist', color: 'blue', align: 'left' },
    { id: 'partner', ui: 'アイデア', json: '相手', english: 'Partner', color: 'green', align: 'right' },
    { id: 'narration', ui: '対象', json: 'ナレーション', english: 'Narration', color: 'gray', align: 'center' },
    { id: 'action', ui: '参考', json: 'アクション', english: 'Action', color: 'orange', align: 'center' },
    { id: 'inner', ui: '意見', json: '心情', english: 'Emotion', color: 'green', align: 'center' },
    { id: 'sound', ui: '決定', json: '効果音', english: 'SoundEffect', color: 'orange', align: 'center' },
  ];

  const TYPE_ALIASES = new Map([
    ['主人公', 'protagonist'], ['Protagonist', 'protagonist'], ['Hero', 'protagonist'],
    ['相手', 'partner'], ['相手役', 'partner'], ['Partner', 'partner'],
    ['ナレーション', 'narration'], ['Narration', 'narration'],
    ['アクション', 'action'], ['Action', 'action'],
    ['心の声', 'inner'], ['心情', 'inner'], ['Emotion', 'inner'], ['InnerVoice', 'inner'],
    ['効果音', 'sound'], ['SoundEffect', 'sound'], ['Sfx', 'sound'],
  ]);

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const typeById = (id) => TYPES.find((type) => type.id === id) || TYPES[2];

  function parse(text) {
    let root;
    try {
      root = JSON.parse(text);
    } catch (_error) {
      throw new Error('JSON形式ではありません。');
    }
    if (!root || Array.isArray(root) || typeof root !== 'object') {
      throw new Error('StoryCardWriterのJSONオブジェクトではありません。');
    }
    if (!Array.isArray(root.cards)) {
      throw new Error('cards が見つかりません。Android版StoryCardWriterのJSONを選んでください。');
    }

    const settingsSource = root.settings && typeof root.settings === 'object' && !Array.isArray(root.settings)
      ? root.settings
      : root;
    const cards = root.cards.map((rawCard, sourceIndex) => {
      const raw = rawCard && typeof rawCard === 'object' && !Array.isArray(rawCard) ? clone(rawCard) : {};
      const hasStoredType = raw.type !== undefined && raw.type !== null
        || raw.cardType !== undefined && raw.cardType !== null;
      const rawType = String(raw.type ?? raw.cardType ?? 'ナレーション');
      const resolvedType = TYPE_ALIASES.get(rawType);
      return {
        id: `loaded-${sourceIndex}-${Math.random().toString(36).slice(2)}`,
        type: resolvedType || 'narration',
        body: String(raw.text ?? raw.body ?? ''),
        sourceIndex,
        sourceOrder: Number.isFinite(Number(raw.order)) ? Number(raw.order) : sourceIndex,
        raw,
        typeStyle: TYPES.some((type) => type.english === rawType) ? 'english' : 'japanese',
        sourceType: hasStoredType ? rawType : null,
        sourceTypeId: resolvedType || null,
      };
    }).sort((left, right) => left.sourceOrder - right.sourceOrder || left.sourceIndex - right.sourceIndex);

    return {
      root: clone(root),
      usesNestedSettings: settingsSource !== root,
      settings: {
        title: String(settingsSource.title ?? ''),
        templateName: String(settingsSource.templateName ?? 'シナリオ') || 'シナリオ',
        protagonistName: String(settingsSource.protagonistName ?? ''),
        partnerName: String(settingsSource.partnerName ?? ''),
      },
      cards,
    };
  }

  function newDocument() {
    return {
      root: { title: '', templateName: 'シナリオ', protagonistName: '', partnerName: '', cards: [] },
      usesNestedSettings: false,
      settings: { title: '', templateName: 'シナリオ', protagonistName: '', partnerName: '' },
      cards: [],
    };
  }

  function createCard(type, body) {
    return {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      body,
      sourceIndex: -1,
      sourceOrder: -1,
      raw: {},
      typeStyle: 'japanese',
      sourceType: null,
      sourceTypeId: null,
    };
  }

  function serialize(document) {
    const root = clone(document.root || {});
    const target = document.usesNestedSettings
      ? (root.settings = root.settings && typeof root.settings === 'object' ? root.settings : {})
      : root;
    target.title = document.settings.title;
    target.templateName = document.settings.templateName || 'シナリオ';
    target.protagonistName = document.settings.protagonistName;
    target.partnerName = document.settings.partnerName;

    root.cards = document.cards.map((card, index) => {
      const raw = clone(card.raw || {});
      const type = typeById(card.type);
      const preservesSourceType = card.sourceType !== null && card.sourceType !== undefined
        && (card.sourceTypeId ? card.type === card.sourceTypeId : card.type === 'narration');
      raw.type = preservesSourceType
        ? card.sourceType
        : card.typeStyle === 'english' ? type.english : type.json;
      if (card.sourceTypeId || !preservesSourceType) {
        raw.label = card.type === 'protagonist'
          ? (document.settings.protagonistName || '主人公')
          : card.type === 'partner'
            ? (document.settings.partnerName || '相手')
            : type.json;
      }
      if (Object.prototype.hasOwnProperty.call(raw, 'body') && !Object.prototype.hasOwnProperty.call(raw, 'text')) {
        raw.body = card.body;
      } else {
        raw.text = card.body;
      }
      if (card.sourceTypeId || !preservesSourceType) raw.color = type.color;
      raw.order = index;
      return raw;
    });
    return `${JSON.stringify(root, null, 2)}\n`;
  }

  const codec = Object.freeze({ TYPES, parse, serialize, newDocument, createCard, typeById });
  globalObject.StoryDocumentCodec = codec;
  if (typeof module !== 'undefined' && module.exports) module.exports = codec;
})(typeof globalThis !== 'undefined' ? globalThis : window);
