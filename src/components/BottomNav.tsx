import { Feather, Gamepad2, HeartHandshake, ShoppingBag, Utensils } from 'lucide-react';
import { UI_TEXT } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import { ActiveTab } from '../types/game';

/**
 * 5-Tab Bottom Navigation: Care, Food, Play, Shop, Minigames.
 */
export function BottomNav() {
  const activeTab = useGameStore((s) => s.activeTab);
  const drawerOpen = useGameStore((s) => s.drawerOpen);
  const lang = useGameStore((s) => s.settings.language);
  const setActiveTab = useGameStore((s) => s.setActiveTab);

  const t = UI_TEXT[lang];

  const tabs: { id: ActiveTab; label: string; Icon: typeof HeartHandshake }[] = [
    { id: 'care', label: t.navCare, Icon: HeartHandshake },
    { id: 'food', label: t.navFood, Icon: Utensils },
    { id: 'play', label: t.navPlay, Icon: Feather },
    { id: 'shop', label: t.navShop, Icon: ShoppingBag },
    { id: 'minigames', label: t.navMinigames, Icon: Gamepad2 }
  ];

  return (
    <nav className="bottom-nav ui-interactive" aria-label="Main Navigation">
      {tabs.map(({ id, label, Icon }) => {
        const isActive = drawerOpen && activeTab === id;
        return (
          <button
            key={id}
            type="button"
            className={`nav-btn ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={19} strokeWidth={isActive ? 2.3 : 1.9} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
