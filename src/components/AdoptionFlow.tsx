import { ArrowLeft, Check, Globe, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  BREED_DEFINITIONS,
  EYE_COLOR_PALETTE,
  FUR_COLOR_PALETTE,
  getBreedDefinition,
  getCompatibleEyeColors,
  getCompatiblePatterns,
  resolveCoatHexColors
} from '../config/breeds';
import { PATTERN_LABELS, UI_TEXT } from '../i18n/translations';
import { useGameStore } from '../store/useGameStore';
import { CatBreed, CatIdentity, CatSex, EyeColorId, FurColorId, FurPattern } from '../types/game';
import { CatPreview3D } from './CatPreview3D';

export function AdoptionFlow() {
  const showAdoptFlow = useGameStore((s) => s.showAdoptFlow);
  const hasAdoptedInitialCat = useGameStore((s) => s.hasAdoptedInitialCat);
  const lang = useGameStore((s) => s.settings.language);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const setShowAdoptFlow = useGameStore((s) => s.setShowAdoptFlow);
  const adoptCustomizedKitten = useGameStore((s) => s.adoptCustomizedKitten);

  const [step, setStep] = useState<'breed' | 'customize'>('breed');
  const [breed, setBreed] = useState<CatBreed>('persian');
  const [name, setName] = useState('ปุยฝ้าย');
  const [sex, setSex] = useState<CatSex>('female');
  const [furColorId, setFurColorId] = useState<FurColorId>('white');
  const [furPattern, setFurPattern] = useState<FurPattern>('solid');
  const [eyeColorId, setEyeColorId] = useState<EyeColorId>('copper');

  const t = UI_TEXT[lang];
  const breedDef = useMemo(() => getBreedDefinition(breed), [breed]);

  const compatiblePatterns = useMemo(() => getCompatiblePatterns(breed, sex), [breed, sex]);
  const safePattern = compatiblePatterns.includes(furPattern)
    ? furPattern
    : compatiblePatterns[0];

  const compatibleEyes = useMemo(
    () => getCompatibleEyeColors(breed, furColorId, safePattern),
    [breed, furColorId, safePattern]
  );
  const safeEye = compatibleEyes.includes(eyeColorId) ? eyeColorId : compatibleEyes[0];

  const previewIdentity: CatIdentity = useMemo(() => {
    const colors = resolveCoatHexColors(furColorId, safePattern);
    return {
      id: 'preview_kitten',
      name,
      sex,
      breed,
      furColorId,
      furColor: colors.primary,
      furSecondary: colors.secondary,
      eyeColorId: safeEye,
      eyeColor: EYE_COLOR_PALETTE[safeEye].hex,
      furPattern: safePattern,
      equippedAccessory: 'none',
      adoptedAt: 0
    };
  }, [breed, furColorId, name, safeEye, safePattern, sex]);

  if (!showAdoptFlow) return null;

  const selectBreed = (b: CatBreed) => {
    const def = getBreedDefinition(b);
    setBreed(b);
    setName(lang === 'th' ? def.defaultNameTh : def.defaultNameEn);
    setFurColorId(def.defaultColor);
    const pats = getCompatiblePatterns(b, sex);
    const nextPat = pats.includes(def.defaultPattern) ? def.defaultPattern : pats[0];
    setFurPattern(nextPat);
    const eyes = getCompatibleEyeColors(b, def.defaultColor, nextPat);
    setEyeColorId(eyes.includes(def.defaultEye) ? def.defaultEye : eyes[0]);
    setStep('customize');
  };

  return (
    <div className="adopt-screen ui-interactive">
      {/* Header */}
      <div className="row-between" style={{ paddingBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {step === 'customize' ? (
            <button
              type="button"
              className="drawer-close"
              onClick={() => setStep('breed')}
              aria-label={t.back}
            >
              <ArrowLeft size={16} />
            </button>
          ) : hasAdoptedInitialCat ? (
            <button
              type="button"
              className="drawer-close"
              onClick={() => setShowAdoptFlow(false)}
              aria-label={t.back}
            >
              <ArrowLeft size={16} />
            </button>
          ) : null}
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {step === 'breed' ? t.chooseBreedTitle : t.customizeTitle}
            </h1>
            <div style={{ fontSize: 11, color: '#756355' }}>
              {step === 'breed'
                ? t.chooseBreedSub
                : lang === 'th'
                  ? `${breedDef.nameTh} • ${breedDef.originTh}`
                  : `${breedDef.nameEn} • ${breedDef.originEn}`}
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

      {step === 'breed' ? (
        /* STEP 1: 10 BREEDS SELECTION */
        <div className="adopt-scroll">
          <div className="action-grid">
            {BREED_DEFINITIONS.map((b) => {
              const swatch = resolveCoatHexColors(b.defaultColor, b.defaultPattern);
              const fluffLabel =
                b.morphology.furFluffiness >= 0.85
                  ? lang === 'th'
                    ? 'ขนยาวฟูมาก'
                    : 'Long Fluffy'
                  : b.morphology.furFluffiness >= 0.6
                    ? lang === 'th'
                      ? 'ขนหนานุ่ม'
                      : 'Plush Coat'
                    : lang === 'th'
                      ? 'ขนสั้นเงา'
                      : 'Sleek Coat';

              return (
                <button
                  key={b.id}
                  type="button"
                  className={`action-card ${breed === b.id ? 'active' : ''}`}
                  onClick={() => selectBreed(b.id)}
                  style={{ gap: 5 }}
                >
                  <div className="action-card-top">
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${swatch.primary} 55%, ${swatch.secondary} 100%)`,
                        border: '2px solid rgba(59,47,39,0.16)'
                      }}
                    />
                    <span className="badge warm">{fluffLabel}</span>
                  </div>
                  <span className="action-card-title" style={{ fontSize: 13 }}>
                    {lang === 'th' ? b.nameTh : b.nameEn}
                  </span>
                  <span className="action-card-sub">
                    {lang === 'th' ? b.descTh : b.descEn}
                  </span>
                  <span style={{ fontSize: 10, color: '#8b725c', fontWeight: 600 }}>
                    {lang === 'th' ? 'โตเต็มวัย' : 'Adult'}: {b.morphology.adultWeightMinKg}–
                    {b.morphology.adultWeightMaxKg} kg
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* STEP 2: REAL-TIME 3D CUSTOMIZATION */
        <div className="adopt-scroll">
          <CatPreview3D identity={previewIdentity} />
          <div style={{ textAlign: 'center', fontSize: 10.5, color: '#756355', marginTop: 4 }}>
            {t.rotateHint}
          </div>

          <div className="section-box">
            <label style={{ fontSize: 12, fontWeight: 700 }}>{t.nameLabel}</label>
            <input
              className="text-input"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === 'th' ? 'ตั้งชื่อลูกแมว...' : 'Enter kitten name...'}
            />

            <div className="row-between">
              <span style={{ fontSize: 12, fontWeight: 700 }}>{t.sexLabel}</span>
              <div className="chip-group">
                <button
                  type="button"
                  className={`chip-btn ${sex === 'female' ? 'selected' : ''}`}
                  onClick={() => setSex('female')}
                >
                  {t.sexFemale}
                </button>
                <button
                  type="button"
                  className={`chip-btn ${sex === 'male' ? 'selected' : ''}`}
                  onClick={() => setSex('male')}
                >
                  {t.sexMale}
                </button>
              </div>
            </div>
          </div>

          <div className="section-box">
            <span style={{ fontSize: 12, fontWeight: 700 }}>{t.colorLabel}</span>
            <div className="chip-group">
              {breedDef.allowedColors.map((cid) => {
                const pal = FUR_COLOR_PALETTE[cid];
                return (
                  <button
                    key={cid}
                    type="button"
                    className={`chip-btn ${furColorId === cid ? 'selected' : ''}`}
                    onClick={() => setFurColorId(cid)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <span
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: '50%',
                        background: pal.primaryHex,
                        border: '1px solid rgba(0,0,0,0.22)'
                      }}
                    />
                    {lang === 'th' ? pal.nameTh : pal.nameEn}
                  </button>
                );
              })}
            </div>

            <span style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{t.patternLabel}</span>
            <div className="chip-group">
              {compatiblePatterns.map((pat) => (
                <button
                  key={pat}
                  type="button"
                  className={`chip-btn ${safePattern === pat ? 'selected' : ''}`}
                  onClick={() => setFurPattern(pat)}
                >
                  {PATTERN_LABELS[pat][lang]}
                </button>
              ))}
            </div>
            {sex === 'male' &&
              (breedDef.allowedPatterns.includes('calico') ||
                breedDef.allowedPatterns.includes('tortoiseshell')) && (
                <span style={{ fontSize: 10, color: '#8b725c' }}>{t.calicoMaleNote}</span>
              )}

            <span style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{t.eyeLabel}</span>
            <div className="chip-group">
              {compatibleEyes.map((eid) => {
                const eye = EYE_COLOR_PALETTE[eid];
                return (
                  <button
                    key={eid}
                    type="button"
                    className={`chip-btn ${safeEye === eid ? 'selected' : ''}`}
                    onClick={() => setEyeColorId(eid)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <span
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: '50%',
                        background: eye.hex,
                        border: '1px solid rgba(0,0,0,0.2)'
                      }}
                    />
                    {lang === 'th' ? eye.nameTh : eye.nameEn}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="section-box"
            style={{ background: '#fbf4ea', fontSize: 11, color: '#6b5546', flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Sparkles size={16} color="#c87a56" style={{ flexShrink: 0 }} />
            <span>
              {lang === 'th'
                ? 'เมื่อกดรับเลี้ยง ระบบจะสุ่มบุคลิกภาพ 8 ด้านเฉพาะตัว และนิสัยจะค่อยๆ พัฒนาตามวิธีที่คุณดูแล'
                : 'Upon adoption, a unique 8-trait personality will be randomized and evolve naturally with your care.'}
            </span>
          </div>

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
            onClick={() =>
              adoptCustomizedKitten({
                name,
                sex,
                breed,
                furColorId,
                furPattern: safePattern,
                eyeColorId: safeEye
              })
            }
          >
            <Check size={16} />
            {t.adoptThisKitten}
          </button>
        </div>
      )}
    </div>
  );
}
