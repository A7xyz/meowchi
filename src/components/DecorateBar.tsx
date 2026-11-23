import { Check, RotateCw, Trash2 } from 'lucide-react';
import { FURNITURE_CATALOG, getCatalogItem } from '../config/catalog';
import { UI_TEXT } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';

export function DecorateBar() {
  const state = useGameStore();
  const lang = state.settings.language;
  const t = UI_TEXT[lang];

  if (!state.decorateMode) return null;

  const selectedPlaced = state.placedFurniture.find(
    (f) => f.instanceId === state.selectedFurnitureInstanceId
  );
  const selectedItem = selectedPlaced ? getCatalogItem(selectedPlaced.catalogId) : undefined;

  // Items owned in inventory that aren't all placed yet
  const availableToPlace = FURNITURE_CATALOG.filter((item) => {
    const owned = state.ownedFurniture[item.id] ?? 0;
    const placed = state.placedFurniture.filter((p) => p.catalogId === item.id).length;
    return owned > placed;
  });

  return (
    <div className="action-drawer ui-interactive" style={{ maxHeight: 220 }}>
      <div className="drawer-header">
        <h2 className="drawer-title">
          {t.decorate}
          {selectedItem
            ? ` — ${lang === 'th' ? selectedItem.nameTh : selectedItem.nameEn}`
            : ''}
        </h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => state.setDecorateMode(false)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <Check size={14} />
          {t.doneDecorate}
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#756355', marginBottom: 8 }}>{t.decorateHint}</div>

      {selectedPlaced && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => state.rotateFurniture(selectedPlaced.instanceId)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <RotateCw size={13} />
            {t.rotate}
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => state.removePlacedFurniture(selectedPlaced.instanceId)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Trash2 size={13} />
            {t.remove}
          </button>
        </div>
      )}

      {availableToPlace.length > 0 && (
        <div className="chip-group">
          {availableToPlace.map((item) => {
            const isPlacing = state.placingCatalogId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`chip-btn ${isPlacing ? 'selected' : ''}`}
                onClick={() => state.startPlacingFurniture(isPlacing ? null : item.id)}
              >
                + {lang === 'th' ? item.nameTh : item.nameEn}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
