const codec = window.StoryDocumentCodec;

const elements = {
  newButton: document.querySelector('#new-button'),
  openButton: document.querySelector('#open-button'),
  saveButton: document.querySelector('#save-button'),
  saveAsButton: document.querySelector('#save-as-button'),
  workHeading: document.querySelector('#work-heading'),
  fileStatus: document.querySelector('#file-status'),
  titleInput: document.querySelector('#title-input'),
  protagonistInput: document.querySelector('#protagonist-input'),
  partnerInput: document.querySelector('#partner-input'),
  emptyMessage: document.querySelector('#empty-message'),
  cardList: document.querySelector('#card-list'),
  editorHeading: document.querySelector('#editor-heading'),
  editorModeNote: document.querySelector('#editor-mode-note'),
  cancelEditButton: document.querySelector('#cancel-edit-button'),
  typeButtons: document.querySelector('#type-buttons'),
  cardBody: document.querySelector('#card-body'),
  submitCardButton: document.querySelector('#submit-card-button'),
  editorPanel: document.querySelector('#editor-panel'),
  toast: document.querySelector('#toast'),
};

let story = codec.newDocument();
let currentFilePath = null;
let currentFileName = null;
let selectedType = 'protagonist';
let editingCardId = null;
let insertingAfterCardId = null;
let dirty = false;
let toastTimer = null;

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 2600);
}

function setDirty(nextDirty) {
  dirty = Boolean(nextDirty);
  window.desktopFiles?.setDirty(dirty);
  updateFileStatus();
}

function updateFileStatus() {
  const base = currentFileName || '新しい作品';
  elements.fileStatus.textContent = dirty ? `${base} — 未保存` : base;
}

function confirmDiscardChanges() {
  return !dirty || window.confirm('保存していない変更があります。変更を破棄して続けますか？');
}

function displayLabel(card) {
  if (card.type === 'protagonist') return story.settings.protagonistName || '主人公';
  if (card.type === 'partner') return story.settings.partnerName || '相手役';
  return codec.typeById(card.type).ui;
}

function createButton(text, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  if (className) button.className = className;
  button.addEventListener('click', handler);
  return button;
}

function renderCards() {
  elements.cardList.replaceChildren();
  elements.emptyMessage.classList.toggle('hidden', story.cards.length > 0);

  story.cards.forEach((card) => {
    const type = codec.typeById(card.type);
    const row = document.createElement('div');
    row.className = `card-row align-${type.align}`;
    row.dataset.cardId = card.id;

    const article = document.createElement('article');
    article.className = `story-card type-${card.type}`;
    const top = document.createElement('div');
    top.className = 'card-top';
    const label = document.createElement('div');
    label.className = 'card-label';
    label.textContent = displayLabel(card);
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    actions.append(
      createButton('削除', 'delete-button', () => deleteCard(card.id)),
      createButton('後に追加', 'insert-button', () => startInsertAfter(card.id)),
      createButton('編集', 'edit-button', () => startEdit(card.id)),
    );
    top.append(label, actions);

    const body = document.createElement('p');
    body.className = 'card-body';
    body.textContent = card.body;
    article.append(top, body);
    row.append(article);
    elements.cardList.append(row);
  });
}

function renderSettings() {
  elements.titleInput.value = story.settings.title;
  elements.protagonistInput.value = story.settings.protagonistName;
  elements.partnerInput.value = story.settings.partnerName;
  elements.workHeading.textContent = story.settings.title || '無題の作品';
}

function renderTypeButtons() {
  elements.typeButtons.replaceChildren();
  codec.TYPES.forEach((type) => {
    const button = createButton(type.ui, `type-button-${type.id}`, () => selectType(type.id));
    button.setAttribute('aria-pressed', String(type.id === selectedType));
    elements.typeButtons.append(button);
  });
  elements.cardBody.placeholder = `${codec.typeById(selectedType).ui}を入力`;
}

function renderEditorMode() {
  const isEditing = editingCardId !== null;
  const isInserting = insertingAfterCardId !== null;
  elements.editorHeading.textContent = isEditing ? 'カード編集' : isInserting ? 'このカードの後に追加' : 'カード追加';
  elements.editorModeNote.textContent = isEditing
    ? '種類または文章を変更して「更新」を押してください。'
    : isInserting
      ? '選択したカードの直後に追加します。'
      : 'カードの種類と文章を入力してください。';
  elements.submitCardButton.textContent = isEditing ? '更新' : '追加';
  elements.cancelEditButton.classList.toggle('hidden', !isEditing && !isInserting);
  renderTypeButtons();
}

function renderAll() {
  renderSettings();
  renderCards();
  renderEditorMode();
  updateFileStatus();
}

function selectType(typeId) {
  selectedType = typeId;
  renderTypeButtons();
}

function resetEditor() {
  editingCardId = null;
  insertingAfterCardId = null;
  selectedType = 'protagonist';
  elements.cardBody.value = '';
  renderEditorMode();
}

function focusEditor() {
  elements.editorPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => elements.cardBody.focus(), 180);
}

function startEdit(cardId) {
  const card = story.cards.find((item) => item.id === cardId);
  if (!card) return;
  editingCardId = cardId;
  insertingAfterCardId = null;
  selectedType = card.type;
  elements.cardBody.value = card.body;
  renderEditorMode();
  focusEditor();
}

function startInsertAfter(cardId) {
  editingCardId = null;
  insertingAfterCardId = cardId;
  selectedType = 'protagonist';
  elements.cardBody.value = '';
  renderEditorMode();
  focusEditor();
}

function deleteCard(cardId) {
  const card = story.cards.find((item) => item.id === cardId);
  if (!card || !window.confirm(`「${displayLabel(card)}」のカードを削除しますか？`)) return;
  story.cards = story.cards.filter((item) => item.id !== cardId);
  if (editingCardId === cardId || insertingAfterCardId === cardId) resetEditor();
  setDirty(true);
  renderCards();
  showToast('カードを削除しました');
}

function submitCard() {
  const body = elements.cardBody.value.trim();
  if (!body) {
    showToast('文章を入力してください');
    elements.cardBody.focus();
    return;
  }

  if (editingCardId) {
    const card = story.cards.find((item) => item.id === editingCardId);
    if (card) {
      card.type = selectedType;
      card.body = body;
    }
    showToast('カードを更新しました');
  } else {
    const card = codec.createCard(selectedType, body);
    if (insertingAfterCardId) {
      const index = story.cards.findIndex((item) => item.id === insertingAfterCardId);
      story.cards.splice(index >= 0 ? index + 1 : story.cards.length, 0, card);
    } else {
      story.cards.push(card);
    }
    showToast('カードを追加しました');
  }
  setDirty(true);
  resetEditor();
  renderCards();
}

function syncSetting(key, value) {
  story.settings[key] = value;
  elements.workHeading.textContent = story.settings.title || '無題の作品';
  renderCards();
  setDirty(true);
}

function suggestedFileName() {
  const safeTitle = (story.settings.title || 'untitled').replace(/[\\/:*?"<>|]/g, '_');
  return `${safeTitle}.scw`;
}

async function saveAs() {
  try {
    const result = await window.desktopFiles.saveAs(codec.serialize(story), suggestedFileName());
    if (result.canceled) return false;
    currentFilePath = result.filePath;
    currentFileName = result.fileName;
    setDirty(false);
    showToast(`保存しました：${currentFileName}`);
    return true;
  } catch (error) {
    showToast(`保存できませんでした：${error.message}`);
    return false;
  }
}

async function save() {
  if (!dirty) return true;
  if (!currentFilePath) return saveAs();
  try {
    const result = await window.desktopFiles.save(currentFilePath, codec.serialize(story));
    currentFileName = result.fileName;
    setDirty(false);
    showToast(`保存しました：${currentFileName}`);
    return true;
  } catch (error) {
    showToast(`保存できませんでした：${error.message}`);
    return false;
  }
}

async function openFile() {
  if (!confirmDiscardChanges()) return;
  try {
    const result = await window.desktopFiles.open();
    if (result.canceled) return;
    const loaded = codec.parse(result.content);
    story = loaded;
    currentFilePath = result.filePath;
    currentFileName = result.fileName;
    resetEditor();
    setDirty(false);
    renderAll();
    showToast(`開きました：${currentFileName}`);
  } catch (error) {
    showToast(`開けませんでした：${error.message}`);
  }
}

function newDocument() {
  if (!confirmDiscardChanges()) return;
  story = codec.newDocument();
  currentFilePath = null;
  currentFileName = null;
  resetEditor();
  setDirty(false);
  renderAll();
  elements.titleInput.focus();
  showToast('新しい作品を作成しました');
}

function findCard() {
  const query = window.prompt('検索する文字列を入力してください（タイトル・本文）');
  if (query === null) return;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return;

  const card = story.cards.find((item) => (
    displayLabel(item).toLocaleLowerCase().includes(normalizedQuery)
    || item.body.toLocaleLowerCase().includes(normalizedQuery)
  ));
  if (!card) {
    showToast(`「${query.trim()}」は見つかりませんでした`);
    return;
  }

  const row = elements.cardList.querySelector(`[data-card-id="${CSS.escape(card.id)}"]`);
  row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row?.querySelector('.story-card')?.focus({ preventScroll: true });
  showToast(`「${query.trim()}」に一致するカードへ移動しました`);
}

const commandHandlers = {
  new: newDocument,
  open: openFile,
  save,
  'save-as': saveAs,
  find: findCard,
};

window.desktopFiles?.onCommand((command) => commandHandlers[command]?.());

elements.newButton.addEventListener('click', newDocument);
elements.openButton.addEventListener('click', openFile);
elements.saveButton.addEventListener('click', save);
elements.saveAsButton.addEventListener('click', saveAs);
elements.submitCardButton.addEventListener('click', submitCard);
elements.cancelEditButton.addEventListener('click', resetEditor);
elements.titleInput.addEventListener('input', (event) => syncSetting('title', event.target.value));
elements.protagonistInput.addEventListener('input', (event) => syncSetting('protagonistName', event.target.value));
elements.partnerInput.addEventListener('input', (event) => syncSetting('partnerName', event.target.value));

renderAll();
window.desktopFiles?.setDirty(false);
