import {
  Baby,
  ClipboardList,
  Coins,
  Compass,
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
  UserCircle2,
  Utensils,
  X
} from 'lucide-react';
import { useState } from 'react';
import {
  ACCESSORY_CATALOG,
  FOOD_CATALOG,
  FURNITURE_CATALOG,
  TOY_CATALOG
} from '../config/catalog';
import { UI_TEXT } from '../i18n/translations';
import { computeGrowthMetrics, isFoodSafeForAge } from '../simulation/growth';
import { useGameStore } from '../store/useGameStore';

interface ActionDrawerProps {
  onFocusCat: () => void;
}

type ShopCategory = 'food' | 'toys' | 'beds' | 'furniture' | 'accessories';

export function ActionDrawer({ onFocusCat }: ActionDrawerProps) {
  const state = useGameStore();
  const {
    activeTab,
    drawerOpen,
    cat,
    room,
    settings,
    coins,
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

  const metrics = computeGrowthMetrics(cat.identity.breed, cat.ageDays);
  const claimableCount = dailyTasks.filter((d) => !d.claimed && d.progress >= d.target).length;

  const titles = {
    care: t.navCare,
    food: t.navFood,
    play: t.navPlay,
    shop: t.navShop,
    minigames: t.navMinigames
  };

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

      {/* TAB 1: CARE & HOME TOOLS */}
      {activeTab === 'care' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="action-grid">
            <button type="button" className="action-card" onClick={() => state.petCat()}>
              <div className="action-card-top">
                <Heart size={16} color="#cf6f72" />
                <span className="badge warm">+Trust</span>
              </div>
              <span className="action-card-title">{t.petCat}</span>
              <span className="action-card-sub">
                {lang === 'th' ? 'ลูบเบาๆ อย่ารบกวนตอนหลับ' : 'Gentle petting (respect sleep)'}
              </span>
            </button>

            <button type="button" className="action-card" onClick={() => state.respectCatSpace()}>
              <div className="action-card-top">
                <ShieldCheck size={16} color="#6d9575" />
                <span className="badge sage">Calm</span>
              </div>
              <span className="action-card-title">{t.respectSpace}</span>
              <span className="action-card-sub">
                {lang === 'th' ? 'ช่วยปลอบเมื่อแมวกลัวหรือขู่' : 'Calms fear & overstimulation'}
              </span>
            </button>

            <button type="button" className="action-card" onClick={() => state.brushCat()}>
              <div className="action-card-top">
                <Sparkles size={16} color="#d49a42" />
                <span className="badge sage">Fluffy</span>
              </div>
              <span className="action-card-title">{t.brushCat}</span>
            </button>

            <button type="button" className="action-card" onClick={() => state.tuckCatToSleep()}>
              <div className="action-card-top">
                <Moon size={16} color="#6b7ba4" />
                <span className="badge">Rest</span>
              </div>
              <span className="action-card-title">{t.tuckSleep}</span>
            </button>

            <button type="button" className="action-card" onClick={() => state.cleanLitterBox()}>
              <div className="action-card-top">
                <Trash2 size={16} color="#6d9575" />
                <span className={`badge ${room.litterCleanliness < 45 ? 'warn' : 'sage'}`}>
                  {Math.round(room.litterCleanliness)}%
                </span>
              </div>
              <span className="action-card-title">{t.cleanLitter}</span>
            </button>

            <button type="button" className="action-card" onClick={() => state.cleanLivingArea()}>
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

          {/* Quick Home / Profile / Decorate / Album / Tasks Row */}
          <div className="chip-group">
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

      {/* TAB 4: SHOP (FOOD, TOYS, BEDS, FURNITURE, ACCESSORIES) */}
      {activeTab === 'shop' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="chip-group">
            {(
              [
                { id: 'food', th: 'อาหาร', en: 'Food' },
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
              shopCat === 'beds' ? f.category === 'bed' && f.priceCoins > 0 : f.category !== 'bed' && f.priceCoins > 0
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

      {/* TAB 5: PLAYABLE MINIGAMES (FREE COIN EARNING!) */}
      {activeTab === 'minigames' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: '#6b5546' }}>✨ {t.earnCoinsFree}</div>

          <button
            type="button"
            className="action-card"
            onClick={() => state.openMinigame('fishing')}
            style={{ width: '100%' }}
          >
            <div className="action-card-top">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                <Fish size={17} color="#4e8eb2" />
                {lang === 'th' ? 'ตกปลาให้น้องแมว (Fishing)' : 'Cozy Pond Fishing'}
              </span>
              <span className="badge warm">+20–75c</span>
            </div>
            <span className="action-card-sub">
              {lang === 'th'
                ? 'แตะและลากเบ็ด กะจังหวะดึงเมื่อปลางับเหยื่อ จับปลาทู แซลมอน และปลาคาร์ปทอง!'
                : 'Drag your bobber and hook swimming fish on bite timing for big Coin rewards!'}
            </span>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => state.openMinigame('matching')}
            style={{ width: '100%' }}
          >
            <div className="action-card-top">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                <Grid2x2 size={17} color="#c87a56" />
                {lang === 'th' ? 'จับคู่ของเล่นแมว (Matching Puzzle)' : 'Cat Item Matching Puzzle'}
              </span>
              <span className="badge warm">+25–65c</span>
            </div>
            <span className="action-card-sub">
              {lang === 'th'
                ? 'เปิดการ์ดจับคู่ของใช้น้องแมว 3 ระดับความยาก พร้อมโบนัสคอมโบและเวลา!'
                : 'Match cat-themed tiles across increasing difficulty levels with combo bonuses!'}
            </span>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => state.openMinigame('clean_room')}
            style={{ width: '100%' }}
          >
            <div className="action-card-top">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13 }}>
                <Sparkles size={17} color="#6d9575" />
                {lang === 'th' ? 'จัดเก็บห้องนั่งเล่น (Clean the Room)' : 'Clean the Room (Free)'}
              </span>
              <span className="badge sage">+20–40c</span>
            </div>
            <span className="action-card-sub">
              {lang === 'th'
                ? 'แตะและลากของเล่น/ชาม/เบาะกลับเข้าที่ให้เรียบร้อย เล่นซ้ำได้ฟรีไม่จำกัด!'
                : 'Tap & drag scattered toys and cushions back into place. Free unlimited Coins!'}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}
