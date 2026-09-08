(function attachCardEditor(globalObject) {
  function commitPendingCard(document, selectedType, body, createCard) {
    return commitInput(document, {
      body,
      selectedType,
      editingCardId: null,
      insertingAfterCardId: null,
    }, createCard);
  }

  function commitInput(document, editor, createCard) {
    const body = String(editor.body ?? '').trim();
    if (!body) return { committed: false, action: null };

    if (editor.editingCardId) {
      const card = document.cards.find((item) => item.id === editor.editingCardId);
      if (card) {
        card.type = editor.selectedType;
        card.body = body;
        return { committed: true, action: 'updated' };
      }
    }

    const card = createCard(editor.selectedType, body);
    if (editor.insertingAfterCardId) {
      const index = document.cards.findIndex((item) => item.id === editor.insertingAfterCardId);
      document.cards.splice(index >= 0 ? index + 1 : document.cards.length, 0, card);
    } else {
      document.cards.push(card);
    }
    return { committed: true, action: 'added' };
  }

  const cardEditor = Object.freeze({ commitInput, commitPendingCard });
  globalObject.StoryCardEditor = cardEditor;
  if (typeof module !== 'undefined' && module.exports) module.exports = cardEditor;
})(typeof globalThis !== 'undefined' ? globalThis : window);
