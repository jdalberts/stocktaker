// Pure merge logic for stock entries. Same-lot + same-product + same-unit
// entries are summed into a single row rather than creating duplicates.
// Runs in both browser (as StocktakerMerge global) and Node (via require).
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod;
  }
  if (root) {
    root.StocktakerMerge = mod;
  }
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : this,
  function () {
    'use strict';

    function norm(s) {
      return String(s == null ? '' : s)
        .trim()
        .toLowerCase();
    }

    function mergeOrAppendEntry(entries, candidate) {
      const lot = norm(candidate.lotNumber);
      const product = norm(candidate.productName);
      const unit = candidate.unit;

      // Blank lot never merges — different pallets with no lot printed are
      // genuinely distinct and must not be collapsed together.
      const canMerge = lot !== '' && product !== '';

      if (canMerge) {
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          if (
            norm(e.lotNumber) === lot &&
            norm(e.productName) === product &&
            e.unit === unit
          ) {
            const addedQuantity = candidate.quantity;
            const merged = Object.assign({}, e, {
              quantity: e.quantity + addedQuantity,
              addedAt: candidate.addedAt,
            });
            const next = entries.slice();
            next.splice(i, 1);
            next.unshift(merged);
            return {
              entries: next,
              action: {
                type: 'merge',
                id: e.id,
                prevQuantity: e.quantity,
                prevAddedAt: e.addedAt,
                prevIndex: i,
                addedQuantity: addedQuantity,
              },
            };
          }
        }
      }

      return {
        entries: [candidate].concat(entries),
        action: { type: 'new', id: candidate.id },
      };
    }

    return { mergeOrAppendEntry };
  }
);
