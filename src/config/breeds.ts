import {
  CatBreed,
  CatSex,
  EyeColorId,
  FurColorId,
  FurPattern
} from '../types/game';

export interface BreedMorphology {
  torsoWidth: number;
  torsoLength: number;
  headWidth: number;
  headRoundness: number;
  muzzleLength: number;
  earSize: number;
  earTuft: boolean;
  legLength: number;
  tailPlushness: number;
  furFluffiness: number;    // 0.25 (sleek shorthair) -> 1.0 (very fluffy Persian/Maine Coon)
  adultScale: number;       // Relative adult body size (0.88 small -> 1.18 Maine Coon)
  adultWeightMinKg: number;
  adultWeightMaxKg: number;
}

export interface BreedDefinition {
  id: CatBreed;
  nameTh: string;
  nameEn: string;
  originTh: string;
  originEn: string;
  descTh: string;
  descEn: string;
  defaultNameTh: string;
  defaultNameEn: string;
  defaultColor: FurColorId;
  defaultPattern: FurPattern;
  defaultEye: EyeColorId;
  allowedColors: FurColorId[];
  allowedPatterns: FurPattern[];
  allowedEyes: EyeColorId[];
  morphology: BreedMorphology;
}

export const FUR_COLOR_PALETTE: Record<
  FurColorId,
  { nameTh: string; nameEn: string; primaryHex: string; secondaryHex: string }
> = {
  white: { nameTh: 'ขาวนวล', nameEn: 'White', primaryHex: '#f6f2eb', secondaryHex: '#dcd3c7' },
  black: { nameTh: 'ดำเงา', nameEn: 'Black', primaryHex: '#2c2b30', secondaryHex: '#4b4950' },
  orange: { nameTh: 'ส้มทอง', nameEn: 'Orange', primaryHex: '#db8a46', secondaryHex: '#944e1d' },
  gray: { nameTh: 'เทาเงิน', nameEn: 'Gray', primaryHex: '#8d9096', secondaryHex: '#595d63' },
  cream: { nameTh: 'ครีมอุ่น', nameEn: 'Cream', primaryHex: '#efe1cc', secondaryHex: '#b99b79' },
  brown: { nameTh: 'น้ำตาลช็อกโกแลต', nameEn: 'Brown', primaryHex: '#7d5a42', secondaryHex: '#463022' },
  blue_gray: { nameTh: 'เทาอมฟ้า', nameEn: 'Blue-Gray', primaryHex: '#738291', secondaryHex: '#4c5966' }
};

export const EYE_COLOR_PALETTE: Record<
  EyeColorId,
  { nameTh: string; nameEn: string; hex: string }
> = {
  blue: { nameTh: 'ฟ้าใส', nameEn: 'Sapphire Blue', hex: '#5da6db' },
  amber: { nameTh: 'อำพัน', nameEn: 'Warm Amber', hex: '#cc8933' },
  green: { nameTh: 'เขียวมรกต', nameEn: 'Emerald Green', hex: '#6ca656' },
  gold: { nameTh: 'ทองประกาย', nameEn: 'Golden', hex: '#d4a63a' },
  hazel: { nameTh: 'เฮเซล', nameEn: 'Hazel', hex: '#948d46' },
  copper: { nameTh: 'ทองแดง', nameEn: 'Deep Copper', hex: '#b86a2f' }
};

export const BREED_DEFINITIONS: BreedDefinition[] = [
  {
    id: 'persian',
    nameTh: 'เปอร์เซีย',
    nameEn: 'Persian',
    originTh: 'ขนยาวหนานุ่ม หน้ากลม',
    originEn: 'Long plush coat, sweet rounded face',
    descTh: 'ขนฟูหนาเป็นพิเศษ ตัวป้อมน่ารัก อุ้งเท้านุ่ม (ทรงหน้าสมดุลหายใจสะดวก)',
    descEn: 'Ultra-fluffy double coat, gently rounded face with healthy open airways.',
    defaultNameTh: 'ปุยฝ้าย',
    defaultNameEn: 'Puff',
    defaultColor: 'white',
    defaultPattern: 'solid',
    defaultEye: 'copper',
    allowedColors: ['white', 'cream', 'orange', 'gray', 'blue_gray', 'black'],
    allowedPatterns: ['solid', 'bicolor', 'tabby', 'calico', 'tortoiseshell', 'colorpoint'],
    allowedEyes: ['copper', 'amber', 'gold', 'blue', 'green'],
    morphology: {
      torsoWidth: 1.12,
      torsoLength: 0.94,
      headWidth: 1.12,
      headRoundness: 1.12,
      muzzleLength: 0.78,
      earSize: 0.82,
      earTuft: true,
      legLength: 0.88,
      tailPlushness: 1.42,
      furFluffiness: 1.0,
      adultScale: 0.96,
      adultWeightMinKg: 3.4,
      adultWeightMaxKg: 5.2
    }
  },
  {
    id: 'british_shorthair',
    nameTh: 'บริติช ชอร์ตแฮร์',
    nameEn: 'British Shorthair',
    originTh: 'แก้มกลมแน่น ขนสั้นกำมะหยี่',
    originEn: 'Chubby cheeks, dense plush coat',
    descTh: 'โครงสร้างแข็งแรง ขนสั้นหนานุ่มดุจตุ๊กตาหมี ดวงตากลมโตสีทองแดง',
    descEn: 'Sturdy teddy-bear frame with dense velvety fur and expressive round eyes.',
    defaultNameTh: 'บลูเบลล์',
    defaultNameEn: 'Bluebell',
    defaultColor: 'blue_gray',
    defaultPattern: 'solid',
    defaultEye: 'copper',
    allowedColors: ['blue_gray', 'gray', 'cream', 'white', 'black', 'orange'],
    allowedPatterns: ['solid', 'bicolor', 'tabby', 'calico', 'colorpoint'],
    allowedEyes: ['copper', 'amber', 'gold', 'green', 'blue'],
    morphology: {
      torsoWidth: 1.14,
      torsoLength: 0.96,
      headWidth: 1.14,
      headRoundness: 1.12,
      muzzleLength: 0.86,
      earSize: 0.86,
      earTuft: false,
      legLength: 0.92,
      tailPlushness: 1.15,
      furFluffiness: 0.65,
      adultScale: 1.04,
      adultWeightMinKg: 4.0,
      adultWeightMaxKg: 6.2
    }
  },
  {
    id: 'scottish_straight',
    nameTh: 'สกอตติช สเตรท',
    nameEn: 'Scottish Straight',
    originTh: 'หูตั้งน่ารัก ใบหน้ากลมหวาน',
    originEn: 'Healthy straight ears, sweet round face',
    descTh: 'สายพันธุ์หูตั้งสุขภาพดี ใบหน้ากลม ตากลมโต ขนหนานุ่มน่ากอด',
    descEn: 'Healthy straight-eared build with owl-like round eyes and plush coat.',
    defaultNameTh: 'โมจิ',
    defaultNameEn: 'Mochi',
    defaultColor: 'cream',
    defaultPattern: 'bicolor',
    defaultEye: 'amber',
    allowedColors: ['cream', 'white', 'gray', 'blue_gray', 'orange', 'black', 'brown'],
    allowedPatterns: ['solid', 'bicolor', 'tabby', 'calico', 'tortoiseshell'],
    allowedEyes: ['amber', 'gold', 'copper', 'green', 'hazel'],
    morphology: {
      torsoWidth: 1.06,
      torsoLength: 0.96,
      headWidth: 1.1,
      headRoundness: 1.1,
      muzzleLength: 0.88,
      earSize: 0.9,
      earTuft: false,
      legLength: 0.94,
      tailPlushness: 1.12,
      furFluffiness: 0.72,
      adultScale: 0.96,
      adultWeightMinKg: 3.2,
      adultWeightMaxKg: 4.8
    }
  },
  {
    id: 'maine_coon',
    nameTh: 'เมนคูน',
    nameEn: 'Maine Coon',
    originTh: 'ยักษ์ใหญ่ใจดี หูมีปอยขน หางพวงฟู',
    originEn: 'Gentle giant, lynx-tufted ears, bushy tail',
    descTh: 'แมวโครงใหญ่สง่างาม แผงคอขนฟู ปลายหูมีปอยขน และหางยาวพวงใหญ่',
    descEn: 'Large majestic frame with tufted ears, fluffy neck ruff, and plumed tail.',
    defaultNameTh: 'ลีโอ',
    defaultNameEn: 'Leo',
    defaultColor: 'brown',
    defaultPattern: 'tabby',
    defaultEye: 'green',
    allowedColors: ['brown', 'orange', 'gray', 'black', 'white', 'cream'],
    allowedPatterns: ['tabby', 'bicolor', 'solid', 'tortoiseshell', 'calico'],
    allowedEyes: ['green', 'gold', 'amber', 'hazel', 'blue'],
    morphology: {
      torsoWidth: 1.08,
      torsoLength: 1.15,
      headWidth: 1.02,
      headRoundness: 0.96,
      muzzleLength: 1.08,
      earSize: 1.24,
      earTuft: true,
      legLength: 1.1,
      tailPlushness: 1.48,
      furFluffiness: 0.94,
      adultScale: 1.16,
      adultWeightMinKg: 5.5,
      adultWeightMaxKg: 8.6
    }
  },
  {
    id: 'ragdoll',
    nameTh: 'แร็กดอลล์',
    nameEn: 'Ragdoll',
    originTh: 'ขนนุ่มดุจไหม ตาสีฟ้าใส แต้มสีอ่อนโยน',
    originEn: 'Silky semi-long fur, vivid blue eyes',
    descTh: 'แมวขนกึ่งยาวสัมผัสนุ่มลื่น แต้มสีคัลเลอร์พอยต์และดวงตาสีฟ้าสดใส',
    descEn: 'Silky plush semi-long coat, gentle colorpoint markings, sapphire blue eyes.',
    defaultNameTh: 'สโนว์',
    defaultNameEn: 'Snow',
    defaultColor: 'cream',
    defaultPattern: 'colorpoint',
    defaultEye: 'blue',
    allowedColors: ['cream', 'white', 'blue_gray', 'brown'],
    allowedPatterns: ['colorpoint', 'bicolor'],
    allowedEyes: ['blue'],
    morphology: {
      torsoWidth: 1.06,
      torsoLength: 1.08,
      headWidth: 1.04,
      headRoundness: 1.04,
      muzzleLength: 0.96,
      earSize: 0.98,
      earTuft: true,
      legLength: 1.02,
      tailPlushness: 1.38,
      furFluffiness: 0.9,
      adultScale: 1.1,
      adultWeightMinKg: 4.5,
      adultWeightMaxKg: 7.2
    }
  },
  {
    id: 'siamese',
    nameTh: 'วิเชียรมาศ (สยาม)',
    nameEn: 'Siamese',
    originTh: 'แมวไทยโบราณ เพรียวสง่า แต้มสีเข้ม 9 จุด',
    originEn: 'Sleek Thai heritage cat, vivid blue eyes',
    descTh: 'รูปร่างเพรียวบาง หูใหญ่ได้รูป ขนสั้นเรียบเนียน แต้มสีเข้มและตาสีฟ้าสด',
    descEn: 'Graceful slender build, tall expressive ears, sleek colorpoint coat and blue eyes.',
    defaultNameTh: 'มะลิ',
    defaultNameEn: 'Mali',
    defaultColor: 'cream',
    defaultPattern: 'colorpoint',
    defaultEye: 'blue',
    allowedColors: ['cream', 'white', 'blue_gray', 'brown'],
    allowedPatterns: ['colorpoint'],
    allowedEyes: ['blue'],
    morphology: {
      torsoWidth: 0.88,
      torsoLength: 1.08,
      headWidth: 0.92,
      headRoundness: 0.92,
      muzzleLength: 1.1,
      earSize: 1.22,
      earTuft: false,
      legLength: 1.08,
      tailPlushness: 0.82,
      furFluffiness: 0.28,
      adultScale: 0.95,
      adultWeightMinKg: 3.0,
      adultWeightMaxKg: 4.6
    }
  },
  {
    id: 'american_shorthair',
    nameTh: 'อเมริกัน ชอร์ตแฮร์',
    nameEn: 'American Shorthair',
    originTh: 'ลายสลิดคลาสสิก โครงสร้างสมส่วน',
    originEn: 'Classic silver tabby, balanced athletic build',
    descTh: 'รูปร่างสมดุลแข็งแรง ขนสั้นแน่น ลายสลิดสวยงามเป็นเอกลักษณ์',
    descEn: 'Well-proportioned athletic frame with crisp short fur and classic tabby markings.',
    defaultNameTh: 'ซิลเวอร์',
    defaultNameEn: 'Silver',
    defaultColor: 'gray',
    defaultPattern: 'tabby',
    defaultEye: 'green',
    allowedColors: ['gray', 'orange', 'brown', 'black', 'white', 'cream', 'blue_gray'],
    allowedPatterns: ['tabby', 'solid', 'bicolor', 'calico', 'tortoiseshell'],
    allowedEyes: ['green', 'gold', 'amber', 'hazel'],
    morphology: {
      torsoWidth: 1.04,
      torsoLength: 1.02,
      headWidth: 1.04,
      headRoundness: 1.04,
      muzzleLength: 0.98,
      earSize: 0.96,
      earTuft: false,
      legLength: 1.0,
      tailPlushness: 1.0,
      furFluffiness: 0.45,
      adultScale: 1.02,
      adultWeightMinKg: 3.8,
      adultWeightMaxKg: 5.8
    }
  },
  {
    id: 'bengal',
    nameTh: 'เบงกอล',
    nameEn: 'Bengal',
    originTh: 'ลายจุดเสือดาว ปราดเปรียวกล้ามเนื้อสวย',
    originEn: 'Spotted wild-inspired coat, lean agile build',
    descTh: 'ลายจุดคล้ายเสือดาว ขนสั้นเงางาม รูปร่างเพรียวและคล่องแคล่วสูง',
    descEn: 'Sleek glittering spotted coat on a lean, athletic, agile feline build.',
    defaultNameTh: 'เสือน้อย',
    defaultNameEn: 'Kiba',
    defaultColor: 'orange',
    defaultPattern: 'spotted',
    defaultEye: 'gold',
    allowedColors: ['orange', 'brown', 'cream', 'gray'],
    allowedPatterns: ['spotted', 'tabby'],
    allowedEyes: ['gold', 'green', 'amber', 'hazel'],
    morphology: {
      torsoWidth: 0.94,
      torsoLength: 1.1,
      headWidth: 0.96,
      headRoundness: 0.94,
      muzzleLength: 1.06,
      earSize: 1.02,
      earTuft: false,
      legLength: 1.08,
      tailPlushness: 0.92,
      furFluffiness: 0.32,
      adultScale: 1.04,
      adultWeightMinKg: 4.0,
      adultWeightMaxKg: 6.0
    }
  },
  {
    id: 'munchkin',
    nameTh: 'มันช์กิ้น',
    nameEn: 'Munchkin',
    originTh: 'ขาสั้นปุ๊กปิ๊ก ขนฟูนุ่ม ตัวกะทัดรัด',
    originEn: 'Petite cozy proportions, soft plush coat',
    descTh: 'ช่วงขาสั้นน่ารักอย่างพอเหมาะ โครงสร้างหลังสมดุล ขนนุ่มฟูน่าเอ็นดู',
    descEn: 'Compact frame with moderately shorter legs (healthy proportion) and soft coat.',
    defaultNameTh: 'เต้าหู้',
    defaultNameEn: 'Tofu',
    defaultColor: 'orange',
    defaultPattern: 'bicolor',
    defaultEye: 'amber',
    allowedColors: ['orange', 'cream', 'white', 'gray', 'black', 'brown', 'blue_gray'],
    allowedPatterns: ['bicolor', 'solid', 'tabby', 'calico', 'tortoiseshell', 'colorpoint'],
    allowedEyes: ['amber', 'green', 'gold', 'blue', 'hazel'],
    morphology: {
      torsoWidth: 1.02,
      torsoLength: 1.02,
      headWidth: 1.04,
      headRoundness: 1.06,
      muzzleLength: 0.94,
      earSize: 1.0,
      earTuft: false,
      legLength: 0.72, // Moderate healthy range avoiding exaggerated deformity
      tailPlushness: 1.16,
      furFluffiness: 0.68,
      adultScale: 0.88,
      adultWeightMinKg: 2.6,
      adultWeightMaxKg: 4.0
    }
  },
  {
    id: 'thai_mixed',
    nameTh: 'แมวบ้านไทย / พันธุ์ผสม',
    nameEn: 'Thai Domestic Shorthair',
    originTh: 'แข็งแรงปรับตัวเก่ง หลากสีสันธรรมชาติ',
    originEn: 'Healthy natural build, rich coat variety',
    descTh: 'แมวไทยขนสั้นรูปร่างสมส่วน แข็งแรง หลากหลายสีขนทั้งสามสี ลายสลิด และขาวมณี',
    descEn: 'Natural, resilient domestic shorthair supporting the full spectrum of feline coats.',
    defaultNameTh: 'ถุงทอง',
    defaultNameEn: 'Thong',
    defaultColor: 'white',
    defaultPattern: 'calico',
    defaultEye: 'gold',
    allowedColors: ['white', 'black', 'orange', 'gray', 'cream', 'brown', 'blue_gray'],
    allowedPatterns: ['solid', 'tabby', 'bicolor', 'tortoiseshell', 'calico', 'colorpoint', 'spotted'],
    allowedEyes: ['gold', 'green', 'amber', 'hazel', 'blue', 'copper'],
    morphology: {
      torsoWidth: 0.98,
      torsoLength: 1.02,
      headWidth: 1.0,
      headRoundness: 1.0,
      muzzleLength: 1.0,
      earSize: 1.06,
      earTuft: false,
      legLength: 1.02,
      tailPlushness: 0.95,
      furFluffiness: 0.42,
      adultScale: 0.98,
      adultWeightMinKg: 3.2,
      adultWeightMaxKg: 5.0
    }
  }
];

export function getBreedDefinition(breed: CatBreed): BreedDefinition {
  return BREED_DEFINITIONS.find((b) => b.id === breed) ?? BREED_DEFINITIONS[0];
}

/**
 * Computes genetically plausible eye colors given breed, coat color, and pattern.
 */
export function getCompatibleEyeColors(
  breed: CatBreed,
  furColor: FurColorId,
  pattern: FurPattern
): EyeColorId[] {
  const def = getBreedDefinition(breed);
  // Colorpoint cats (Siamese, Ragdoll, Himalayan-type) genetically express blue eyes
  if (pattern === 'colorpoint') {
    return ['blue'];
  }
  const eyes = new Set<EyeColorId>(def.allowedEyes);
  if (furColor === 'white') {
    eyes.add('blue');
    eyes.add('gold');
  } else if (breed !== 'ragdoll' && breed !== 'siamese') {
    // Non-white, non-colorpoint cats rarely have pure sapphire blue eyes
    eyes.delete('blue');
  }
  const list = Array.from(eyes);
  return list.length > 0 ? list : ['amber', 'green'];
}

/**
 * Checks realistic feline coat genetics compatibility (e.g., calico & tortoiseshell are
 * linked to XX chromosomes and almost exclusively female).
 */
export function getCompatiblePatterns(breed: CatBreed, sex: CatSex): FurPattern[] {
  const def = getBreedDefinition(breed);
  if (sex === 'male') {
    const filtered = def.allowedPatterns.filter(
      (p) => p !== 'calico' && p !== 'tortoiseshell'
    );
    return filtered.length > 0 ? filtered : ['solid'];
  }
  return def.allowedPatterns;
}

export function resolveCoatHexColors(
  colorId: FurColorId,
  pattern: FurPattern
): { primary: string; secondary: string } {
  const base = FUR_COLOR_PALETTE[colorId];
  if (pattern === 'colorpoint') {
    const pointMap: Record<FurColorId, { primary: string; secondary: string }> = {
      cream: { primary: '#f2e6d5', secondary: '#4d392b' },
      white: { primary: '#f5efe7', secondary: '#6b5c52' },
      blue_gray: { primary: '#ebe8e3', secondary: '#596775' },
      brown: { primary: '#ece0cf', secondary: '#3e2a1e' },
      orange: { primary: '#f5eadb', secondary: '#c77a3c' },
      gray: { primary: '#edeae4', secondary: '#696c72' },
      black: { primary: '#ece4d8', secondary: '#342c28' }
    };
    return pointMap[colorId];
  }
  if (pattern === 'bicolor') {
    return { primary: base.primaryHex, secondary: '#f6f2ec' };
  }
  if (pattern === 'calico') {
    return { primary: '#f6f1e9', secondary: '#cf7334' };
  }
  if (pattern === 'tortoiseshell') {
    return { primary: '#2f2926', secondary: '#c97434' };
  }
  return { primary: base.primaryHex, secondary: base.secondaryHex };
}
