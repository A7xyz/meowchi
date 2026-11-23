import {
  AccessoryCatalogItem,
  Achievement,
  CatBreed,
  CatIdentity,
  DailyTask,
  FoodCatalogItem,
  FoodItemId,
  FurnitureCatalogItem,
  PlacedFurniture,
  ToyType
} from '../types/game';
import {
  EYE_COLOR_PALETTE,
  getBreedDefinition,
  resolveCoatHexColors
} from './breeds';
import { ECONOMY_CONFIG } from './economy';

export const ROOM_HALF_WIDTH = 2.8;
export const ROOM_HALF_DEPTH = 2.6;
export const ROOM_HEIGHT = 2.9;

export const FOOD_CATALOG: FoodCatalogItem[] = [
  {
    id: 'kitten_milk',
    nameTh: 'นมแพะสำหรับลูกแมว',
    nameEn: 'Kitten Milk Formula',
    descTh: 'นมสูตรอ่อนโยนสำหรับลูกแมวแรกเกิดถึงวัยหย่านม (5 มื้อ)',
    descEn: 'Gentle warm formula safe from day 0 newborn stage (5 servings).',
    priceCoins: ECONOMY_CONFIG.PRICES.kitten_milk.priceCoins,
    packSize: ECONOMY_CONFIG.PRICES.kitten_milk.packSize,
    minAgeDays: 0,
    satietyGain: 34,
    hydrationGain: 22,
    calories: 14,
    happinessGain: 10,
    bondGain: 16
  },
  {
    id: 'kitten_wet',
    nameTh: 'อาหารเปียกลูกแมว',
    nameEn: 'Kitten Wet Food',
    descTh: 'เนื้อมูสนุ่มโปรตีนสูง เหมาะกับลูกแมวอายุ 3 สัปดาห์ขึ้นไป (1 มื้อ)',
    descEn: 'Soft nutrient-rich mousse for kittens 3+ weeks old (1 serving).',
    priceCoins: ECONOMY_CONFIG.PRICES.kitten_wet.priceCoins,
    packSize: ECONOMY_CONFIG.PRICES.kitten_wet.packSize,
    minAgeDays: 21,
    satietyGain: 38,
    hydrationGain: 14,
    calories: 20,
    happinessGain: 14,
    bondGain: 16
  },
  {
    id: 'kitten_dry',
    nameTh: 'อาหารเม็ดลูกแมว',
    nameEn: 'Kitten Dry Food',
    descTh: 'เม็ดเล็กเคี้ยวง่ายเสริมสร้างกระดูก สำหรับอายุ 7 สัปดาห์ขึ้นไป (5 มื้อ)',
    descEn: 'Small crunchy kibble for growing teeth, 7+ weeks (5 servings).',
    priceCoins: ECONOMY_CONFIG.PRICES.kitten_dry.priceCoins,
    packSize: ECONOMY_CONFIG.PRICES.kitten_dry.packSize,
    minAgeDays: 49,
    satietyGain: 32,
    hydrationGain: -4,
    calories: 22,
    happinessGain: 8,
    bondGain: 10
  },
  {
    id: 'adult_dry',
    nameTh: 'อาหารเม็ดแมวโต',
    nameEn: 'Adult Dry Food',
    descTh: 'สูตรสมดุลพลังงานสำหรับแมวรุ่นและแมวโต (5 มื้อ)',
    descEn: 'Balanced daily dry kibble for young & adult cats (5 servings).',
    priceCoins: ECONOMY_CONFIG.PRICES.adult_dry.priceCoins,
    packSize: ECONOMY_CONFIG.PRICES.adult_dry.packSize,
    minAgeDays: 90,
    satietyGain: 34,
    hydrationGain: -5,
    calories: 24,
    happinessGain: 8,
    bondGain: 10
  },
  {
    id: 'adult_wet',
    nameTh: 'อาหารเปียกแมวโต',
    nameEn: 'Adult Wet Food',
    descTh: 'เนื้อปลาทูน่าในเยลลี่ หอมอร่อยช่วยเพิ่มน้ำ (1 มื้อ)',
    descEn: 'Savory fish chunks in jelly for hydration & coat health (1 serving).',
    priceCoins: ECONOMY_CONFIG.PRICES.adult_wet.priceCoins,
    packSize: ECONOMY_CONFIG.PRICES.adult_wet.packSize,
    minAgeDays: 90,
    satietyGain: 38,
    hydrationGain: 16,
    calories: 22,
    happinessGain: 15,
    bondGain: 14
  },
  {
    id: 'premium_wet',
    nameTh: 'อาหารเปียกพรีเมียมแซลมอน',
    nameEn: 'Premium Salmon Wet Food',
    descTh: 'แซลมอนเกรดโฮลิสติก บำรุงขนฟูเงางามและสุขภาพดี (1 มื้อ)',
    descEn: 'Holistic salmon recipe for glossy coat and deep joy (1 serving).',
    priceCoins: ECONOMY_CONFIG.PRICES.premium_wet.priceCoins,
    packSize: ECONOMY_CONFIG.PRICES.premium_wet.packSize,
    minAgeDays: 57,
    satietyGain: 44,
    hydrationGain: 20,
    calories: 26,
    happinessGain: 24,
    bondGain: 22
  },
  {
    id: 'cat_treat',
    nameTh: 'ขนมแมวเลียครีมมี่',
    nameEn: 'Creamy Cat Treats',
    descTh: 'ขนมแสนอร่อยเพิ่มความผูกพัน (ระวังให้มากเกินไปจะอ้วนง่าย!) (3 ซอง)',
    descEn: 'Tasty bonding snack—offer in moderation to keep healthy weight (3 servings).',
    priceCoins: ECONOMY_CONFIG.PRICES.cat_treat.priceCoins,
    packSize: ECONOMY_CONFIG.PRICES.cat_treat.packSize,
    minAgeDays: 21,
    satietyGain: 14,
    hydrationGain: 4,
    calories: 28,
    happinessGain: 22,
    bondGain: 20
  }
];

export function getFoodItem(id: FoodItemId): FoodCatalogItem {
  return FOOD_CATALOG.find((f) => f.id === id) ?? FOOD_CATALOG[0];
}

export const ACCESSORY_CATALOG: AccessoryCatalogItem[] = [
  {
    id: 'ribbon_coral',
    nameTh: 'ริบบิ้นผูกคอสีปะการัง',
    nameEn: 'Coral Silk Ribbon',
    descTh: 'ริบบิ้นผ้านุ่มน้ำหนักเบา ถอดง่ายปลอดภัยต่อน้องแมว',
    descEn: 'Lightweight breakaway coral ribbon collar.',
    priceCoins: 55,
    colorHex: '#d4745e'
  },
  {
    id: 'bell_collar_gold',
    nameTh: 'ปลอกคอหนังกระดิ่งทอง',
    nameEn: 'Leather Bell Collar',
    descTh: 'ปลอกคอสีน้ำตาลอุ่นพร้อมกระดิ่งจิ๋ว',
    descEn: 'Soft tan leather collar with tiny golden charm.',
    priceCoins: 85,
    colorHex: '#b38152'
  },
  {
    id: 'linen_bandana',
    nameTh: 'ผ้าพันคอลินินสีครีม',
    nameEn: 'Cozy Linen Bandana',
    descTh: 'ผ้าพันคอทอมือโทนมินิมอลอบอุ่น',
    descEn: 'Minimalist handwoven cream linen kerchief.',
    priceCoins: 95,
    colorHex: '#e6d8c3'
  },
  {
    id: 'sage_bow',
    nameTh: 'โบว์สีเขียวเสจ',
    nameEn: 'Sage Velvet Bow',
    descTh: 'โบว์กำมะหยี่สีเขียวธรรมชาติแสนสุภาพ',
    descEn: 'Gentle sage green velvet bowtie.',
    priceCoins: 75,
    colorHex: '#6c9175'
  }
];

export const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  {
    id: 'bed_plush',
    category: 'bed',
    nameTh: 'เบาะนอนขนนุ่ม',
    nameEn: 'Plush Cat Bed',
    descTh: 'เบาะอุ่นสบายสำหรับลูกแมวแรกเกิดและแมวโต',
    descEn: 'Warm cushioned nest for kittens and adult cats.',
    priceCoins: 0,
    width: 0.72,
    depth: 0.72,
    height: 0.2,
    walkable: false,
    jumpableHeight: 0.14,
    accentColor: '#e4d5c3',
    unlockLevel: 1
  },
  {
    id: 'bed_woven',
    category: 'bed',
    nameTh: 'ตะกร้าหวายสาน',
    nameEn: 'Woven Rattan Bed',
    descTh: 'ตะกร้าหวายอบอุ่นพร้อมเบาะผ้าลินิน',
    descEn: 'Cozy rattan basket with linen pillow.',
    priceCoins: 120,
    width: 0.76,
    depth: 0.76,
    height: 0.24,
    walkable: false,
    jumpableHeight: 0.16,
    accentColor: '#c49b6c',
    unlockLevel: 1
  },
  // ADVANCED AUTOMATIC EQUIPMENT — SMART CAT BED (400 Coins)
  {
    id: 'smart_cat_bed',
    category: 'bed',
    nameTh: 'เตียงแมวอัจฉริยะอุ่นสบาย',
    nameEn: 'Smart Cat Bed',
    descTh: 'เตียงคุมอุณหภูมิอุ่นสบาย น้องแมวชอบมานอนหลับและคลายเครียดได้เร็วขึ้น',
    descEn: 'Temperature-balanced smart bed with natural comfort boost for deeper naps.',
    priceCoins: ECONOMY_CONFIG.PRICES.smart_cat_bed,
    width: 0.8,
    depth: 0.78,
    height: 0.34,
    walkable: false,
    jumpableHeight: 0.18,
    accentColor: '#d9c5b2',
    unlockLevel: 1,
    isAutoEquipment: true
  },
  {
    id: 'food_bowl_ceramic',
    category: 'food_bowl',
    nameTh: 'ชามอาหารเซรามิก',
    nameEn: 'Ceramic Food Bowl',
    descTh: 'ชามอาหารทรงเตี้ย ทานง่ายไม่ระคายหนวด',
    descEn: 'Whisker-friendly ceramic feeding bowl.',
    priceCoins: 0,
    width: 0.34,
    depth: 0.34,
    height: 0.1,
    walkable: false,
    accentColor: '#df8c6f',
    unlockLevel: 1
  },
  // ADVANCED AUTOMATIC EQUIPMENT — AUTOMATIC FOOD FEEDER (650 Coins)
  {
    id: 'auto_food_feeder',
    category: 'food_bowl',
    nameTh: 'เครื่องให้อาหารแมวอัตโนมัติ',
    nameEn: 'Automatic Food Feeder',
    descTh: 'ตั้งเวลาและปริมาณอาหารได้ เติมอาหารจากคลังเพื่อจ่ายมื้ออัตโนมัติ (ไม่เสกอาหารฟรี)',
    descEn: 'Scheduled hopper feeder with adjustable portions. Uses food loaded from your inventory.',
    priceCoins: ECONOMY_CONFIG.PRICES.auto_food_feeder,
    width: 0.44,
    depth: 0.5,
    height: 0.56,
    walkable: false,
    accentColor: '#eae3d9',
    unlockLevel: 1,
    isAutoEquipment: true
  },
  {
    id: 'water_bowl_ceramic',
    category: 'water_bowl',
    nameTh: 'ชามน้ำดื่มใส',
    nameEn: 'Fresh Water Bowl',
    descTh: 'ชามน้ำเซรามิกสีครีม เติมน้ำสะอาดได้ฟรีเสมอ',
    descEn: 'Cool ceramic bowl—fresh water is always free.',
    priceCoins: 0,
    width: 0.34,
    depth: 0.34,
    height: 0.1,
    walkable: false,
    accentColor: '#8ab4c9',
    unlockLevel: 1
  },
  // ADVANCED AUTOMATIC EQUIPMENT — CAT WATER FOUNTAIN (350 Coins)
  {
    id: 'auto_water_fountain',
    category: 'water_bowl',
    nameTh: 'น้ำพุแมวกรองน้ำอัตโนมัติ',
    nameEn: 'Cat Water Fountain',
    descTh: 'น้ำพุไหลเวียนสดชื่น มีระบบติดตามระดับน้ำและทำความสะอาด น้องแมวเดินมาดื่มเองได้',
    descEn: 'Animated flowing fountain with water level tracking, refill & cleaning interactions.',
    priceCoins: ECONOMY_CONFIG.PRICES.auto_water_fountain,
    width: 0.42,
    depth: 0.42,
    height: 0.28,
    walkable: false,
    accentColor: '#7eb7d1',
    unlockLevel: 1,
    isAutoEquipment: true
  },
  {
    id: 'litter_box_cozy',
    category: 'litter_box',
    nameTh: 'กระบะทรายแมว',
    nameEn: 'Cozy Litter Box',
    descTh: 'กระบะทรายขอบต่ำ ดูแลความสะอาดง่าย',
    descEn: 'Low-entry litter box for easy daily care.',
    priceCoins: 0,
    width: 0.62,
    depth: 0.48,
    height: 0.22,
    walkable: false,
    accentColor: '#b7b0a5',
    unlockLevel: 1
  },
  // ADVANCED AUTOMATIC EQUIPMENT — AUTOMATIC LITTER BOX (900 Coins)
  {
    id: 'auto_litter_box',
    category: 'litter_box',
    nameTh: 'ห้องน้ำแมวอัตโนมัติ',
    nameEn: 'Automatic Litter Box',
    descTh: 'หมุนเก็บทรายอัตโนมัติเมื่อแมวออกแล้วเท่านั้น พร้อมเซนเซอร์ปลอดภัยสำหรับลูกแมว',
    descEn: 'Self-cleaning drum activates only after cat exits, with kitten safety lock & waste bin.',
    priceCoins: ECONOMY_CONFIG.PRICES.auto_litter_box,
    width: 0.72,
    depth: 0.66,
    height: 0.66,
    walkable: false,
    accentColor: '#e7e2da',
    unlockLevel: 1,
    isAutoEquipment: true
  },
  // ADVANCED AUTOMATIC EQUIPMENT — AUTOMATIC CAT TOY (500 Coins)
  {
    id: 'auto_cat_toy',
    category: 'toy',
    nameTh: 'ของเล่นแมวอัตโนมัติหมุนได้',
    nameEn: 'Automatic Cat Toy',
    descTh: 'ก้านขนนกหมุนล่อแมวอัตโนมัติพร้อมคูลดาวน์ ช่วยให้แมวขี้เล่นได้ออกกำลังกาย',
    descEn: 'Motorized spinning feather teaser with cooldowns that keeps playful cats active.',
    priceCoins: ECONOMY_CONFIG.PRICES.auto_cat_toy,
    width: 0.44,
    depth: 0.44,
    height: 0.48,
    walkable: false,
    accentColor: '#d98c64',
    unlockLevel: 1,
    isAutoEquipment: true
  },
  {
    id: 'scratching_post_sisal',
    category: 'scratching_post',
    nameTh: 'เสาลับเล็บเชือกป่าน',
    nameEn: 'Sisal Scratching Post',
    descTh: 'ช่วยให้น้องแมวลับเล็บและคลายเครียด',
    descEn: 'Natural sisal post for healthy scratching.',
    priceCoins: 0,
    width: 0.5,
    depth: 0.5,
    height: 0.92,
    walkable: false,
    jumpableHeight: 0.92,
    accentColor: '#c7a77b',
    unlockLevel: 1
  },
  {
    id: 'cat_tower_oak',
    category: 'cat_tower',
    nameTh: 'คอนโดแมวไม้โอ๊ค',
    nameEn: 'Oak Cat Tower',
    descTh: 'คอนโดแมว 2 ชั้นสำหรับปีนป่ายและชมวิว',
    descEn: 'Multi-level oak tower for climbing and observing.',
    priceCoins: 240,
    width: 0.78,
    depth: 0.72,
    height: 1.38,
    walkable: false,
    jumpableHeight: 0.72,
    accentColor: '#b9936c',
    unlockLevel: 1
  },
  {
    id: 'cardboard_box',
    category: 'toy',
    nameTh: 'กล่องกระดาษแสนรัก',
    nameEn: 'Cardboard Box',
    descTh: 'พื้นที่ปลอดภัยสำหรับหลบซ่อนและแอบซุ่มกระโจนเล่น',
    descEn: 'Safe cozy hiding spot for shy cats and playful box ambushes.',
    priceCoins: 0,
    width: 0.54,
    depth: 0.46,
    height: 0.34,
    walkable: false,
    jumpableHeight: 0.12,
    accentColor: '#c39a6b',
    unlockLevel: 1
  },
  {
    id: 'rug_linen',
    category: 'carpet',
    nameTh: 'พรมทอสีครีม',
    nameEn: 'Woven Cream Rug',
    descTh: 'พรมนุ่มปูกลางห้อง อบอุ่นใต้แสงแดด',
    descEn: 'Soft woven carpet for sunlit naps.',
    priceCoins: 0,
    width: 2.2,
    depth: 1.65,
    height: 0.02,
    walkable: true,
    accentColor: '#e7ddd0',
    unlockLevel: 1
  },
  {
    id: 'rug_terracotta',
    category: 'carpet',
    nameTh: 'พรมลายอบอุ่น',
    nameEn: 'Warm Terracotta Rug',
    descTh: 'พรมทอมือโทนสีอบอุ่นสไตล์มินิมอล',
    descEn: 'Minimalist warm terracotta accent rug.',
    priceCoins: 150,
    width: 2.1,
    depth: 1.5,
    height: 0.02,
    walkable: true,
    accentColor: '#c9886b',
    unlockLevel: 1
  },
  {
    id: 'sofa_linen',
    category: 'sofa',
    nameTh: 'โซฟาผ้าลินิน',
    nameEn: 'Linen Sofa',
    descTh: 'โซฟาหนานุ่ม เหมาะสำหรับน้องแมวกระโดดขึ้นมานอน',
    descEn: 'Plush linen sofa great for adolescent & adult naps.',
    priceCoins: 0,
    width: 1.85,
    depth: 0.85,
    height: 0.78,
    walkable: false,
    jumpableHeight: 0.42,
    accentColor: '#d7cab9',
    unlockLevel: 1
  },
  {
    id: 'table_oak',
    category: 'table',
    nameTh: 'โต๊ะกลางไม้โอ๊ค',
    nameEn: 'Oak Coffee Table',
    descTh: 'โต๊ะไม้พร้อมแก้วเซรามิก (ระวังแมวขี้เล่นปัดตก!)',
    descEn: 'Wooden table with ceramic mug (curious cats may nudge it!).',
    priceCoins: 0,
    width: 0.96,
    depth: 0.56,
    height: 0.42,
    walkable: false,
    jumpableHeight: 0.42,
    accentColor: '#b38960',
    unlockLevel: 1
  },
  {
    id: 'floor_lamp_warm',
    category: 'lighting',
    nameTh: 'โคมไฟตั้งพื้นแสงอุ่น',
    nameEn: 'Warm Floor Lamp',
    descTh: 'เพิ่มบรรยากาศอบอุ่นยามเย็นให้ห้องนั่งเล่น',
    descEn: 'Adds cozy warm ambience to the living room.',
    priceCoins: 140,
    width: 0.42,
    depth: 0.42,
    height: 1.55,
    walkable: false,
    accentColor: '#f1d9a7',
    unlockLevel: 1
  },
  {
    id: 'wall_art_botanical',
    category: 'wall_decor',
    nameTh: 'ภาพกรอบไม้พฤกษา',
    nameEn: 'Botanical Framed Art',
    descTh: 'ภาพตกแต่งผนังโทนธรรมชาติสบายตา',
    descEn: 'Calming botanical print in an oak frame.',
    priceCoins: 90,
    width: 0.7,
    depth: 0.08,
    height: 0.55,
    walkable: true,
    wallMounted: true,
    accentColor: '#869a7f',
    unlockLevel: 1
  }
];

export interface ToyCatalogItem {
  id: ToyType;
  nameTh: string;
  nameEn: string;
  descTh: string;
  descEn: string;
  priceCoins: number;
  minStage: 'baby_kitten' | 'young_kitten';
}

export const TOY_CATALOG: ToyCatalogItem[] = [
  {
    id: 'feather_wand',
    nameTh: 'ไม้ตกแมวขนนก',
    nameEn: 'Feather Wand',
    descTh: 'ลากนิ้วบนจอเพื่อถือไม้ตกแมวแกว่งขนนกให้น้องแมวหมอบและตะครุบ',
    descEn: 'Drag across the screen to wave the feather wand by hand and trigger pouncing.',
    priceCoins: 0,
    minStage: 'baby_kitten'
  },
  {
    id: 'ball',
    nameTh: 'ลูกบอลไหมพรม',
    nameEn: 'Yarn Ball',
    descTh: 'ปัดหรือแตะบนพื้นเพื่อกลิ้งลูกบอลให้น้องแมววิ่งไล่',
    descEn: 'Swipe or tap the floor to roll the ball.',
    priceCoins: 0,
    minStage: 'baby_kitten'
  },
  {
    id: 'toy_mouse',
    nameTh: 'หนูไขลาน',
    nameEn: 'Wind-Up Mouse',
    descTh: 'ปล่อยหนูวิ่งไปทั่วห้อง ช่วยเผาผลาญพลังงานและลดน้ำหนักส่วนเกิน',
    descEn: 'Skittering toy mouse that encourages healthy exercise.',
    priceCoins: 75,
    minStage: 'baby_kitten'
  },
  {
    id: 'scratching_post',
    nameTh: 'เสาลับเล็บ',
    nameEn: 'Scratching Post',
    descTh: 'ชวนน้องแมวไปลับเล็บคลายความเครียด',
    descEn: 'Invite your cat to stretch, scratch, and relieve stress.',
    priceCoins: 0,
    minStage: 'baby_kitten'
  },
  {
    id: 'cardboard_box',
    nameTh: 'กล่องกระดาษ',
    nameEn: 'Cardboard Box',
    descTh: 'พื้นที่หลบซ่อนที่ปลอดภัยสำหรับแมวขี้อายและซุ่มเล่น',
    descEn: 'Safe retreat for shy, curious, or playful kittens.',
    priceCoins: 0,
    minStage: 'baby_kitten'
  }
];

export const INITIAL_PLACED_FURNITURE: PlacedFurniture[] = [
  { instanceId: 'f_rug_1', catalogId: 'rug_linen', x: 0, z: 0.15, rotationY: 0 },
  { instanceId: 'f_sofa_1', catalogId: 'sofa_linen', x: 0, z: -1.85, rotationY: 0 },
  { instanceId: 'f_table_1', catalogId: 'table_oak', x: 0.1, z: -0.75, rotationY: 0 },
  { instanceId: 'f_bed_1', catalogId: 'bed_plush', x: -1.45, z: 0.25, rotationY: 0.35 },
  { instanceId: 'f_food_1', catalogId: 'food_bowl_ceramic', x: 1.55, z: 0.85, rotationY: 0 },
  { instanceId: 'f_water_1', catalogId: 'water_bowl_ceramic', x: 1.55, z: 1.38, rotationY: 0 },
  { instanceId: 'f_litter_1', catalogId: 'litter_box_cozy', x: -2.0, z: -1.75, rotationY: 0 },
  { instanceId: 'f_scratch_1', catalogId: 'scratching_post_sisal', x: 1.95, z: -1.55, rotationY: 0 },
  { instanceId: 'f_box_1', catalogId: 'cardboard_box', x: -1.85, z: 1.5, rotationY: 0.28 }
];

export function getCatalogItem(catalogId: string): FurnitureCatalogItem | undefined {
  return FURNITURE_CATALOG.find((item) => item.id === catalogId);
}

export function createStarterFoodInventory(): Record<FoodItemId, number> {
  return {
    kitten_milk: 6,
    kitten_wet: 2,
    kitten_dry: 5,
    adult_dry: 0,
    adult_wet: 0,
    premium_wet: 0,
    cat_treat: 2
  };
}

export function createDefaultDailyTasks(): DailyTask[] {
  return [
    {
      id: 'daily_feed',
      type: 'feed',
      titleTh: 'ให้อาหารน้องแมว 2 ครั้ง',
      titleEn: 'Offer food 2 times',
      progress: 0,
      target: 2,
      rewardCoins: 30,
      rewardXp: 25,
      claimed: false
    },
    {
      id: 'daily_play',
      type: 'play',
      titleTh: 'เล่นกับน้องแมว',
      titleEn: 'Play with your cat',
      progress: 0,
      target: 1,
      rewardCoins: 30,
      rewardXp: 30,
      claimed: false
    },
    {
      id: 'daily_clean',
      type: 'clean',
      titleTh: 'ทำความสะอาดกระบะทรายหรือห้อง',
      titleEn: 'Clean litter box or room',
      progress: 0,
      target: 1,
      rewardCoins: 25,
      rewardXp: 20,
      claimed: false
    },
    {
      id: 'daily_photo',
      type: 'photo',
      titleTh: 'ถ่ายภาพน้องแมว 1 รูป',
      titleEn: 'Take 1 photo of your cat',
      progress: 0,
      target: 1,
      rewardCoins: 25,
      rewardXp: 20,
      claimed: false
    },
    {
      id: 'daily_bond',
      type: 'bond',
      titleTh: 'ดูแลสร้างความไว้ใจ 3 ครั้ง',
      titleEn: 'Gentle bonding care 3 times',
      progress: 0,
      target: 3,
      rewardCoins: 35,
      rewardXp: 30,
      claimed: false
    }
  ];
}

export function createDefaultAchievements(): Achievement[] {
  return [
    {
      id: 'ach_first_feed',
      titleTh: 'มื้อแรกแสนอบอุ่น',
      titleEn: 'First Warm Meal',
      descTh: 'ป้อนนมหรืออาหารให้น้องแมวเป็นครั้งแรก',
      descEn: 'Offer your kitten its first meal.',
      unlocked: false,
      rewardCoins: 40
    },
    {
      id: 'ach_eyes_open',
      titleTh: 'ลืมตาดูโลก',
      titleEn: 'Eyes Wide Open',
      descTh: 'เลี้ยงลูกแมวจนก้าวสู่วัยลูกแมวตัวน้อย (3 สัปดาห์)',
      descEn: 'Raise your newborn to Baby Kitten stage.',
      unlocked: false,
      rewardCoins: 80
    },
    {
      id: 'ach_bond_25',
      titleTh: 'เพื่อนรู้ใจ',
      titleEn: 'Trusted Companion',
      descTh: 'สร้างสายสัมพันธ์ถึงระดับ 25',
      descEn: 'Reach Bond Level 25.',
      unlocked: false,
      rewardCoins: 100
    },
    {
      id: 'ach_photographer',
      titleTh: 'ช่างภาพประจำบ้าน',
      titleEn: 'Cozy Photographer',
      descTh: 'บันทึกภาพน้องแมวลงอัลบั้มครั้งแรก',
      descEn: 'Save your first photo to the album.',
      unlocked: false,
      rewardCoins: 50
    },
    {
      id: 'ach_grown_up',
      titleTh: 'เติบโตเต็มวัย',
      titleEn: 'All Grown Up',
      descTh: 'ดูแลน้องแมวจนเติบโตเป็นแมวโตเต็มวัย',
      descEn: 'Raise your kitten all the way to Adult Cat.',
      unlocked: false,
      rewardCoins: 250
    }
  ];
}

export function createDefaultCatIdentity(breedId: CatBreed = 'siamese'): CatIdentity {
  const def = getBreedDefinition(breedId);
  const colors = resolveCoatHexColors(def.defaultColor, def.defaultPattern);
  const eyeHex = EYE_COLOR_PALETTE[def.defaultEye].hex;

  return {
    id: `cat_${Date.now()}`,
    name: def.defaultNameTh,
    sex: 'female',
    breed: def.id,
    furColorId: def.defaultColor,
    furColor: colors.primary,
    furSecondary: colors.secondary,
    eyeColorId: def.defaultEye,
    eyeColor: eyeHex,
    furPattern: def.defaultPattern,
    equippedAccessory: 'none',
    adoptedAt: Date.now()
  };
}
