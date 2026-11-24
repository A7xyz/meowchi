import { create } from 'zustand';
import { ROOM_HALF_DEPTH, ROOM_HALF_WIDTH } from '../config/catalog';
import { getCommunityNeighborHomes } from '../online/communityHomes';
import {
  decodeHomeInviteParam,
  deriveHomeCode,
  encodeHomeInviteParam,
  getOrCreateLocalPlayerId,
  OnlinePresenceService
} from '../online/onlineService';
import {
  OnlineConnectionStatus,
  OnlinePlayerHome,
  OnlineVisitEvent,
  VisitRuntimeState
} from '../online/types';
import { resolveCatCollision } from '../simulation/collision';
import { getUtcDayNumber } from '../simulation/economy';
import { clamp } from '../simulation/growth';
import { useGameStore } from './useGameStore';

const LIKES_STORAGE_KEY = 'meowchi_home_likes_v1';

function loadStoredLikes(): number {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return Number(window.localStorage.getItem(LIKES_STORAGE_KEY) || '0') || 0;
    }
  } catch {
    // Ignore
  }
  return 0;
}

function saveStoredLikes(val: number): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LIKES_STORAGE_KEY, String(val));
    }
  } catch {
    // Ignore
  }
}

let serviceInstance: OnlinePresenceService | null = null;

export interface OnlineStoreState {
  myPlayerId: string;
  myHomeCode: string;
  connectionStatus: OnlineConnectionStatus;
  livePlayers: OnlinePlayerHome[];
  communityHomes: OnlinePlayerHome[];
  showOnlineModal: boolean;
  homeLikesReceived: number;
  visitParticleSeq: number;
  visitParticleType: 'hearts' | 'sparkles';
  treatRewardedDays: Record<string, number>;
  visitState: VisitRuntimeState | null;

  initOnlineService: () => void;
  publishHomeUpdate: () => void;
  setShowOnlineModal: (open: boolean) => void;
  visitHome: (home: OnlinePlayerHome) => void;
  visitByHomeCode: (codeInput: string) => boolean;
  leaveVisitedHome: () => void;
  stepVisitSimulation: (dtSeconds: number) => void;
  moveVisitorTo: (x: number, z: number) => void;
  petVisitedCat: () => void;
  giveVisitedCatTreat: () => void;
  likeVisitedHome: () => void;
  waveAtVisitedHome: () => void;
  getShareableInviteUrl: () => string;
}

function buildOwnHomeSnapshot(playerId: string, homeCode: string, likesCount: number): OnlinePlayerHome {
  const gs = useGameStore.getState();
  return {
    playerId,
    homeCode,
    isLive: true,
    ownerName: gs.humanAppearance.name || 'Meowchi',
    humanAppearance: gs.humanAppearance,
    catIdentity: gs.cat.identity,
    catAgeDays: gs.cat.ageDays,
    catLifeStage: gs.cat.lifeStage,
    catLevel: gs.cat.level,
    catBondLevel: gs.cat.bondLevel,
    catEmotion: gs.cat.emotion,
    placedFurniture: gs.placedFurniture,
    roomStatus: gs.room,
    likesCount,
    greetingTh: `ยินดีต้อนรับสู่บ้านของ ${gs.humanAppearance.name} & น้อง${gs.cat.identity.name}!`,
    greetingEn: `Welcome to ${gs.humanAppearance.name} & ${gs.cat.identity.name}'s home!`,
    lastSeenUtc: Date.now()
  };
}

export const useOnlineStore = create<OnlineStoreState>((set, get) => {
  const initialId = getOrCreateLocalPlayerId();
  const initialCode = deriveHomeCode(initialId);

  return {
    myPlayerId: initialId,
    myHomeCode: initialCode,
    connectionStatus: 'connecting',
    livePlayers: [],
    communityHomes: getCommunityNeighborHomes(),
    showOnlineModal: false,
    homeLikesReceived: loadStoredLikes(),
    visitParticleSeq: 0,
    visitParticleType: 'hearts',
    treatRewardedDays: {},
    visitState: null,

    initOnlineService: () => {
      if (serviceInstance) return;

      serviceInstance = new OnlinePresenceService({
        getOwnHomeSnapshot: () =>
          buildOwnHomeSnapshot(get().myPlayerId, get().myHomeCode, get().homeLikesReceived),
        onStatusChange: (status) => set({ connectionStatus: status }),
        onLivePlayersChange: (players) => set({ livePlayers: players }),
        onVisitEventReceived: (ev: OnlineVisitEvent) => {
          const gs = useGameStore.getState();
          const lang = gs.settings.language;
          if (ev.type === 'like') {
            const nextLikes = get().homeLikesReceived + 1;
            saveStoredLikes(nextLikes);
            set({ homeLikesReceived: nextLikes });
            gs.showToast(
              lang === 'th'
                ? `♥ ${ev.fromName} กดหัวใจให้บ้านของคุณ!`
                : `♥ ${ev.fromName} liked your home!`,
              'celebrate'
            );
          } else if (ev.type === 'pet') {
            gs.showToast(
              lang === 'th'
                ? `🐾 ${ev.fromName} แวะมาลูบหัวน้อง${gs.cat.identity.name}!`
                : `🐾 ${ev.fromName} petted ${gs.cat.identity.name}!`,
              'celebrate'
            );
          } else if (ev.type === 'treat') {
            gs.showToast(
              lang === 'th'
                ? `🐟 ${ev.fromName} เอาขนมมาฝากน้อง${gs.cat.identity.name}!`
                : `🐟 ${ev.fromName} gave ${gs.cat.identity.name} a welcome treat!`,
              'celebrate'
            );
          } else if (ev.type === 'wave') {
            gs.showToast(
              lang === 'th'
                ? `👋 ${ev.fromName} โบกมือทักทายคุณ!`
                : `👋 ${ev.fromName} waved hello!`,
              'info'
            );
          } else if (ev.type === 'visit') {
            gs.showToast(
              lang === 'th'
                ? `🏡 ${ev.fromName} กำลังเข้ามาเยี่ยมบ้านของคุณ!`
                : `🏡 ${ev.fromName} is visiting your home!`,
              'info'
            );
          }
        }
      });

      serviceInstance.start();

      // Auto-visit if opened via a friend's invite link (?visit=...)
      if (typeof window !== 'undefined') {
        try {
          const params = new URLSearchParams(window.location.search);
          const visitParam = params.get('visit');
          if (visitParam) {
            const invitedHome = decodeHomeInviteParam(visitParam);
            if (invitedHome && invitedHome.playerId !== get().myPlayerId) {
              setTimeout(() => {
                get().visitHome(invitedHome);
              }, 700);
            }
          }
        } catch {
          // Ignore invalid URL params
        }
      }
    },

    publishHomeUpdate: () => {
      serviceInstance?.publishOwnPresence();
    },

    setShowOnlineModal: (open) => {
      if (open) {
        useGameStore.getState().setDrawerOpen(false);
        serviceInstance?.publishOwnPresence();
      }
      set({ showOnlineModal: open });
    },

    visitHome: (home) => {
      const gs = useGameStore.getState();
      gs.setDrawerOpen(false);
      gs.activateToy(null);
      if (gs.decorateMode) gs.setDecorateMode(false);

      const startHostCat = resolveCatCollision({ x: -0.1, z: 0.35 }, 0.22, home.placedFurniture);
      const startHost = resolveCatCollision({ x: -0.95, z: -0.35 }, 0.25, home.placedFurniture);
      const startVisitor = resolveCatCollision({ x: 0.9, z: 1.25 }, 0.25, home.placedFurniture);

      set({
        showOnlineModal: false,
        visitState: {
          home,
          visitorPosition: startVisitor,
          visitorRotationY: -2.2,
          visitorTarget: null,
          visitorAnim: 'idle',
          visitorActionTimer: 0,
          hostPosition: startHost,
          hostRotationY: 0.65,
          hostCatPosition: startHostCat,
          hostCatRotationY: 0.4,
          hostCatTarget: null,
          hostCatBehavior: 'idle',
          hostCatTimer: 2.2,
          likedThisVisit: false,
          treatedThisVisit: false,
          waveBubbleText: null,
          waveBubbleUntilMs: 0
        }
      });

      if (home.isLive && serviceInstance) {
        serviceInstance.sendVisitEvent(
          home.playerId,
          'visit',
          gs.humanAppearance.name,
          gs.cat.identity.name
        );
      }

      const lang = gs.settings.language;
      gs.showToast(
        lang === 'th'
          ? `🏡 เข้าเยี่ยมบ้านของ ${home.ownerName} & น้อง${home.catIdentity.name}`
          : `🏡 Visiting ${home.ownerName} & ${home.catIdentity.name}'s home`,
        'celebrate'
      );
    },

    visitByHomeCode: (codeInput) => {
      const normalized = codeInput.trim().toUpperCase();
      if (!normalized) return false;
      const withPrefix = normalized.startsWith('MC-') ? normalized : `MC-${normalized}`;
      const all = [...get().livePlayers, ...get().communityHomes];
      const match = all.find(
        (h) => h.homeCode.toUpperCase() === withPrefix || h.homeCode.toUpperCase() === normalized
      );
      if (match) {
        get().visitHome(match);
        return true;
      }
      return false;
    },

    leaveVisitedHome: () => {
      const gs = useGameStore.getState();
      set({ visitState: null });
      const lang = gs.settings.language;
      gs.showToast(
        lang === 'th' ? '🏠 กลับถึงบ้านของคุณแล้ว!' : '🏠 Welcome back home!',
        'info'
      );
    },

    moveVisitorTo: (x, z) => {
      const vs = get().visitState;
      if (!vs) return;
      const target = resolveCatCollision(
        {
          x: clamp(x, -ROOM_HALF_WIDTH + 0.35, ROOM_HALF_WIDTH - 0.35),
          z: clamp(z, -ROOM_HALF_DEPTH + 0.35, ROOM_HALF_DEPTH - 0.35)
        },
        0.24,
        vs.home.placedFurniture
      );
      set({
        visitState: {
          ...vs,
          visitorTarget: target,
          visitorAnim: 'walk',
          visitorActionTimer: 0
        }
      });
    },

    petVisitedCat: () => {
      const vs = get().visitState;
      if (!vs) return;
      const gs = useGameStore.getState();
      const lang = gs.settings.language;

      const offset = vs.visitorPosition.x >= vs.hostCatPosition.x ? 0.45 : -0.45;
      const approach = resolveCatCollision(
        { x: vs.hostCatPosition.x + offset, z: vs.hostCatPosition.z + 0.15 },
        0.24,
        vs.home.placedFurniture
      );

      set({
        visitParticleSeq: get().visitParticleSeq + 1,
        visitParticleType: 'hearts',
        visitState: {
          ...vs,
          visitorTarget: approach,
          visitorAnim: 'pet_cat',
          visitorActionTimer: 2.3,
          hostCatBehavior: 'pet_accept',
          hostCatTimer: 2.6
        }
      });

      if (vs.home.isLive && serviceInstance) {
        serviceInstance.sendVisitEvent(
          vs.home.playerId,
          'pet',
          gs.humanAppearance.name,
          gs.cat.identity.name
        );
      }

      gs.showToast(
        lang === 'th'
          ? `♥ ลูบหัวน้อง${vs.home.catIdentity.name}เบาๆ น้องครางเพอร์อย่างมีความสุข!`
          : `♥ Gently petted ${vs.home.catIdentity.name}!`,
        'celebrate'
      );
    },

    giveVisitedCatTreat: () => {
      const vs = get().visitState;
      if (!vs) return;
      const gs = useGameStore.getState();
      const lang = gs.settings.language;
      const today = getUtcDayNumber(Date.now());
      const alreadyRewarded = get().treatRewardedDays[vs.home.playerId] === today;

      const offset = vs.visitorPosition.x >= vs.hostCatPosition.x ? 0.5 : -0.5;
      const approach = resolveCatCollision(
        { x: vs.hostCatPosition.x + offset, z: vs.hostCatPosition.z + 0.12 },
        0.24,
        vs.home.placedFurniture
      );

      if (!alreadyRewarded) {
        useGameStore.setState((s) => ({ coins: s.coins + 10 }));
      }

      set({
        visitParticleSeq: get().visitParticleSeq + 1,
        visitParticleType: 'sparkles',
        treatRewardedDays: {
          ...get().treatRewardedDays,
          [vs.home.playerId]: today
        },
        visitState: {
          ...vs,
          visitorTarget: approach,
          visitorAnim: 'pour_food',
          visitorActionTimer: 2.4,
          hostCatBehavior: 'eat',
          hostCatTimer: 3.0,
          treatedThisVisit: true
        }
      });

      if (vs.home.isLive && serviceInstance) {
        serviceInstance.sendVisitEvent(
          vs.home.playerId,
          'treat',
          gs.humanAppearance.name,
          gs.cat.identity.name
        );
      }

      gs.showToast(
        lang === 'th'
          ? alreadyRewarded
            ? `🐟 ให้ขนมทักทายน้อง${vs.home.catIdentity.name}แล้ว!`
            : `🐟 ให้ขนมทักทายน้อง${vs.home.catIdentity.name} (+10 เหรียญมิตรภาพ!)`
          : alreadyRewarded
            ? `🐟 Gave ${vs.home.catIdentity.name} a friendly treat!`
            : `🐟 Gave ${vs.home.catIdentity.name} a welcome treat (+10 Coins!)`,
        'celebrate'
      );
    },

    likeVisitedHome: () => {
      const vs = get().visitState;
      if (!vs) return;
      const gs = useGameStore.getState();
      const lang = gs.settings.language;

      if (vs.likedThisVisit) {
        gs.showToast(
          lang === 'th' ? '♥ คุณส่งหัวใจให้บ้านนี้แล้ว!' : '♥ You already liked this home!',
          'info'
        );
        return;
      }

      const updatedHome: OnlinePlayerHome = {
        ...vs.home,
        likesCount: vs.home.likesCount + 1
      };

      set((state) => ({
        visitParticleSeq: state.visitParticleSeq + 1,
        visitParticleType: 'hearts',
        communityHomes: state.communityHomes.map((h) =>
          h.playerId === updatedHome.playerId ? updatedHome : h
        ),
        livePlayers: state.livePlayers.map((h) =>
          h.playerId === updatedHome.playerId ? updatedHome : h
        ),
        visitState: {
          ...vs,
          home: updatedHome,
          likedThisVisit: true
        }
      }));

      if (vs.home.isLive && serviceInstance) {
        serviceInstance.sendVisitEvent(
          vs.home.playerId,
          'like',
          gs.humanAppearance.name,
          gs.cat.identity.name
        );
      }

      gs.showToast(
        lang === 'th'
          ? `♥ ส่งหัวใจให้บ้านของ ${vs.home.ownerName} แล้ว! (${updatedHome.likesCount})`
          : `♥ Sent a heart to ${vs.home.ownerName}'s home! (${updatedHome.likesCount})`,
        'celebrate'
      );
    },

    waveAtVisitedHome: () => {
      const vs = get().visitState;
      if (!vs) return;
      const gs = useGameStore.getState();
      const lang = gs.settings.language;

      set({
        visitState: {
          ...vs,
          waveBubbleText: lang === 'th' ? 'สวัสดีจ้า! 👋' : 'Hello! 👋',
          waveBubbleUntilMs: Date.now() + 3000
        }
      });

      if (vs.home.isLive && serviceInstance) {
        serviceInstance.sendVisitEvent(
          vs.home.playerId,
          'wave',
          gs.humanAppearance.name,
          gs.cat.identity.name
        );
      }
    },

    stepVisitSimulation: (dtSeconds) => {
      const vs = get().visitState;
      if (!vs) return;
      const dt = clamp(dtSeconds, 0, 0.08);
      const furn = vs.home.placedFurniture;

      let vPos = { ...vs.visitorPosition };
      let vRot = vs.visitorRotationY;
      let vTarget = vs.visitorTarget;
      let vAnim = vs.visitorAnim;
      let vTimer = vs.visitorActionTimer;

      // 1. Visitor movement & action completion
      if (vTarget) {
        const dx = vTarget.x - vPos.x;
        const dz = vTarget.z - vPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.12) {
          const speed = 1.55;
          const step = Math.min(dist, speed * dt);
          const next = resolveCatCollision(
            { x: vPos.x + (dx / dist) * step, z: vPos.z + (dz / dist) * step },
            0.24,
            furn
          );
          vPos = next;
          vRot = Math.atan2(dx, dz);
          if (vAnim === 'idle') vAnim = 'walk';
        } else {
          vTarget = null;
          // Face host's cat upon arrival for pet/treat
          vRot = Math.atan2(vs.hostCatPosition.x - vPos.x, vs.hostCatPosition.z - vPos.z);
          if (vAnim === 'walk') vAnim = 'idle';
        }
      } else if (vTimer > 0) {
        vTimer = Math.max(0, vTimer - dt);
        if (vTimer === 0) {
          vAnim = 'idle';
        }
      }

      // 2. Host's cat cozy autonomous roaming inside the host's house
      let cPos = { ...vs.hostCatPosition };
      let cRot = vs.hostCatRotationY;
      let cTarget = vs.hostCatTarget;
      let cBeh = vs.hostCatBehavior;
      let cTimer = vs.hostCatTimer - dt;

      if (cBeh === 'walk' && cTarget) {
        const dx = cTarget.x - cPos.x;
        const dz = cTarget.z - cPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.14) {
          const step = Math.min(dist, 0.72 * dt);
          cPos = resolveCatCollision(
            { x: cPos.x + (dx / dist) * step, z: cPos.z + (dz / dist) * step },
            0.2,
            furn
          );
          cRot = Math.atan2(dx, dz);
        } else {
          cTarget = null;
          cBeh = 'sit';
          cTimer = 2.6 + Math.random() * 2.5;
        }
      }

      if (cTimer <= 0 && cBeh !== 'pet_accept') {
        const roll = Math.random();
        if (roll < 0.48) {
          cTarget = resolveCatCollision(
            {
              x: (Math.random() - 0.5) * 3.4,
              z: (Math.random() - 0.5) * 2.6
            },
            0.22,
            furn
          );
          cBeh = 'walk';
          cTimer = 5.0;
        } else if (roll < 0.78) {
          cTarget = null;
          cBeh = 'sit';
          cTimer = 3.2 + Math.random() * 2.0;
        } else {
          cTarget = null;
          cBeh = 'happy';
          cTimer = 2.6;
        }
      } else if (cTimer <= 0 && cBeh === 'pet_accept') {
        cBeh = 'happy';
        cTimer = 2.2;
      }

      // Host subtly turns to face visitor
      const hostRot = Math.atan2(vPos.x - vs.hostPosition.x, vPos.z - vs.hostPosition.z);

      set({
        visitState: {
          ...vs,
          visitorPosition: vPos,
          visitorRotationY: vRot,
          visitorTarget: vTarget,
          visitorAnim: vAnim,
          visitorActionTimer: vTimer,
          hostRotationY: hostRot,
          hostCatPosition: cPos,
          hostCatRotationY: cRot,
          hostCatTarget: cTarget,
          hostCatBehavior: cBeh,
          hostCatTimer: cTimer,
          waveBubbleText: Date.now() < vs.waveBubbleUntilMs ? vs.waveBubbleText : null
        }
      });
    },

    getShareableInviteUrl: () => {
      const snap = buildOwnHomeSnapshot(get().myPlayerId, get().myHomeCode, get().homeLikesReceived);
      const param = encodeHomeInviteParam(snap);
      if (typeof window === 'undefined') return `?visit=${param}`;
      const base = `${window.location.origin}${window.location.pathname}`;
      return `${base}?visit=${param}`;
    }
  };
});
