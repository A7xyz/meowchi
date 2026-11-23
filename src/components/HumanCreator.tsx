import { ArrowLeft, Check, Globe, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  HUMAN_BOTTOM_STYLES,
  HUMAN_EYE_COLORS,
  HUMAN_EYE_SHAPES,
  HUMAN_FOOTWEAR_STYLES,
  HUMAN_GENDERS,
  HUMAN_HAIR_COLORS,
  HUMAN_HAIR_STYLES,
  HUMAN_LIP_COLORS,
  HUMAN_MOUTH_SHAPES,
  HUMAN_SKIN_TONES,
  HUMAN_TOP_STYLES,
  OUTFIT_COLOR_SWATCHES
} from '../config/human';
import { useGameStore } from '../store/useGameStore';
import { HumanAppearance } from '../types/game';
import { HumanPreview3D } from './HumanPreview3D';

type CreatorTab = 'body' | 'hair' | 'face' | 'outfit';

export function HumanCreator() {
  const showHumanCreator = useGameStore((s) => s.showHumanCreator);
  const humanCreatorMode = useGameStore((s) => s.humanCreatorMode);
  const hasCreatedHuman = useGameStore((s) => s.hasCreatedHuman);
  const currentAppearance = useGameStore((s) => s.humanAppearance);
  const lang = useGameStore((s) => s.settings.language);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const saveHumanAppearance = useGameStore((s) => s.saveHumanAppearance);
  const closeHumanCreator = useGameStore((s) => s.closeHumanCreator);

  const [tab, setTab] = useState<CreatorTab>('body');
  const [draft, setDraft] = useState<HumanAppearance>(currentAppearance);

  useEffect(() => {
    if (showHumanCreator) {
      setDraft(currentAppearance);
      setTab(humanCreatorMode === 'wardrobe' ? 'outfit' : 'body');
    }
  }, [showHumanCreator, currentAppearance, humanCreatorMode]);

  if (!showHumanCreator) return null;

  const patch = (partial: Partial<HumanAppearance>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const tabs: { id: CreatorTab; th: string; en: string }[] = [
    { id: 'body', th: 'รูปร่าง & ชื่อ', en: 'Body' },
    { id: 'hair', th: 'ทรงผม', en: 'Hair' },
    { id: 'face', th: 'ตา & ปาก', en: 'Face' },
    { id: 'outfit', th: 'เสื้อผ้า', en: 'Outfit' }
  ];

  return (
    <div className="adopt-screen ui-interactive">
      {/* Header */}
      <div className="row-between" style={{ paddingBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasCreatedHuman && (
            <button
              type="button"
              className="drawer-close"
              onClick={closeHumanCreator}
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {humanCreatorMode === 'wardrobe'
                ? lang === 'th'
                  ? 'แต่งตัวและปรับลุคเจ้าของ'
                  : 'Wardrobe & Appearance'
                : lang === 'th'
                  ? 'สร้างตัวละครของคุณ'
                  : 'Create Your Character'}
            </h1>
            <div style={{ fontSize: 11, color: '#756355' }}>
              {lang === 'th'
                ? 'ตัวละคร 3D ของคุณจะเดินดูแลและเล่นกับน้องแมวในบ้านจริง'
                : 'Your 3D character will live in the house & care for your cat'}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="chip-btn"
          onClick={() => updateSettings({ language: lang === 'th' ? 'en' : 'th' })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Globe size={12} />
          {lang === 'th' ? 'EN' : 'ไทย'}
        </button>
      </div>

      {/* Live Full-Body 3D Character Preview (Rotate & Zoom) */}
      <HumanPreview3D appearance={draft} focusFace={tab === 'hair' || tab === 'face'} />
      <div style={{ textAlign: 'center', fontSize: 10, color: '#756355', marginTop: -4 }}>
        {lang === 'th'
          ? 'ลากเพื่อหมุนดู 360° • กดปุ่มแว่นขยายเพื่อซูมใบหน้า/เต็มตัว'
          : 'Drag to rotate 360° • Tap zoom icon for close-up or full body'}
      </div>

      {/* Category Tabs */}
      <div className="chip-group" style={{ justifyContent: 'center' }}>
        {tabs.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip-btn ${tab === c.id ? 'selected' : ''}`}
            onClick={() => setTab(c.id)}
          >
            {lang === 'th' ? c.th : c.en}
          </button>
        ))}
      </div>

      {/* Customization Controls */}
      <div className="adopt-scroll">
        {tab === 'body' && (
          <div className="section-box">
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              {lang === 'th' ? 'ชื่อตัวละครของคุณ' : 'Character Name'}
            </label>
            <input
              className="text-input"
              value={draft.name}
              maxLength={20}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={lang === 'th' ? 'ตั้งชื่อของคุณ...' : 'Enter your name...'}
            />

            <span style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
              {lang === 'th' ? 'เพศ / รูปร่าง' : 'Gender / Body Presentation'}
            </span>
            <div className="chip-group">
              {HUMAN_GENDERS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`chip-btn ${draft.gender === g.id ? 'selected' : ''}`}
                  onClick={() => patch({ gender: g.id })}
                >
                  {lang === 'th' ? g.nameTh : g.nameEn}
                </button>
              ))}
            </div>

            <span style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
              {lang === 'th' ? 'สีผิว' : 'Skin Tone'}
            </span>
            <div className="chip-group">
              {HUMAN_SKIN_TONES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`chip-btn ${draft.skinTone === s.id ? 'selected' : ''}`}
                  onClick={() => patch({ skinTone: s.id })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: s.hex,
                      border: '1px solid rgba(0,0,0,0.22)'
                    }}
                  />
                  {lang === 'th' ? s.nameTh : s.nameEn}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'hair' && (
          <div className="section-box">
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              {lang === 'th' ? 'ทรงผม (10 แบบ)' : 'Hairstyle'}
            </span>
            <div className="chip-group">
              {HUMAN_HAIR_STYLES.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className={`chip-btn ${draft.hairStyle === h.id ? 'selected' : ''}`}
                  onClick={() => patch({ hairStyle: h.id })}
                >
                  {lang === 'th' ? h.nameTh : h.nameEn}
                </button>
              ))}
            </div>

            <span style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
              {lang === 'th' ? 'สีผม' : 'Hair Color'}
            </span>
            <div className="chip-group">
              {HUMAN_HAIR_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip-btn ${draft.hairColor === c.id ? 'selected' : ''}`}
                  onClick={() => patch({ hairColor: c.id })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      background: c.hex,
                      border: '1px solid rgba(0,0,0,0.22)'
                    }}
                  />
                  {lang === 'th' ? c.nameTh : c.nameEn}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'face' && (
          <div className="section-box">
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              {lang === 'th' ? 'รูปทรงดวงตา' : 'Eye Shape'}
            </span>
            <div className="chip-group">
              {HUMAN_EYE_SHAPES.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`chip-btn ${draft.eyeShape === e.id ? 'selected' : ''}`}
                  onClick={() => patch({ eyeShape: e.id })}
                >
                  {lang === 'th' ? e.nameTh : e.nameEn}
                </button>
              ))}
            </div>

            <div className="row-between" style={{ marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {lang === 'th' ? 'ขนาดดวงตา' : 'Eye Size'}
              </span>
              <input
                type="range"
                min={0.85}
                max={1.18}
                step={0.03}
                value={draft.eyeSize}
                onChange={(e) => patch({ eyeSize: parseFloat(e.target.value) })}
                style={{ width: 140 }}
              />
            </div>

            <span style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
              {lang === 'th' ? 'สีดวงตา' : 'Eye Color'}
            </span>
            <div className="chip-group">
              {HUMAN_EYE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip-btn ${draft.eyeColor === c.id ? 'selected' : ''}`}
                  onClick={() => patch({ eyeColor: c.id })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      background: c.hex,
                      border: '1px solid rgba(0,0,0,0.22)'
                    }}
                  />
                  {lang === 'th' ? c.nameTh : c.nameEn}
                </button>
              ))}
            </div>

            <span style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
              {lang === 'th' ? 'รูปทรงปาก' : 'Mouth Shape'}
            </span>
            <div className="chip-group">
              {HUMAN_MOUTH_SHAPES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`chip-btn ${draft.mouthShape === m.id ? 'selected' : ''}`}
                  onClick={() => patch({ mouthShape: m.id })}
                >
                  {lang === 'th' ? m.nameTh : m.nameEn}
                </button>
              ))}
            </div>

            <span style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
              {lang === 'th' ? 'สีริมฝีปาก' : 'Lip Tone'}
            </span>
            <div className="chip-group">
              {HUMAN_LIP_COLORS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`chip-btn ${draft.lipColor === l.hex ? 'selected' : ''}`}
                  onClick={() => patch({ lipColor: l.hex })}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <span
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      background: l.hex,
                      border: '1px solid rgba(0,0,0,0.2)'
                    }}
                  />
                  {lang === 'th' ? l.nameTh : l.nameEn}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'outfit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="section-box">
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {lang === 'th' ? 'เสื้อท่อนบน' : 'Top'}
              </span>
              <div className="chip-group">
                {HUMAN_TOP_STYLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip-btn ${draft.topStyle === item.id ? 'selected' : ''}`}
                    onClick={() => patch({ topStyle: item.id })}
                  >
                    {lang === 'th' ? item.nameTh : item.nameEn}
                  </button>
                ))}
              </div>
              <div className="chip-group" style={{ marginTop: 2 }}>
                {OUTFIT_COLOR_SWATCHES.map((sw) => (
                  <button
                    key={`top_${sw.hex}`}
                    type="button"
                    aria-label={sw.nameEn}
                    onClick={() => patch({ topColor: sw.hex })}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: sw.hex,
                      border:
                        draft.topColor === sw.hex
                          ? '2.5px solid #c87a56'
                          : '1px solid rgba(59,47,39,0.25)',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="section-box">
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {lang === 'th' ? 'กางเกง / กระโปรง (ใส่ได้ทุกเพศ)' : 'Bottoms (All Styles Compatible)'}
              </span>
              <div className="chip-group">
                {HUMAN_BOTTOM_STYLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip-btn ${draft.bottomStyle === item.id ? 'selected' : ''}`}
                    onClick={() => patch({ bottomStyle: item.id })}
                  >
                    {lang === 'th' ? item.nameTh : item.nameEn}
                  </button>
                ))}
              </div>
              <div className="chip-group" style={{ marginTop: 2 }}>
                {OUTFIT_COLOR_SWATCHES.map((sw) => (
                  <button
                    key={`bot_${sw.hex}`}
                    type="button"
                    aria-label={sw.nameEn}
                    onClick={() => patch({ bottomColor: sw.hex })}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: sw.hex,
                      border:
                        draft.bottomColor === sw.hex
                          ? '2.5px solid #c87a56'
                          : '1px solid rgba(59,47,39,0.25)',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="section-box">
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {lang === 'th' ? 'รองเท้า' : 'Footwear'}
              </span>
              <div className="chip-group">
                {HUMAN_FOOTWEAR_STYLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip-btn ${draft.footwearStyle === item.id ? 'selected' : ''}`}
                    onClick={() => patch({ footwearStyle: item.id })}
                  >
                    {lang === 'th' ? item.nameTh : item.nameEn}
                  </button>
                ))}
              </div>
              <div className="chip-group" style={{ marginTop: 2 }}>
                {OUTFIT_COLOR_SWATCHES.map((sw) => (
                  <button
                    key={`shoe_${sw.hex}`}
                    type="button"
                    aria-label={sw.nameEn}
                    onClick={() => patch({ footwearColor: sw.hex })}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: sw.hex,
                      border:
                        draft.footwearColor === sw.hex
                          ? '2.5px solid #c87a56'
                          : '1px solid rgba(59,47,39,0.25)',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div
          className="section-box"
          style={{
            background: '#fbf4ea',
            fontSize: 11,
            color: '#6b5546',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Sparkles size={15} color="#c87a56" style={{ flexShrink: 0 }} />
          <span>
            {lang === 'th'
              ? 'คุณสามารถเปลี่ยนชุดและทรงผมใหม่ได้ตลอดเวลาจากเมนู ดูแล → แต่งตัวเจ้าของ'
              : 'You can change your outfits, hair & appearance anytime from Care → Avatar & Clothes.'}
          </span>
        </div>
      </div>

      {/* Confirm Button */}
      <button
        type="button"
        className="btn-primary"
        style={{
          width: '100%',
          padding: '12px 16px',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6
        }}
        onClick={() => saveHumanAppearance(draft)}
      >
        <Check size={16} />
        {humanCreatorMode === 'wardrobe'
          ? lang === 'th'
            ? 'บันทึกชุดและเข้าสู่บ้าน'
            : 'Save Appearance'
          : lang === 'th'
            ? 'ยืนยันตัวละครและเข้าสู่บ้าน'
            : 'Confirm Character & Enter House'}
      </button>
    </div>
  );
}
