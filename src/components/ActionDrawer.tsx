import {
  Baby,
  ClipboardList,
  Coins,
  Compass,
  Cpu,
  Droplets,
  Feather,
  Fish,
  Grid2x2,
  Heart,
  Image as ImageIcon,
  Moon,
  Paintbrush,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  UserCircle2,
  Utensils,
  X,
  Zap
} from 'lucide-react';
import { ReactNode, useState } from 'react';
import {
  ACCESSORY_CATALOG,
  FOOD_CATALOG,
  FURNITURE_CATALOG,
  TOY_CATALOG
} from '../config/catalog';
import { ECONOMY_CONFIG } from '../config/economy';
import { UI_TEXT } from '../i18n/translations';
import {
  formatClockTime,
  formatCountdownMmSs,
  getEnergyRegenInfo
} from '../simulation/energy';
import { computeGrowthMetrics, isFoodSafeForAge } from '../simulation/growth';
import { useGameStore } from '../store/useGameStore';
import { MinigameId } from '../types/game';

interface ActionDrawerProps {
  onFocusCat: () => void;
}

type ShopCategory = 'food' | 'equipment' | 'toys' | 'beds' | 'furniture' | 'accessories';

export function ActionDrawer({ onFocusCat }: ActionDrawerProps) {
  const state = useGameStore();
  const {
    activeTab,
    drawerOpen,
    cat,
    room,
    settings,
    coins,
    playerEnergy,
    activeCareAction,
    foodInventory,
    ownedAccessories,
    ownedFurniture,
    ownedToys,
    dailyTasks
  } = state;
  const [shopCat, setShopCat] = useState<ShopCategory>('food');

  const lang = settings.language;
  const t = UI_TEXT[lang];

  if (!drawerOpen) return null;

  const isActionBusy = activeCareAction !== null;
  const metrics = computeGrowthMetrics(cat.identity.breed, cat.ageDays);
  const claimableCount = dailyTasks.filter((d) => !d.claimed && d.progress >= d.target).length;
  const energyInfo = getEnergyRegenInfo(playerEnergy, Date.now());
  const canStartMinigame = energyInfo.current >= ECONOMY_CONFIG.MINIGAME_ENERGY_COST;

  const titles = {
    care: t.navCare,
    food: t.navFood,
    play: t.navPlay,
    shop: t.navShop,
    minigames: t.navMinigames
  };

  const minigameList: {
    id: MinigameId;
    titleTh: string;
    titleEn: string;
    descTh: string;
    descEn: string;
    icon: ReactNode;
  }[] = [
    {
      id: 'fishing',
      titleTh: 'ตกปลาให้น้องแมว (Fishing)',
      titleEn: 'Cozy Pond Fishing',
      descTh: 'ลากทุ่นเบ็ดและกะจังหวะดึงเมื่อปลางับเหยื่อ ภายใน 60 วินาที',
      descEn: 'Drag your bobber & hook biting fish over a 60s round!',
      icon: <Fish size={17} color="#4e8eb2" />
    },
    {
      id: 'matching',
      titleTh: 'จับคู่ของเล่นแมว (Matching)',
      titleEn: 'Cat Matching Puzzle',
      descTh: 'เปิดการ์ดจับคู่ของใช้น้องแมวต่อเนื่อง 60 วินาทีเพื่อทำคอมโบ',
      descEn: 'Match cat-themed tiles across continuous rounds in 60s!',
      icon: <Grid2x2 size={17} color="#c87a56" />
    },
    {
      id: 'toy_challenge',
      titleTh: 'ตะครุบของเล่น (Toy Challenge)',
      titleEn: 'Cat Toy Challenge',
      descTh: 'แตะตะครุบขนนก หนู และจุดเลเซอร์ให้ไวที่สุด หลบกระบองเพชร!',
      descEn: 'Tap moving feathers, mice & laser dots fast while avoiding cacti!',
      icon: <Feather size={17} color="#d49a42" />
    },
    {
      id: 'delivery',
      titleTh: 'ส่งอาหารแมวด่วน (Delivery)',
      titleEn: 'Cat Supply Delivery',
      descTh: 'แตะสลับเลนส่งกล่องอาหารและปลาแซลมอน หลบสิ่งกีดขวาง 60 วินาที',
      descEn: 'Tap lanes to deliver cat food parcels & salmon while dodging cones!',
      icon: <Truck size={17} color="#c87a56" />
    },
    {
      id: 'clean_room',
      titleTh: 'จัดเก็บห้องนั่งเล่น (Room Cleaning)',
      titleEn: 'Room Cleaning Challenge',
      descTh: 'จัดเก็บของเล่น ชาม และหมอนเข้าที่ให้ได้หลายรอบที่สุดใน 60 วินาที',
      descEn: 'Sort scattered toys, bowls & pillows across waves in 60s!',
      icon: <Sparkles size={17} color="#6d9575" />
    }
  ];

  return (
    <section className="action-drawer ui-interactive" aria-label={titles[activeTab]}>
      <div className="drawer-header">
        <h2 className="drawer-title">{titles[activeTab]}</h2>
        <button
          type="button"
          className="drawer-close"
          onClick={() => state.setDrawerOpen(false)}
          aria-label="Close"
        >
          <X size={15} />
        </button>
      </div>

      {/* TAB 1: CARE & HOME TOOLS (Zero Coins; visible 3D hand animations; disabled while running) */}
      {activeTab === 'care' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="action-grid">
            <button
              type="button"
              className="action-card"
              disabled={isActionBusy}
              onClick={() => state.petCat()}
            >
              <div className="action-card-top">
                <Heart size={16} color="#cf6f72" />
                <span className="badge warm">+Trust</span>
              </div>
              <span className="action-card-title">{t.petCat}</span>
              <span className="action-card-sub">
                {lang === 'th' ? 'ยื่นมือลูบเบาๆ อย่ารบกวนตอนหลับ' : 'Stroke gently by hand (respect sleep)'}
              </span>
            </button>

            <button
              type="button"
              className="action-card"
              disabled={isActionBusy}
              onClick={() => state.respectCatSpace()}
            >
              <div className="action-card-top">
                <ShieldCheck size={16} color="#6d9575" />
                <span className="badge sage">Calm</span>
              </div>
              <span className="action-card-title">{t.respectSpace}</span>
              <span className="action-card-sub">
                {lang === 'th' ? 'ลดความเครียดเมื่อแมวขู่หรือกลัว' : 'Calms stress & defensive mood'}
              </span>
            </button>

            <button
              type="button"
              className="action-card"
              disabled={isActionBusy}
              onClick={() => state.brushCat()}
            >
              <div className="action-card-top">
                <Sparkles size={16} color="#d49a42" />
                <span className="badge sage">Fluffy</span>
              </div>
              <span className="action-card-title">{t.brushCat}</span>
            </button>

            <button
              type="button"
              className="action-card"
              disabled={isActionBusy}
              onClick={() => state.tuckCatToSleep()}
            >
              <div className="action-card-top">
                <Moon size={16} color="#6b7ba4" />
                <span className="badge">Rest</span>
              </div>
              <span className="action-card-title">{t.tuckSleep}</span>
            </button>

            <button
              type="button"
              className="action-card"
              disabled={isActionBusy}
              onClick={() => state.cleanLitterBox()}
            >
              <div className="action-card-top">
                <Trash2 size={16} color="#6d9575" />
                <span className={`badge ${room.litterCleanliness < 45 ? 'warn' : 'sage'}`}>
                  {Math.round(room.litterCleanliness)}%
                </span>
              </div>
              <span className="action-card-title">{t.cleanLitter}</span>
            </button>

            <button
              type="button"
              className="action-card"
              disabled={isActionBusy}
              onClick={() => state.cleanLivingArea()}
            >
              <div className="action-card-top">
                <Sparkles size={16} color="#5f9bb8" />
                <span className={`badge ${room.tableMugKnocked ? 'warn' : 'sage'}`}>
                  {room.tableMugKnocked
                    ? lang === 'th'
                      ? 'แก้วตก!'
                      : 'Mug!'
                    : `${Math.round(room.roomCleanliness)}%`}
                </span>
              </div>
              <span className="action-card-title">{t.cleanMess}</span>
            </button>
          </div>

          <div className="chip-group">
            <button
              type="button"
              className="chip-btn"
              onClick={() => state.setShowEquipmentModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Cpu size={13} />
              {t.smartDevices}
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => state.setShowProfileModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <UserCircle2 size={13} />
              {t.catProfile}
            </button>
            <button
              type="button"
              className={`chip-btn ${settings.followCat ? 'selected' : ''}`}
              onClick={() => {
                state.updateSettings({ followCat: !settings.followCat });
                if (!settings.followCat) onFocusCat();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Compass size={13} />
              {t.followCat}
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => state.setDecorateMode(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <Paintbrush size={13} />
              {t.decorate}
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => state.setShowTasksModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ClipboardList size={13} />
              {t.dailyTasks}
              {claimableCount > 0 ? ` (+${claimableCount})` : ''}
            </button>
            <button
              type="button"
              className="chip-btn"
              onClick={() => state.setShowAlbumModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ImageIcon size={13} />
              {t.photoAlbum} ({state.photos.length})
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: FOOD INVENTORY & FREE WATER (NO HUNGER BARS!) */}
      {activeTab === 'food' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            className="section-box"
            style={{ background: '#fbf4ea', fontSize: 11, color: '#6b5546', gap: 4 }}
          >
            <div>🐾 {t.noHungerBarNote}</div>
            <div className="row-between" style={{ marginTop: 2 }}>
              <span>💧 {t.freeWaterNote}</span>
              <button
                type="button"
                className="btn-secondary"
                disabled={isActionBusy}
                onClick={() => state.giveWater()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
              >
                <Droplets size={13} color="#5f9bb8" />
                {t.refillWater}
              </button>
            </div>
          </div>

          <div className="action-grid">
            {FOOD_CATALOG.map((item) => {
              const stock = foodInventory[item.id] ?? 0;
              const check = isFoodSafeForAge(item.id, cat.ageDays);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isActionBusy}
                  className={`action-card ${!check.allowed || stock <= 0 ? 'locked' : ''}`}
                  onClick={() => {
                    if (stock <= 0) {
                      setShopCat('food');
                      state.setActiveTab('shop');
                      return;
                    }
                    state.feedCat(item.id);
                  }}
                >
                  <div className="action-card-top">
                    {item.id === 'kitten_milk' ? (
                      <Baby size={15} color="#c87a56" />
                    ) : (
                      <Utensils size={15} color="#c87a56" />
                    )}
                    <span className={`badge ${stock > 0 && check.allowed ? 'sage' : 'warn'}`}>
                      {!check.allowed
                        ? lang === 'th'
                          ? 'ยังไม่ถึงวัย'
                          : 'Too young'
                        : stock > 0
                          ? `${t.inStock} ${stock}`
                          : lang === 'th'
                            ? 'หมด (ซื้อ)'
                            : 'Empty'}
                    </span>
                  </div>
                  <span className="action-card-title">
                    {lang === 'th' ? item.nameTh : item.nameEn}
                  </span>
                  <span className="action-card-sub">
                    {stock > 0 ? t.offerFood : t.outOfStock}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PLAY & INTERACTIVE TOYS */}
      {activeTab === 'play' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!metrics.canUseToys && (
            <div className="section-box" style={{ fontSize: 11, color: '#964927', background: '#fff7f0' }}>
              {lang === 'th'
                ? 'ลูกแมวแรกเกิดยังตาปิดและพักผ่อนเป็นหลัก ของเล่นจะปลดล็อกเมื่ออายุ 18 วันขึ้นไป'
                : 'Newborns rest with eyes closed. Interactive toys unlock at ~3 weeks old.'}
            </div>
          )}
          <div className="action-grid">
            {TOY_CATALOG.map((toy) => {
              const isOwned = ownedToys.includes(toy.id);
              const isActive = state.activeToy === toy.id;
              return (
                <button
                  key={toy.id}
                  type="button"
                  className={`action-card ${isActive ? 'active' : ''} ${!metrics.canUseToys || !isOwned ? 'locked' : ''}`}
                  onClick={() => {
                    if (!isOwned) {
                      setShopCat('toys');
                      state.setActiveTab('shop');
                      return;
                    }
                    state.activateToy(isActive ? null : toy.id);
                  }}
                >
                  <div className="action-card-top">
                    <Feather size={16} color="#c87a56" />
                    <span className={`badge ${isActive ? 'warm' : isOwned ? 'sage' : ''}`}>
                      {isActive
                        ? 'ACTIVE'
                        : isOwned
                          ? lang === 'th'
                            ? 'เล่นเลย'
                            : 'Play'
                          : `${toy.priceCoins}c`}
                    </span>
                  </div>
                  <span className="action-card-title">
                    {lang === 'th' ? toy.nameTh : toy.nameEn}
                  </span>
                  <span className="action-card-sub">
                    {lang === 'th' ? toy.descTh : toy.descEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SHOP (FOOD, AUTOMATIC EQUIPMENT, TOYS, BEDS, FURNITURE, ACCESSORIES) */}
      {activeTab === 'shop' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="chip-group">
            {(
              [
                { id: 'food', th: 'อาหาร', en: 'Food' },
                { id: 'equipment', th: 'อุปกรณ์อัตโนมัติ', en: 'Auto Gear' },
                { id: 'toys', th: 'ของเล่น', en: 'Toys' },
                { id: 'beds', th: 'ที่นอน', en: 'Beds' },
                { id: 'furniture', th: 'เฟอร์นิเจอร์', en: 'Furniture' },
                { id: 'accessories', th: 'เครื่องประดับ', en: 'Accessories' }
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip-btn ${shopCat === c.id ? 'selected' : ''}`}
                onClick={() => setShopCat(c.id)}
              >
                {lang === 'th' ? c.th : c.en}
              </button>
            ))}
          </div>

          {shopCat === 'food' &&
            FOOD_CATALOG.map((item) => {
              const stock = foodInventory[item.id] ?? 0;
              return (
                <div key={item.id} className="section-box">
                  <div className="row-between">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                        {lang === 'th' ? item.nameTh : item.nameEn}{' '}
                        <span className="badge">{t.inStock} {stock}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#756355', marginTop: 2 }}>
                        {lang === 'th' ? item.descTh : item.descEn}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={coins < item.priceCoins}
                      onClick={() => state.buyFood(item.id)}
                      style={{ flexShrink: 0, opacity: coins < item.priceCoins ? 0.5 : 1 }}
                    >
                      <Coins size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {item.priceCoins}
                    </button>
                  </div>
                </div>
              );
            })}

          {shopCat === 'equipment' &&
            FURNITURE_CATALOG.filter((f) => f.isAutoEquipment).map((item) => {
              const ownedCount = ownedFurniture[item.id] ?? 0;
              const placedCount = state.placedFurniture.filter((p) => p.catalogId === item.id).length;
              const canPlace = ownedCount > placedCount;
              const isOwned = ownedCount >= 1;

              return (
                <div key={item.id} className="section-box">
                  <div className="row-between">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                        {lang === 'th' ? item.nameTh : item.nameEn}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#756355', marginTop: 2 }}>
                        {lang === 'th' ? item.descTh : item.descEn}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      {placedCount > 0 && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => state.setShowEquipmentModal(true)}
                        >
                          {lang === 'th' ? 'ตั้งค่า' : 'Manage'}
                        </button>
                      )}
                      {canPlace && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => state.startPlacingFurniture(item.id)}
                        >
                          {t.place}
                        </button>
                      )}
                      {!isOwned ? (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={coins < item.priceCoins}
                          onClick={() => state.buyFurniture(item.id)}
                          style={{ opacity: coins < item.priceCoins ? 0.5 : 1 }}
                        >
                          {item.priceCoins}c
                        </button>
                      ) : (
                        placedCount === 0 && !canPlace && <span className="badge sage">{t.owned}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          {shopCat === 'toys' &&
            TOY_CATALOG.filter((toy) => toy.priceCoins > 0).map((toy) => {
              const isOwned = ownedToys.includes(toy.id);
              return (
                <div key={toy.id} className="section-box">
                  <div className="row-between">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                        {lang === 'th' ? toy.nameTh : toy.nameEn}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#756355' }}>
                        {lang === 'th' ? toy.descTh : toy.descEn}
                      </div>
                    </div>
                    {isOwned ? (
                      <span className="badge sage">{t.owned}</span>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={coins < toy.priceCoins}
                        onClick={() => state.buyToy(toy.id)}
                        style={{ opacity: coins < toy.priceCoins ? 0.5 : 1 }}
                      >
                        {toy.priceCoins}c
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          {(shopCat === 'beds' || shopCat === 'furniture') &&
            FURNITURE_CATALOG.filter((f) =>
              shopCat === 'beds'
                ? f.category === 'bed' && f.priceCoins > 0
                : f.category !== 'bed' && !f.isAutoEquipment && f.priceCoins > 0
            ).map((item) => {
              const ownedCount = ownedFurniture[item.id] ?? 0;
              const placedCount = state.placedFurniture.filter((p) => p.catalogId === item.id).length;
              const canPlace = ownedCount > placedCount;

              return (
                <div key={item.id} className="section-box">
                  <div className="row-between">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                        {lang === 'th' ? item.nameTh : item.nameEn}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#756355' }}>
                        {lang === 'th' ? item.descTh : item.descEn}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {canPlace && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => state.startPlacingFurniture(item.id)}
                        >
                          {t.place}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={coins < item.priceCoins}
                        onClick={() => state.buyFurniture(item.id)}
                        style={{ opacity: coins < item.priceCoins ? 0.5 : 1 }}
                      >
                        {item.priceCoins}c
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

          {shopCat === 'accessories' && (
            <>
              {cat.identity.equippedAccessory !== 'none' && (
                <div className="row-between" style={{ fontSize: 11 }}>
                  <span>{lang === 'th' ? 'กำลังสวมใส่เครื่องประดับอยู่' : 'Accessory equipped'}</span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => state.equipAccessory('none')}
                  >
                    {t.unequip}
                  </button>
                </div>
              )}
              {ACCESSORY_CATALOG.map((acc) => {
                const isOwned = ownedAccessories.includes(acc.id);
                const isEquipped = cat.identity.equippedAccessory === acc.id;
                return (
                  <div key={acc.id} className="section-box">
                    <div className="row-between">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: acc.colorHex,
                              display: 'inline-block'
                            }}
                          />
                          {lang === 'th' ? acc.nameTh : acc.nameEn}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#756355' }}>
                          {lang === 'th' ? acc.descTh : acc.descEn}
                        </div>
                      </div>
                      {isEquipped ? (
                        <span className="badge sage">{t.equipped}</span>
                      ) : isOwned ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => state.equipAccessory(acc.id)}
                        >
                          {t.equip}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={coins < acc.priceCoins}
                          onClick={() => state.buyAccessory(acc.id)}
                          style={{ opacity: coins < acc.priceCoins ? 0.5 : 1 }}
                        >
                          {acc.priceCoins}c
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* TAB 5: 5 PLAYABLE 60s MINIGAMES (ENERGY-GATED: 5 ENERGY PER GAME) */}
      {activeTab === 'minigames' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="section-box" style={{ background: '#fbf4ea', fontSize: 11, gap: 4 }}>
            <div className="row-between">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                <Zap size={13} fill="#d49a42" color="#d49a42" />
                {t.energyLabel} {energyInfo.current}/{energyInfo.max}
              </span>
              <span style={{ color: '#6b5546', fontWeight: 600 }}>
                {energyInfo.isFull
                  ? lang === 'th'
                    ? 'พร้อมเล่นเต็มที่'
                    : 'Full Energy'
                  : lang === 'th'
                    ? `+1 ใน ${formatCountdownMmSs(energyInfo.msUntilNextEnergy)} (${formatClockTime(energyInfo.nextEnergyAtUtc!)})`
                    : `+1 in ${formatCountdownMmSs(energyInfo.msUntilNextEnergy)} (${formatClockTime(energyInfo.nextEnergyAtUtc!)})`}
              </span>
            </div>
            <div style={{ color: '#6b5546' }}>✨ {t.minigameEnergyInfo}</div>
            {!canStartMinigame && (
              <div style={{ color: '#a13a3c', fontWeight: 700 }}>
                {lang === 'th'
                  ? `⚠️ พลังงานไม่พอ (ต้องการ 5 Energy) • เล่นรอบถัดไปได้ใน ${formatCountdownMmSs(energyInfo.msUntilEnoughForMinigame)}`
                  : `⚠️ Not enough Energy (requires 5). Enough Energy in ${formatCountdownMmSs(energyInfo.msUntilEnoughForMinigame)}.`}
              </div>
            )}
          </div>

          {minigameList.map((mg) => (
            <button
              key={mg.id}
              type="button"
              className={`action-card ${!canStartMinigame ? 'locked' : ''}`}
              onClick={() => state.startMinigame(mg.id)}
              style={{ width: '100%' }}
            >
              <div className="action-card-top">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                  {mg.icon}
                  {lang === 'th' ? mg.titleTh : mg.titleEn}
                </span>
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <span className="badge">⚡5</span>
                  <span className="badge warm">15–45c</span>
                </span>
              </div>
              <span className="action-card-sub">
                {lang === 'th' ? mg.descTh : mg.descEn}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
