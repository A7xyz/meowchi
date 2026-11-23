import { clamp } from './growth';

export interface BondMilestone {
  level: number;
  key:
    | 'recognizes_player'
    | 'voluntary_approach'
    | 'greets_player'
    | 'follows_player'
    | 'sleeps_nearby'
    | 'requests_affection';
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
}

export const BOND_MILESTONES: BondMilestone[] = [
  {
    level: 5,
    key: 'recognizes_player',
    titleTh: 'จำเสียงและใบหน้าคุณได้',
    titleEn: 'Recognizes Your Presence',
    descTh: 'หันหน้ามองและกระดิกหูรับทุกครั้งที่คุณเรียกหรือแตะ',
    descEn: 'Turns to look at you and perks its ears when you interact.'
  },
  {
    level: 15,
    key: 'voluntary_approach',
    titleTh: 'เดินเข้ามาหาด้วยตัวเอง',
    titleEn: 'Voluntarily Approaches',
    descTh: 'เริ่มเดินเข้ามาใกล้คุณเองอย่างเป็นธรรมชาติ',
    descEn: 'Walks toward you on its own when comfortable.'
  },
  {
    level: 30,
    key: 'greets_player',
    titleTh: 'ทักทายและส่งเสียงคราง',
    titleEn: 'Greets & Purrs Warmly',
    descTh: 'ส่งเสียงครางเบาๆ อย่างไว้ใจเมื่อถูกลูบและต้อนรับคุณ',
    descEn: 'Purrs warmly when petted and greets you happily.'
  },
  {
    level: 50,
    key: 'follows_player',
    titleTh: 'เดินตามคุณในห้อง',
    titleEn: 'Follows You Around',
    descTh: 'ชอบเดินตามจุดที่คุณมองในบริเวณที่เข้าถึงได้',
    descEn: 'Follows your focus around accessible areas of the room.'
  },
  {
    level: 70,
    key: 'sleeps_nearby',
    titleTh: 'หลับเคียงข้างอย่างอุ่นใจ',
    titleEn: 'Sleeps Nearby',
    descTh: 'เลือกมานอนหลับใกล้ๆ คุณแทนมุมห่างไกล',
    descEn: 'Chooses to curl up and nap near where you are watching.'
  },
  {
    level: 85,
    key: 'requests_affection',
    titleTh: 'ออเซาะขอความรัก',
    titleEn: 'Requests Affection',
    descTh: 'เดินมาบิดตัวและส่งสัญญาณให้คุณลูบหัวบ่อยขึ้น',
    descEn: 'Actively comes over to stretch and ask for gentle pets.'
  }
];

export interface BondCapabilities {
  recognizesPlayer: boolean;
  voluntarilyApproaches: boolean;
  greetsPlayer: boolean;
  followsPlayer: boolean;
  sleepsNearby: boolean;
  requestsAffection: boolean;
}

export function getBondCapabilities(bondLevel: number): BondCapabilities {
  return {
    recognizesPlayer: bondLevel >= 5,
    voluntarilyApproaches: bondLevel >= 15,
    greetsPlayer: bondLevel >= 30,
    followsPlayer: bondLevel >= 50,
    sleepsNearby: bondLevel >= 70,
    requestsAffection: bondLevel >= 85
  };
}

export function addBondPoints(
  bondLevel: number,
  bondXp: number,
  points: number
): { bondLevel: number; bondXp: number; leveledUp: boolean } {
  let lvl = clamp(Math.floor(bondLevel), 1, 100);
  let xp = Math.max(0, bondXp) + Math.max(0, points);
  let leveledUp = false;

  while (lvl < 100 && xp >= 100) {
    xp -= 100;
    lvl += 1;
    leveledUp = true;
  }

  if (lvl >= 100) {
    xp = 100;
  }

  return { bondLevel: lvl, bondXp: Math.round(xp), leveledUp };
}
