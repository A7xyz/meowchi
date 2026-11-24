import {
  CatEmotion,
  CatIdentity,
  HumanAppearance,
  LifeStage,
  PlacedFurniture,
  RoomStatus
} from '../types/game';

export type OnlineConnectionStatus = 'connecting' | 'connected' | 'local_only' | 'offline';

export interface OnlinePlayerHome {
  playerId: string;
  homeCode: string;
  isLive: boolean;
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

export type VisitInteractionKind = 'visit' | 'pet' | 'treat' | 'like' | 'wave';

export interface OnlineVisitEvent {
  type: VisitInteractionKind;
  fromPlayerId: string;
  fromName: string;
  fromCatName: string;
  targetPlayerId: string;
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
  hostCatPosition: { x: number; z: number };
  hostCatRotationY: number;
  hostCatTarget: { x: number; z: number } | null;
  hostCatBehavior: 'idle' | 'walk' | 'sit' | 'happy' | 'pet_accept' | 'eat';
  hostCatTimer: number;
  likedThisVisit: boolean;
  treatedThisVisit: boolean;
  waveBubbleText: string | null;
  waveBubbleUntilMs: number;
}
