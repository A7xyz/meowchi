import { EYE_COLOR_PALETTE, resolveCoatHexColors } from '../config/breeds';
import { createDefaultCatIdentity } from '../config/catalog';
import { createDefaultHumanAppearance } from '../config/human';
import { AccessoryId, CatBreed, CatIdentity, EyeColorId, FurColorId, FurPattern } from '../types/game';
import { OnlinePlayerHome } from './types';

function makeNeighborCat(
  breed: CatBreed,
  opts: {
    name: string;
    furColorId: FurColorId;
    furPattern: FurPattern;
    eyeColorId: EyeColorId;
    equippedAccessory: AccessoryId;
  }
): CatIdentity {
  const base = createDefaultCatIdentity(breed);
  const coat = resolveCoatHexColors(opts.furColorId, opts.furPattern);
  return {
    ...base,
    name: opts.name,
    furColorId: opts.furColorId,
    furColor: coat.primary,
    furSecondary: coat.secondary,
    furPattern: opts.furPattern,
    eyeColorId: opts.eyeColorId,
    eyeColor: EYE_COLOR_PALETTE[opts.eyeColorId].hex,
    equippedAccessory: opts.equippedAccessory
  };
}

/**
 * Curated Meowchi Community Neighbor Homes (`isLive: false`).
 * Clearly marked in UI as community neighbors so players always have richly decorated
 * homes with diverse breeds & smart equipment to visit alongside live online players.
 */
export function getCommunityNeighborHomes(): OnlinePlayerHome[] {
  const now = Date.now();
  return [
    {
      playerId: 'neighbor_may_matcha',
      homeCode: 'MC-MAY1',
      isLive: false,
      ownerName: 'พี่เมย์',
      humanAppearance: {
        ...createDefaultHumanAppearance('female'),
        name: 'พี่เมย์',
        skinTone: 'porcelain',
        hairColor: 'chestnut',
        topColor: '#c7898c',
        bottomColor: '#4f6d8a',
        footwearColor: '#ebe2d5'
      },
      catIdentity: makeNeighborCat('persian', {
        name: 'มัทฉะ',
        furColorId: 'white',
        furPattern: 'solid',
        eyeColorId: 'green',
        equippedAccessory: 'sage_bow'
      }),
      catAgeDays: 145,
      catLifeStage: 'adult',
      catLevel: 8,
      catBondLevel: 7,
      catEmotion: 'happy_relaxed',
      placedFurniture: [
        { instanceId: 'n1_rug', catalogId: 'rug_linen', x: 0, z: 0.25, rotationY: 0 },
        { instanceId: 'n1_sofa', catalogId: 'sofa_linen', x: -0.25, z: -1.65, rotationY: 0 },
        { instanceId: 'n1_tower', catalogId: 'cat_tower_oak', x: 1.85, z: -1.4, rotationY: 0 },
        { instanceId: 'n1_bed', catalogId: 'smart_cat_bed', x: -1.7, z: 0.35, rotationY: 0 },
        { instanceId: 'n1_fountain', catalogId: 'auto_water_fountain', x: 1.65, z: 1.15, rotationY: 0 },
        { instanceId: 'n1_food', catalogId: 'food_bowl_ceramic', x: 1.55, z: 0.45, rotationY: 0 },
        { instanceId: 'n1_litter', catalogId: 'litter_box_cozy', x: -1.95, z: -1.2, rotationY: 0 },
        { instanceId: 'n1_lamp', catalogId: 'floor_lamp_warm', x: -2.05, z: -1.8, rotationY: 0 }
      ],
      roomStatus: {
        foodBowlLevel: 92,
        foodBowlItemId: 'premium_wet',
        waterBowlLevel: 100,
        litterCleanliness: 96,
        roomCleanliness: 98,
        tableMugKnocked: false
      },
      likesCount: 42,
      greetingTh: 'แวะมาเล่นกับน้องมัทฉะได้น้า ขนฟูชอบให้ลูบหัว!',
      greetingEn: 'Come say hi to Matcha! She loves gentle head pats.',
      lastSeenUtc: now
    },
    {
      playerId: 'neighbor_beam_bluebell',
      homeCode: 'MC-BEM2',
      isLive: false,
      ownerName: 'บีม',
      humanAppearance: {
        ...createDefaultHumanAppearance('male'),
        name: 'บีม',
        skinTone: 'warm_beige',
        hairColor: 'black',
        topColor: '#4f6d8a',
        bottomColor: '#3d3c40',
        footwearColor: '#9e8268'
      },
      catIdentity: makeNeighborCat('british_shorthair', {
        name: 'บลูเบลล์',
        furColorId: 'blue_gray',
        furPattern: 'solid',
        eyeColorId: 'copper',
        equippedAccessory: 'bell_collar_gold'
      }),
      catAgeDays: 95,
      catLifeStage: 'adolescent',
      catLevel: 6,
      catBondLevel: 5,
      catEmotion: 'curious',
      placedFurniture: [
        { instanceId: 'n2_rug', catalogId: 'rug_terracotta', x: 0.1, z: 0.35, rotationY: 0 },
        { instanceId: 'n2_sofa', catalogId: 'sofa_linen', x: 0.2, z: -1.7, rotationY: 0 },
        { instanceId: 'n2_table', catalogId: 'table_oak', x: 0.1, z: -0.3, rotationY: 0 },
        { instanceId: 'n2_bed', catalogId: 'bed_woven', x: -1.65, z: 0.55, rotationY: 0 },
        { instanceId: 'n2_feeder', catalogId: 'auto_food_feeder', x: 1.75, z: 0.6, rotationY: 0 },
        { instanceId: 'n2_water', catalogId: 'water_bowl_ceramic', x: 1.65, z: 1.3, rotationY: 0 },
        { instanceId: 'n2_post', catalogId: 'scratching_post_sisal', x: 1.85, z: -1.1, rotationY: 0 },
        { instanceId: 'n2_litter', catalogId: 'litter_box_cozy', x: -1.9, z: -1.1, rotationY: 0 }
      ],
      roomStatus: {
        foodBowlLevel: 85,
        foodBowlItemId: 'adult_wet',
        waterBowlLevel: 94,
        litterCleanliness: 92,
        roomCleanliness: 95,
        tableMugKnocked: false
      },
      likesCount: 31,
      greetingTh: 'บ้านบีมกับน้องบลูเบลล์ ยินดีต้อนรับเพื่อนใหม่ครับ!',
      greetingEn: 'Welcome to Beam & Bluebell’s cozy loft!',
      lastSeenUtc: now
    },
    {
      playerId: 'neighbor_pai_cinnamon',
      homeCode: 'MC-PAI3',
      isLive: false,
      ownerName: 'พาย',
      humanAppearance: {
        ...createDefaultHumanAppearance('female'),
        name: 'พาย',
        skinTone: 'olive',
        hairColor: 'auburn',
        topColor: '#cfa04c',
        bottomColor: '#2f3d56',
        footwearColor: '#c87a56'
      },
      catIdentity: makeNeighborCat('bengal', {
        name: 'ซินนามอน',
        furColorId: 'orange',
        furPattern: 'spotted',
        eyeColorId: 'gold',
        equippedAccessory: 'linen_bandana'
      }),
      catAgeDays: 68,
      catLifeStage: 'young_kitten',
      catLevel: 5,
      catBondLevel: 6,
      catEmotion: 'playful',
      placedFurniture: [
        { instanceId: 'n3_rug', catalogId: 'rug_linen', x: -0.1, z: 0.4, rotationY: 0 },
        { instanceId: 'n3_tower', catalogId: 'cat_tower_oak', x: -1.65, z: -1.35, rotationY: 0 },
        { instanceId: 'n3_toy', catalogId: 'auto_cat_toy', x: 0.25, z: 0.85, rotationY: 0 },
        { instanceId: 'n3_box', catalogId: 'cardboard_box', x: -1.75, z: 1.15, rotationY: 0 },
        { instanceId: 'n3_bed', catalogId: 'bed_plush', x: 1.7, z: -0.8, rotationY: 0 },
        { instanceId: 'n3_food', catalogId: 'food_bowl_ceramic', x: 1.65, z: 0.75, rotationY: 0 },
        { instanceId: 'n3_water', catalogId: 'water_bowl_ceramic', x: 1.65, z: 1.35, rotationY: 0 },
        { instanceId: 'n3_litter', catalogId: 'litter_box_cozy', x: 0.55, z: -1.65, rotationY: 0 }
      ],
      roomStatus: {
        foodBowlLevel: 76,
        foodBowlItemId: 'kitten_wet',
        waterBowlLevel: 90,
        litterCleanliness: 88,
        roomCleanliness: 91,
        tableMugKnocked: false
      },
      likesCount: 54,
      greetingTh: 'น้องซินนามอนซนมาก ชอบวิ่งรอบห้องทั้งวันเลย!',
      greetingEn: 'Cinnamon is full of zoomies today—come play!',
      lastSeenUtc: now
    },
    {
      playerId: 'neighbor_james_latte',
      homeCode: 'MC-JMS4',
      isLive: false,
      ownerName: 'เจมส์',
      humanAppearance: {
        ...createDefaultHumanAppearance('male'),
        name: 'เจมส์',
        skinTone: 'fair',
        hairColor: 'light_brown',
        topColor: '#6f9277',
        bottomColor: '#4f6d8a',
        footwearColor: '#ebe2d5'
      },
      catIdentity: makeNeighborCat('ragdoll', {
        name: 'ลาเต้',
        furColorId: 'cream',
        furPattern: 'colorpoint',
        eyeColorId: 'blue',
        equippedAccessory: 'ribbon_coral'
      }),
      catAgeDays: 210,
      catLifeStage: 'adult',
      catLevel: 11,
      catBondLevel: 9,
      catEmotion: 'affectionate',
      placedFurniture: [
        { instanceId: 'n4_rug', catalogId: 'rug_terracotta', x: 0, z: 0.2, rotationY: 0 },
        { instanceId: 'n4_sofa', catalogId: 'sofa_linen', x: -0.1, z: -1.7, rotationY: 0 },
        { instanceId: 'n4_bed', catalogId: 'smart_cat_bed', x: -1.75, z: 0.25, rotationY: 0 },
        { instanceId: 'n4_litter', catalogId: 'auto_litter_box', x: -1.9, z: -1.25, rotationY: 0 },
        { instanceId: 'n4_feeder', catalogId: 'auto_food_feeder', x: 1.75, z: 0.45, rotationY: 0 },
        { instanceId: 'n4_fountain', catalogId: 'auto_water_fountain', x: 1.7, z: 1.25, rotationY: 0 },
        { instanceId: 'n4_toy', catalogId: 'auto_cat_toy', x: 0.4, z: 1.1, rotationY: 0 },
        { instanceId: 'n4_lamp', catalogId: 'floor_lamp_warm', x: 1.95, z: -1.5, rotationY: 0 }
      ],
      roomStatus: {
        foodBowlLevel: 100,
        foodBowlItemId: 'premium_wet',
        waterBowlLevel: 100,
        litterCleanliness: 100,
        roomCleanliness: 100,
        tableMugKnocked: false
      },
      likesCount: 89,
      greetingTh: 'บ้านสมาร์ทโฮมของน้องลาเต้ มีอุปกรณ์อัตโนมัติครบทุกชิ้นเลย!',
      greetingEn: 'Latte’s full Smart Cat Home—every automatic gadget installed!',
      lastSeenUtc: now
    },
    {
      playerId: 'neighbor_aom_oba',
      homeCode: 'MC-AOM5',
      isLive: false,
      ownerName: 'ออม',
      humanAppearance: {
        ...createDefaultHumanAppearance('female'),
        name: 'ออม',
        skinTone: 'fair',
        hairColor: 'black',
        topColor: '#ebe2d5',
        bottomColor: '#9e8268',
        footwearColor: '#c87a56'
      },
      catIdentity: makeNeighborCat('siamese', {
        name: 'โอบะ',
        furColorId: 'cream',
        furPattern: 'colorpoint',
        eyeColorId: 'blue',
        equippedAccessory: 'none'
      }),
      catAgeDays: 52,
      catLifeStage: 'young_kitten',
      catLevel: 4,
      catBondLevel: 5,
      catEmotion: 'happy_relaxed',
      placedFurniture: [
        { instanceId: 'n5_rug', catalogId: 'rug_linen', x: 0, z: 0.35, rotationY: 0 },
        { instanceId: 'n5_sofa', catalogId: 'sofa_linen', x: -0.2, z: -1.65, rotationY: 0 },
        { instanceId: 'n5_table', catalogId: 'table_oak', x: -0.1, z: -0.35, rotationY: 0 },
        { instanceId: 'n5_bed', catalogId: 'bed_woven', x: -1.7, z: 0.85, rotationY: 0 },
        { instanceId: 'n5_post', catalogId: 'scratching_post_sisal', x: 1.8, z: -1.0, rotationY: 0 },
        { instanceId: 'n5_food', catalogId: 'food_bowl_ceramic', x: 1.55, z: 0.7, rotationY: 0 },
        { instanceId: 'n5_water', catalogId: 'water_bowl_ceramic', x: 1.55, z: 1.35, rotationY: 0 },
        { instanceId: 'n5_litter', catalogId: 'litter_box_cozy', x: -1.9, z: -1.0, rotationY: 0 }
      ],
      roomStatus: {
        foodBowlLevel: 88,
        foodBowlItemId: 'kitten_dry',
        waterBowlLevel: 92,
        litterCleanliness: 94,
        roomCleanliness: 96,
        tableMugKnocked: false
      },
      likesCount: 27,
      greetingTh: 'น้องโอบะขี้อ้อน ชอบชวนคุยเหมียวๆ ตลอดเวลาเลย',
      greetingEn: 'Oba is a chatty Siamese kitten who loves visitors!',
      lastSeenUtc: now
    },
    {
      playerId: 'neighbor_ton_yaksa',
      homeCode: 'MC-TON6',
      isLive: false,
      ownerName: 'ต้น',
      humanAppearance: {
        ...createDefaultHumanAppearance('male'),
        name: 'ต้น',
        skinTone: 'tan',
        hairColor: 'dark_brown',
        topColor: '#c87a56',
        bottomColor: '#3d3c40',
        footwearColor: '#9e8268'
      },
      catIdentity: makeNeighborCat('maine_coon', {
        name: 'ยักษ์ใหญ่',
        furColorId: 'gray',
        furPattern: 'tabby',
        eyeColorId: 'amber',
        equippedAccessory: 'bell_collar_gold'
      }),
      catAgeDays: 320,
      catLifeStage: 'adult',
      catLevel: 12,
      catBondLevel: 10,
      catEmotion: 'happy_relaxed',
      placedFurniture: [
        { instanceId: 'n6_rug', catalogId: 'rug_terracotta', x: 0, z: 0.3, rotationY: 0 },
        { instanceId: 'n6_tower', catalogId: 'cat_tower_oak', x: 1.8, z: -1.45, rotationY: 0 },
        { instanceId: 'n6_bed', catalogId: 'bed_plush', x: -1.6, z: 0.45, rotationY: 0 },
        { instanceId: 'n6_box', catalogId: 'cardboard_box', x: -1.65, z: 1.3, rotationY: 0 },
        { instanceId: 'n6_fountain', catalogId: 'auto_water_fountain', x: 1.7, z: 1.15, rotationY: 0 },
        { instanceId: 'n6_food', catalogId: 'food_bowl_ceramic', x: 1.65, z: 0.45, rotationY: 0 },
        { instanceId: 'n6_litter', catalogId: 'auto_litter_box', x: -1.9, z: -1.25, rotationY: 0 },
        { instanceId: 'n6_toy', catalogId: 'auto_cat_toy', x: 0.1, z: 1.05, rotationY: 0 }
      ],
      roomStatus: {
        foodBowlLevel: 95,
        foodBowlItemId: 'adult_wet',
        waterBowlLevel: 100,
        litterCleanliness: 99,
        roomCleanliness: 97,
        tableMugKnocked: false
      },
      likesCount: 73,
      greetingTh: 'เมนคูนตัวใหญ่ใจดี แวะมาทักทายน้องยักษ์ใหญ่ได้ครับ!',
      greetingEn: 'Gentle giant Maine Coon—stop by and say hello!',
      lastSeenUtc: now
    }
  ];
}
