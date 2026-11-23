import {
  BodyCondition,
  CatBehaviorState,
  CatEmotion,
  FurPattern,
  Language,
  LifeStage,
  PersonalityTraits
} from '../types/game';

export const STAGE_LABELS: Record<LifeStage, { th: string; en: string; descTh: string; descEn: string }> = {
  newborn: {
    th: 'แรกเกิด',
    en: 'Newborn',
    descTh: '0–2 สัปดาห์ • ตาปิด นอนหลับเป็นส่วนใหญ่ ต้องป้อนนมแพะอุ่น',
    descEn: '0–2 wks • Eyes closed, mostly sleeping, needs kitten formula'
  },
  baby_kitten: {
    th: 'ลูกแมวตัวน้อย',
    en: 'Baby Kitten',
    descTh: '3–8 สัปดาห์ • เริ่มลืมตา หัดเดินเตาะแตะ และเริ่มสนใจของเล่น',
    descEn: '3–8 wks • Eyes open, learning to walk and explore toys'
  },
  young_kitten: {
    th: 'แมวรุ่นเยาว์',
    en: 'Young Kitten',
    descTh: '2–6 เดือน • วิ่งเล่น กระโดดคล่องแคล่ว นิสัยเริ่มชัดเจน',
    descEn: '2–6 mos • Running, jumping, energetic play and clear personality'
  },
  adolescent: {
    th: 'แมววัยรุ่น',
    en: 'Adolescent Cat',
    descTh: '6–12 เดือน • เริ่มเป็นตัวของตัวเอง สำรวจเก่ง กระโดดได้สูงขึ้น',
    descEn: '6–12 mos • Independent spirit, agile movement and exploration'
  },
  adult: {
    th: 'แมวโตเต็มวัย',
    en: 'Adult Cat',
    descTh: '12+ เดือน • รูปร่างสง่างาม นิสัยมั่นคง แสดงความรักได้ลึกซึ้ง',
    descEn: '12+ mos • Fully grown, stable personality and deep social bond'
  }
};

export const PATTERN_LABELS: Record<FurPattern, { th: string; en: string }> = {
  solid: { th: 'สีล้วน', en: 'Solid' },
  tabby: { th: 'ลายสลิด', en: 'Tabby' },
  bicolor: { th: 'สองสี (ไบคัลเลอร์)', en: 'Bicolor' },
  tortoiseshell: { th: 'ลายกระดองเต่า', en: 'Tortoiseshell' },
  calico: { th: 'สามสี (คาลิโก)', en: 'Calico' },
  colorpoint: { th: 'แต้มสี (คัลเลอร์พอยต์)', en: 'Colorpoint' },
  spotted: { th: 'ลายจุด', en: 'Spotted' }
};

export const EMOTION_LABELS: Record<CatEmotion, { th: string; en: string; icon: string }> = {
  happy_relaxed: { th: 'ผ่อนคลายสบายใจ', en: 'Happy & Relaxed', icon: '🌿' },
  affectionate: { th: 'ออดอ้อนรักใคร่', en: 'Affectionate', icon: '🧡' },
  fearful: { th: 'ตื่นกลัวระแวดระวัง', en: 'Fearful / Cautious', icon: '💨' },
  defensive_angry: { th: 'เครียด / ป้องกันตัว', en: 'Defensive / Warning', icon: '⚡' },
  playful: { th: 'คึกคักอยากเล่น', en: 'Playful', icon: '✨' },
  sleepy: { th: 'ง่วงนอน', en: 'Sleepy', icon: '🌙' },
  curious: { th: 'อยากรู้อยากเห็น', en: 'Curious', icon: '👀' }
};

export const TRAIT_LABELS: Record<keyof PersonalityTraits, { th: string; en: string }> = {
  affection: { th: 'ความขี้อ้อน', en: 'Affection' },
  trust: { th: 'ความไว้ใจ', en: 'Trust' },
  playfulness: { th: 'ความขี้เล่น', en: 'Playfulness' },
  curiosity: { th: 'ความอยากรู้อยากเห็น', en: 'Curiosity' },
  sociability: { th: 'ความเป็นมิตร', en: 'Sociability' },
  independence: { th: 'ความรักอิสระ', en: 'Independence' },
  fearfulness: { th: 'ความขี้กลัว', en: 'Fearfulness' },
  aggression: { th: 'ความระวังตัว', en: 'Defensiveness' }
};

export const BODY_CONDITION_LABELS: Record<
  BodyCondition,
  { th: string; en: string; tipTh: string; tipEn: string }
> = {
  underweight: {
    th: 'ผอมเกินไป',
    en: 'Underweight',
    tipTh: 'น้องแมวดูผอมลงเล็กน้อย ลองจัดมื้ออาหารที่มีโภชนาการสม่ำเสมอขึ้นนะ',
    tipEn: 'Your cat looks a little thin—try offering regular nutritious meals.'
  },
  lean: {
    th: 'เพรียวกระชับ',
    en: 'Lean & Agile',
    tipTh: 'รูปร่างเพรียวคล่องแคล่ว สุขภาพดี',
    tipEn: 'Slim, athletic, and energetic build.'
  },
  healthy: {
    th: 'สมส่วนสุขภาพดี',
    en: 'Healthy Weight',
    tipTh: 'รูปร่างสมส่วนตามสายพันธุ์ ขนสวยสุขภาพแข็งแรง',
    tipEn: 'Balanced, breed-healthy body proportions.'
  },
  overweight: {
    th: 'อวบเกินเกณฑ์',
    en: 'Overweight',
    tipTh: 'พุงน้อยๆ เริ่มกลมขึ้นแล้ว ลองชวนเล่นออกกำลังกายและลดขนมแมวเลียลงเล็กน้อยนะ',
    tipEn: 'A little chubby—more playful exercise and fewer treats will help!'
  }
};

export const BEHAVIOR_LABELS: Record<CatBehaviorState, { th: string; en: string }> = {
  idle: { th: 'พักผ่อนสบายๆ', en: 'Relaxing' },
  walk: { th: 'กำลังเดินเล่น', en: 'Walking' },
  run: { th: 'กำลังวิ่งเล่น', en: 'Running' },
  zoomies: { th: 'คึกคักวิ่งซิ่งทั่วห้อง!', en: 'Zoomies!' },
  roll_play: { th: 'กลิ้งหงายท้องเล่นสนุก', en: 'Playful Rolling' },
  box_ambush: { th: 'ซุ่มอยู่ในกล่องเตรียมกระโจน', en: 'Box Ambush!' },
  chase_imaginary: { th: 'วิ่งไล่เงาจินตนาการ', en: 'Chasing Greebles' },
  sit: { th: 'นั่งมองรอบห้อง', en: 'Sitting' },
  sleep: { th: 'กำลังหลับปุ๋ย', en: 'Sleeping' },
  stretch: { th: 'กำลังบิดขี้เกียจ', en: 'Stretching' },
  groom: { th: 'กำลังเลียขน', en: 'Grooming' },
  eat: { th: 'กำลังหม่ำๆ', en: 'Eating' },
  drink: { th: 'กำลังดื่มน้ำ', en: 'Drinking' },
  use_litter: { th: 'กำลังเข้าห้องน้ำแมว', en: 'Using Litter Box' },
  explore: { th: 'กำลังดมสำรวจห้อง', en: 'Sniffing & Exploring' },
  play: { th: 'กำลังเล่นสนุก', en: 'Playing' },
  approach_player: { th: 'เดินเข้ามาหาคุณ', en: 'Approaching You' },
  hide: { th: 'หลบอยู่ในมุมปลอดภัย', en: 'Hiding Safely' },
  observe: { th: 'เหม่อมองนอกหน้าต่าง', en: 'Observing' },
  jump_prep: { th: 'ย่อตัวส่ายก้นเตรียมกระโดด', en: 'Preparing to Jump' },
  jump: { th: 'กำลังกระโดด', en: 'Jumping' },
  jump_land: { th: 'ลงพื้นอย่างนุ่มนวล', en: 'Landing Smoothly' },
  react_to_sound: { th: 'หูผึ่งฟังเสียง', en: 'Perking Ears' },
  knead: { th: 'กำลังนวดเบาะอย่างสบายใจ', en: 'Kneading Softly' },
  head_bunt: { th: 'เอาหัวมาถูอ้อน', en: 'Head Bunting' },
  pounce_crouch: { th: 'หมอบส่ายก้นเตรียมตะครุบ!', en: 'Wiggling to Pounce!' },
  hiss_defend: { th: 'หูลู่ขู่ฟ่อ (ต้องการพื้นที่)', en: 'Hissing (Needs Space)' },
  bite_defend: { th: 'งับเตือนป้องกันตัว!', en: 'Defensive Nip!' },
  yawn: { th: 'กำลังหาวกว้างๆ', en: 'Yawning' }
};

export const UI_TEXT = {
  th: {
    appTitle: 'Meowchi — น้องแมวตัวน้อย',
    navCare: 'ดูแล',
    navFood: 'อาหาร',
    navPlay: 'เล่น',
    navShop: 'ร้านค้า',
    navMinigames: 'มินิเกม',
    chooseBreedTitle: 'เลือกสายพันธุ์ลูกแมว',
    chooseBreedSub: 'สายพันธุ์กำหนดรูปร่าง ขน และขนาดตัว ส่วนนิสัยจะสุ่มเฉพาะตัวไม่ซ้ำใคร',
    customizeTitle: 'ปรับแต่งลูกแมวของคุณ',
    adoptThisKitten: 'รับเลี้ยงลูกแมวตัวนี้',
    back: 'ย้อนกลับ',
    next: 'ถัดไป',
    nameLabel: 'ชื่อลูกแมว (รองรับภาษาไทย/อังกฤษ)',
    sexLabel: 'เพศ',
    colorLabel: 'สีขน',
    patternLabel: 'ลวดลายขน',
    eyeLabel: 'สีดวงตา (ตามพันธุกรรม)',
    rotateHint: 'ลากบนตัวลูกแมวเพื่อหมุนดู 360°',
    calicoMaleNote: 'หมายเหตุพันธุกรรม: ลายสามสีและกระดองเต่าพบได้เฉพาะเพศเมียเป็นหลัก',
    levelShort: 'Lv.',
    bond: 'สายสัมพันธ์',
    energyLabel: 'Energy',
    followCat: 'ตามน้องแมว',
    decorate: 'ตกแต่งห้อง',
    smartDevices: 'อุปกรณ์อัตโนมัติ',
    dailyTasks: 'ภารกิจ',
    photoAlbum: 'อัลบั้มภาพ',
    achievements: 'ความสำเร็จ',
    settings: 'ตั้งค่า',
    photoMode: 'โหมดถ่ายภาพ',
    takePhoto: 'ถ่ายภาพ',
    exitPhoto: 'ออก',
    refillWater: 'เติมน้ำสะอาด (ฟรี)',
    petCat: 'ลูบหัวเบาๆ',
    brushCat: 'แปรงขนฟู',
    tuckSleep: 'ให้พักผ่อน',
    respectSpace: 'ให้พื้นที่สงบ',
    cleanLitter: 'ตักทรายแมว',
    cleanMess: 'จัดห้อง/เก็บแก้ว',
    catProfile: 'ข้อมูล & นิสัยแมว',
    tapCatHint: 'สังเกตอารมณ์จากหู หาง และเสียงร้อง • แตะตัวน้องแมวเพื่อลูบด้วยมือ',
    featherHint: 'ลากนิ้วไปมาบนจอเพื่อแกว่งไม้ตกแมวด้วยมือ',
    ballHint: 'แตะหรือปัดบนพื้นห้องเพื่อกลิ้งลูกบอล',
    decorateHint: 'แตะเฟอร์นิเจอร์เพื่อเลือก ย้ายตำแหน่ง หรือหมุน',
    stopToy: 'เก็บของเล่น',
    buy: 'ซื้อ',
    owned: 'มีแล้ว',
    inStock: 'คงเหลือ',
    outOfStock: 'หมด! ไปซื้อที่ร้าน',
    offerFood: 'เสิร์ฟให้กิน',
    equip: 'สวมใส่',
    equipped: 'ใส่อยู่',
    unequip: 'ถอดออก',
    place: 'วางในห้อง',
    rotate: 'หมุน 45°',
    remove: 'เก็บเข้าคลัง',
    doneDecorate: 'บันทึกการจัดห้อง',
    claim: 'รับรางวัล',
    claimed: 'รับแล้ว',
    adoptNew: 'รับเลี้ยงลูกแมวใหม่',
    rename: 'เปลี่ยนชื่อ',
    saveNow: 'บันทึกเกม',
    resetSave: 'เริ่มเกมใหม่',
    language: 'ภาษา',
    graphics: 'คุณภาพกราฟิก',
    sound: 'เสียงร้องและเสียงประกอบ',
    reduceBiteVisuals: 'ใช้แฟลชเตือนสีแดงแทนเอฟเฟกต์รอยงับ',
    naturalGrowthNote: 'น้องแมวเติบโตตามเวลาจริงอย่างเป็นธรรมชาติ (1 วันจริง = 1 วันในเกม)',
    placeholderNotice:
      'หมายเหตุสินทรัพย์: โมเดล 3D และเสียงสำรองเป็นระบบ Procedural/Web Audio (ไม่ใช่เสียงแมวจริงจนกว่าจะวางไฟล์เสียงแมวจริงที่มีลิขสิทธิ์ใน public/audio/cat/ ดู ASSETS_MANIFEST.md)',
    noPhotos: 'ยังไม่มีภาพถ่าย ลองกดปุ่มกล้องด้านบนเพื่อเก็บความทรงจำ!',
    bondUnlocksTitle: 'พฤติกรรมจากสายสัมพันธ์',
    sexFemale: 'เพศเมีย',
    sexMale: 'เพศผู้',
    weight: 'น้ำหนัก',
    breed: 'สายพันธุ์',
    personality: 'บุคลิกภาพ (พัฒนาตามการเลี้ยงดู)',
    stage: 'ช่วงวัย',
    bodyCondition: 'สภาพรูปร่าง',
    roomStatus: 'สภาพบ้าน',
    litterClean: 'กระบะทราย',
    roomTidy: 'ความเรียบร้อย',
    freeWaterNote: 'น้ำสะอาดเติมได้ฟรีตลอดเวลา (การดูแลทั่วไปไม่ใช้ Energy ของผู้เล่น)',
    noHungerBarNote: 'ไม่มีแถบความหิว — สังเกตเมื่อน้องเดินไปดมชามหรือส่งเสียงเรียก',
    playMinigame: 'เริ่มเล่น',
    minigameEnergyInfo: 'มินิเกมรอบละ 60 วินาที • ใช้ 5 Energy • รางวัล 15–45 เหรียญตามคะแนน'
  },
  en: {
    appTitle: 'Meowchi — My Little Cat',
    navCare: 'Care',
    navFood: 'Food',
    navPlay: 'Play',
    navShop: 'Shop',
    navMinigames: 'Minigames',
    chooseBreedTitle: 'Choose Your Kitten Breed',
    chooseBreedSub: 'Breed shapes anatomy, coat fluffiness & size. Personality is uniquely randomized!',
    customizeTitle: 'Customize Your Kitten',
    adoptThisKitten: 'Adopt This Kitten',
    back: 'Back',
    next: 'Next',
    nameLabel: 'Kitten Name (Thai & English)',
    sexLabel: 'Sex',
    colorLabel: 'Fur Color',
    patternLabel: 'Fur Pattern',
    eyeLabel: 'Eye Color (Genetics)',
    rotateHint: 'Drag kitten to rotate 360° preview',
    calicoMaleNote: 'Genetics note: Calico & tortoiseshell coats are linked to XX (female) chromosomes.',
    levelShort: 'Lv.',
    bond: 'Bond',
    energyLabel: 'Energy',
    followCat: 'Follow Cat',
    decorate: 'Decorate',
    smartDevices: 'Smart Gear',
    dailyTasks: 'Tasks',
    photoAlbum: 'Photo Album',
    achievements: 'Achievements',
    settings: 'Settings',
    photoMode: 'Photo Mode',
    takePhoto: 'Snap',
    exitPhoto: 'Exit',
    refillWater: 'Fresh Water (Free)',
    petCat: 'Pet Gently',
    brushCat: 'Brush Fluffy Fur',
    tuckSleep: 'Let Rest',
    respectSpace: 'Give Personal Space',
    cleanLitter: 'Clean Litter',
    cleanMess: 'Tidy Room / Mug',
    catProfile: 'Cat Profile & Traits',
    tapCatHint: 'Read ears, tail & vocal cues • Tap cat gently to pet by hand',
    featherHint: 'Drag across screen to wave the feather wand by hand',
    ballHint: 'Tap or swipe on the floor to roll the ball',
    decorateHint: 'Tap furniture to move or rotate • Green = valid',
    stopToy: 'Put Toy Away',
    buy: 'Buy',
    owned: 'Owned',
    inStock: 'Stock',
    outOfStock: 'Empty — Buy in Shop',
    offerFood: 'Offer Meal',
    equip: 'Wear',
    equipped: 'Wearing',
    unequip: 'Remove',
    place: 'Place',
    rotate: 'Rotate 45°',
    remove: 'Store',
    doneDecorate: 'Save Layout',
    claim: 'Claim',
    claimed: 'Claimed',
    adoptNew: 'Adopt New Kitten',
    rename: 'Rename',
    saveNow: 'Save Now',
    resetSave: 'Reset Save',
    language: 'Language',
    graphics: 'Graphics Quality',
    sound: 'Cat Audio & SFX',
    reduceBiteVisuals: 'Replace bite edge effect with red warning flash',
    naturalGrowthNote: 'Your cat grows naturally in real time (1 real day = 1 cat day).',
    placeholderNotice:
      'Asset transparency: 3D rig & fallback synthesis are procedural Web Audio placeholders (not real cat recordings until licensed .ogg files are placed in public/audio/cat/; see ASSETS_MANIFEST.md).',
    noPhotos: 'No photos yet. Tap the camera button to capture a memory!',
    bondUnlocksTitle: 'Bond Behavioral Milestones',
    sexFemale: 'Female',
    sexMale: 'Male',
    weight: 'Weight',
    breed: 'Breed',
    personality: 'Personality (Evolves with Care)',
    stage: 'Life Stage',
    bodyCondition: 'Body Condition',
    roomStatus: 'Home Status',
    litterClean: 'Litter Box',
    roomTidy: 'Room Tidiness',
    freeWaterNote: 'Fresh drinking water is free. Normal cat care never consumes player Energy.',
    noHungerBarNote: 'No hunger bars — observe natural bowl visits, sniffing & vocal cues.',
    playMinigame: 'Play Now',
    minigameEnergyInfo: '60s rounds • 5 Energy per game • Earn 15–45 Coins by performance'
  }
} as const;

export function formatAge(ageDays: number, lang: Language): string {
  const days = Math.max(0, Math.floor(ageDays));
  if (days < 14) {
    return lang === 'th' ? `${days} วัน` : `${days}d`;
  }
  if (days < 60) {
    const weeks = Math.floor(days / 7);
    const remDays = days % 7;
    if (lang === 'th') {
      return remDays > 0 ? `${weeks} สัปดาห์ ${remDays} วัน` : `${weeks} สัปดาห์`;
    }
    return remDays > 0 ? `${weeks}w ${remDays}d` : `${weeks} wks`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return lang === 'th' ? `${months} เดือน` : `${months} mos`;
  }
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (lang === 'th') {
    return remMonths > 0 ? `${years} ปี ${remMonths} เดือน` : `${years} ปี`;
  }
  return remMonths > 0 ? `${years}y ${remMonths}m` : `${years} yr`;
}
