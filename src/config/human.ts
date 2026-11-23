import {
  HumanAppearance,
  HumanBottomStyle,
  HumanEyeColorId,
  HumanEyeShape,
  HumanFootwearStyle,
  HumanGender,
  HumanHairColorId,
  HumanHairStyle,
  HumanMouthShape,
  HumanSkinToneId,
  HumanTopStyle
} from '../types/game';

export interface OptionMeta<T extends string> {
  id: T;
  nameTh: string;
  nameEn: string;
  hex?: string;
}

export const HUMAN_GENDERS: OptionMeta<HumanGender>[] = [
  { id: 'female', nameTh: 'หญิง', nameEn: 'Female' },
  { id: 'male', nameTh: 'ชาย', nameEn: 'Male' }
];

export const HUMAN_SKIN_TONES: OptionMeta<HumanSkinToneId>[] = [
  { id: 'porcelain', nameTh: 'ขาวอมชมพู', nameEn: 'Porcelain', hex: '#f8dfd2' },
  { id: 'fair', nameTh: 'ขาวเหลือง', nameEn: 'Fair', hex: '#f1cfb8' },
  { id: 'warm_beige', nameTh: 'ผิวกลางอบอุ่น', nameEn: 'Warm Beige', hex: '#e2b596' },
  { id: 'olive', nameTh: 'ผิวน้ำผึ้ง', nameEn: 'Olive', hex: '#cfa07a' },
  { id: 'tan', nameTh: 'ผิวแทน', nameEn: 'Tan', hex: '#b7825a' },
  { id: 'brown', nameTh: 'น้ำตาลเข้ม', nameEn: 'Brown', hex: '#8e5d3d' },
  { id: 'deep', nameTh: 'ผิวเข้ม', nameEn: 'Deep', hex: '#633e28' }
];

export const HUMAN_HAIR_STYLES: OptionMeta<HumanHairStyle>[] = [
  { id: 'short', nameTh: 'ผมสั้น', nameEn: 'Short Hair' },
  { id: 'medium', nameTh: 'ผมประบ่า', nameEn: 'Medium Hair' },
  { id: 'long', nameTh: 'ผมยาวตรง', nameEn: 'Long Hair' },
  { id: 'bob', nameTh: 'ผมบ๊อบ', nameEn: 'Bob Cut' },
  { id: 'ponytail', nameTh: 'หางม้า', nameEn: 'Ponytail' },
  { id: 'curly', nameTh: 'ผมหยิก', nameEn: 'Curly Hair' },
  { id: 'wavy', nameTh: 'ผมลอนคลื่น', nameEn: 'Wavy Hair' },
  { id: 'buzz', nameTh: 'สกินเฮด', nameEn: 'Buzz Cut' },
  { id: 'side_part', nameTh: 'แสกข้าง', nameEn: 'Side Part' },
  { id: 'bun', nameTh: 'มวยผม', nameEn: 'Top Bun' }
];

export const HUMAN_HAIR_COLORS: OptionMeta<HumanHairColorId>[] = [
  { id: 'black', nameTh: 'ดำ', nameEn: 'Black', hex: '#232023' },
  { id: 'dark_brown', nameTh: 'น้ำตาลเข้ม', nameEn: 'Dark Brown', hex: '#432d22' },
  { id: 'chestnut', nameTh: 'น้ำตาลเกาลัด', nameEn: 'Chestnut', hex: '#6c3e26' },
  { id: 'light_brown', nameTh: 'น้ำตาลอ่อน', nameEn: 'Light Brown', hex: '#976c48' },
  { id: 'blonde', nameTh: 'บลอนด์', nameEn: 'Blonde', hex: '#d8b773' },
  { id: 'red', nameTh: 'แดงธรรมชาติ', nameEn: 'Red', hex: '#a64129' },
  { id: 'auburn', nameTh: 'น้ำตาลแดง', nameEn: 'Auburn', hex: '#7b3224' },
  { id: 'gray', nameTh: 'เทาเงิน', nameEn: 'Gray', hex: '#8c9096' },
  { id: 'white', nameTh: 'ขาวเงิน', nameEn: 'White', hex: '#e7e5e2' }
];

export const HUMAN_EYE_SHAPES: OptionMeta<HumanEyeShape>[] = [
  { id: 'almond', nameTh: 'เรียวยาว', nameEn: 'Almond' },
  { id: 'round', nameTh: 'กลมโต', nameEn: 'Round' },
  { id: 'hooded', nameTh: 'ตาชั้นใน', nameEn: 'Hooded' },
  { id: 'upturned', nameTh: 'หางตาเฉียงขึ้น', nameEn: 'Upturned' },
  { id: 'wide', nameTh: 'ตาโตอ่อนโยน', nameEn: 'Wide' }
];

export const HUMAN_EYE_COLORS: OptionMeta<HumanEyeColorId>[] = [
  { id: 'dark_brown', nameTh: 'น้ำตาลเข้ม', nameEn: 'Dark Brown', hex: '#3b2518' },
  { id: 'brown', nameTh: 'น้ำตาล', nameEn: 'Brown', hex: '#6e4526' },
  { id: 'hazel', nameTh: 'เฮเซล', nameEn: 'Hazel', hex: '#8d753d' },
  { id: 'green', nameTh: 'เขียว', nameEn: 'Green', hex: '#4e7d54' },
  { id: 'blue', nameTh: 'ฟ้า', nameEn: 'Blue', hex: '#4b82b4' },
  { id: 'gray', nameTh: 'เทา', nameEn: 'Gray', hex: '#74818c' }
];

export const HUMAN_MOUTH_SHAPES: OptionMeta<HumanMouthShape>[] = [
  { id: 'natural', nameTh: 'ธรรมชาติ', nameEn: 'Natural' },
  { id: 'smile', nameTh: 'ยิ้มอ่อนโยน', nameEn: 'Gentle Smile' },
  { id: 'full', nameTh: 'อวบอิ่ม', nameEn: 'Full Lips' },
  { id: 'thin', nameTh: 'เรียวบาง', nameEn: 'Slender' },
  { id: 'gentle', nameTh: 'อมยิ้มละมุน', nameEn: 'Soft Curve' }
];

export const HUMAN_LIP_COLORS = [
  { id: 'natural_rose', nameTh: 'ชมพูธรรมชาติ', nameEn: 'Natural Rose', hex: '#c87e7a' },
  { id: 'warm_nude', nameTh: 'นู้ดอุ่น', nameEn: 'Warm Nude', hex: '#b97c6d' },
  { id: 'soft_coral', nameTh: 'คอรัลอ่อน', nameEn: 'Soft Coral', hex: '#d47c6a' },
  { id: 'berry', nameTh: 'เบอร์รี', nameEn: 'Muted Berry', hex: '#a45764' },
  { id: 'terracotta', nameTh: 'เทอราคอตตา', nameEn: 'Terracotta', hex: '#a96254' }
] as const;

export const HUMAN_TOP_STYLES: OptionMeta<HumanTopStyle>[] = [
  { id: 'tshirt', nameTh: 'เสื้อยืด', nameEn: 'T-Shirt' },
  { id: 'long_sleeve', nameTh: 'เสื้อแขนยาว', nameEn: 'Long-Sleeve' },
  { id: 'hoodie', nameTh: 'เสื้อฮู้ด', nameEn: 'Hoodie' },
  { id: 'casual_shirt', nameTh: 'เสื้อเชิ้ตลำลอง', nameEn: 'Casual Shirt' },
  { id: 'sweater', nameTh: 'สเวตเตอร์ถัก', nameEn: 'Sweater' }
];

export const HUMAN_BOTTOM_STYLES: OptionMeta<HumanBottomStyle>[] = [
  { id: 'jeans', nameTh: 'กางเกงยีนส์', nameEn: 'Jeans' },
  { id: 'shorts', nameTh: 'กางเกงขาสั้น', nameEn: 'Shorts' },
  { id: 'casual_pants', nameTh: 'กางเกงลำลอง', nameEn: 'Casual Pants' },
  { id: 'long_pants', nameTh: 'กางเกงขายาว', nameEn: 'Long Pants' },
  { id: 'skirt', nameTh: 'กระโปรงสั้น', nameEn: 'Skirt' },
  { id: 'pleated_skirt', nameTh: 'กระโปรงจีบ', nameEn: 'Pleated Skirt' }
];

export const HUMAN_FOOTWEAR_STYLES: OptionMeta<HumanFootwearStyle>[] = [
  { id: 'sneakers', nameTh: 'รองเท้าผ้าใบ', nameEn: 'Sneakers' },
  { id: 'sandals', nameTh: 'รองเท้าแตะรัดส้น', nameEn: 'Sandals' },
  { id: 'slippers', nameTh: 'สลิปเปอร์ในบ้าน', nameEn: 'Slippers' },
  { id: 'casual_shoes', nameTh: 'รองเท้าลำลอง', nameEn: 'Casual Shoes' }
];

export const OUTFIT_COLOR_SWATCHES = [
  { nameTh: 'ครีมอุ่น', nameEn: 'Warm Cream', hex: '#ebe2d5' },
  { nameTh: 'เทอราคอตตา', nameEn: 'Terracotta', hex: '#c87a56' },
  { nameTh: 'เขียวเสจ', nameEn: 'Sage Green', hex: '#6f9277' },
  { nameTh: 'ฟ้าเดนิม', nameEn: 'Denim Blue', hex: '#4f6d8a' },
  { nameTh: 'กรมท่า', nameEn: 'Navy', hex: '#2f3d56' },
  { nameTh: 'ชาร์โคล', nameEn: 'Charcoal', hex: '#3d3c40' },
  { nameTh: 'น้ำตาลโอ๊ต', nameEn: 'Oat Brown', hex: '#9e8268' },
  { nameTh: 'ชมพูตุ่น', nameEn: 'Dusty Rose', hex: '#c7898c' },
  { nameTh: 'มัสตาร์ด', nameEn: 'Mustard', hex: '#cfa04c' },
  { nameTh: 'ขาวนวล', nameEn: 'Soft White', hex: '#f5f2ec' }
] as const;

export function getSkinToneHex(id: HumanSkinToneId): string {
  return HUMAN_SKIN_TONES.find((s) => s.id === id)?.hex ?? '#e2b596';
}

export function getHairColorHex(id: HumanHairColorId): string {
  return HUMAN_HAIR_COLORS.find((c) => c.id === id)?.hex ?? '#432d22';
}

export function getEyeColorHex(id: HumanEyeColorId): string {
  return HUMAN_EYE_COLORS.find((c) => c.id === id)?.hex ?? '#3b2518';
}

export function createDefaultHumanAppearance(gender: HumanGender = 'female'): HumanAppearance {
  if (gender === 'male') {
    return {
      name: 'นัท',
      gender: 'male',
      skinTone: 'warm_beige',
      hairStyle: 'side_part',
      hairColor: 'dark_brown',
      eyeShape: 'almond',
      eyeColor: 'dark_brown',
      eyeSize: 1.0,
      mouthShape: 'natural',
      lipColor: '#b97c6d',
      topStyle: 'hoodie',
      topColor: '#6f9277',
      bottomStyle: 'jeans',
      bottomColor: '#4f6d8a',
      footwearStyle: 'slippers',
      footwearColor: '#9e8268'
    };
  }
  return {
    name: 'มิ้นท์',
    gender: 'female',
    skinTone: 'fair',
    hairStyle: 'medium',
    hairColor: 'dark_brown',
    eyeShape: 'round',
    eyeColor: 'brown',
    eyeSize: 1.02,
    mouthShape: 'smile',
    lipColor: '#c87e7a',
    topStyle: 'sweater',
    topColor: '#ebe2d5',
    bottomStyle: 'casual_pants',
    bottomColor: '#4f6d8a',
    footwearStyle: 'slippers',
    footwearColor: '#c87a56'
  };
}
