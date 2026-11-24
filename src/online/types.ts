import {
  CatBehaviorState,
  CatEmotion,
  CatIdentity,
  HumanAnimState,
  HumanAppearance,
  LifeStage,
  PlacedFurniture,
  RoomStatus
} from '../types/game';

export type OnlineConnectionStatus = 'connecting' | 'connected' | 'offline';

export interface OnlinePlayerHome {
  playerId: string;
  homeCode: string;
  ownerName: string;
  humanAppearance: HumanAppearance;
  catIdentity: CatIdentity;
  catAgeDays: number;
  catLifeStage: LifeStage;
  catLevel: number;
  catBondLevel: number;
  catEmotion: CatEmotion;
  placedFurniture: PlacedFurniture[];
  roomStatus: RoomStatus;
  likesCount: number;
  greetingTh: string;
  greetingEn: string;
  lastSeenUtc: number;
}

export type VisitInteractionKind = 'visit' | 'pet' | 'treat' | 'like' | 'wave' | 'chat';

export interface OnlineVisitEvent {
  type: VisitInteractionKind;
  fromPlayerId: string;
  fromName: string;
  fromCatName: string;
  targetPlayerId: string;
  message?: string;
  sentAtUtc: number;
}

/**
 * Live position & animation sync packet for a real human guest visiting a host's room.
 */
export interface LiveGuestPresence {
  playerId: string;
  ownerName: string;
  humanAppearance: HumanAppearance;
  x: number;
  z: number;
  rotationY: number;
  anim: 'idle' | 'walk' | 'pet_cat' | 'pour_food' | 'play_toy';
  bubbleText: string | null;
  bubbleUntilMs: number;
  lastSeenUtc: number;
}

/**
 * Live state sync packet published by a real host so visitors see the host & their cat move live!
 */
export interface LiveHostSyncPacket {
  hostPlayerId: string;
  humanPos: { x: number; z: number };
  humanRotY: number;
  humanAnim: HumanAnimState;
  catPos: { x: number; z: number };
  catRotY: number;
  catBehavior: CatBehaviorState;
  catEmotion: CatEmotion;
  sentAtUtc: number;
}

export interface VisitRuntimeState {
  home: OnlinePlayerHome;
  visitorPosition: { x: number; z: number };
  visitorRotationY: number;
  visitorTarget: { x: number; z: number } | null;
  visitorAnim: 'idle' | 'walk' | 'pet_cat' | 'pour_food' | 'play_toy';
  visitorActionTimer: number;
  hostPosition: { x: number; z: number };
  hostRotationY: number;
  hostAnim: HumanAnimState;
  hostCatPosition: { x: number; z: number };
  hostCatRotationY: number;
  hostCatTarget: { x: number; z: number } | null;
  hostCatBehavior: 'idle' | 'walk' | 'sit' | 'happy' | 'pet_accept' | 'eat';
  hostCatTimer: number;
  lastLiveHostSyncMs: number;
  likedThisVisit: boolean;
  treatedThisVisit: boolean;
  waveBubbleText: string | null;
  waveBubbleUntilMs: number;
}
