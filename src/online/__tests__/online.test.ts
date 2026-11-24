import { describe, expect, it } from 'vitest';
import { createDefaultCatIdentity, INITIAL_PLACED_FURNITURE } from '../../config/catalog';
import { createDefaultHumanAppearance } from '../../config/human';
import { useGameStore } from '../../store/useGameStore';
import { useOnlineStore } from '../../store/useOnlineStore';
import {
  decodeHomeInviteParam,
  deriveHomeCode,
  encodeHomeInviteParam
} from '../onlineService';
import { OnlinePlayerHome } from '../types';

function createSampleRealPlayerHome(playerId: string, ownerName: string): OnlinePlayerHome {
  return {
    playerId,
    homeCode: deriveHomeCode(playerId),
    ownerName,
    humanAppearance: {
      ...createDefaultHumanAppearance('female'),
      name: ownerName
    },
    catIdentity: createDefaultCatIdentity('persian'),
    catAgeDays: 120,
    catLifeStage: 'adult',
    catLevel: 7,
    catBondLevel: 6,
    catEmotion: 'happy_relaxed',
    placedFurniture: INITIAL_PLACED_FURNITURE,
    roomStatus: {
      foodBowlLevel: 85,
      foodBowlItemId: 'adult_wet',
      waterBowlLevel: 95,
      litterCleanliness: 92,
      roomCleanliness: 96,
      tableMugKnocked: false
    },
    likesCount: 5,
    greetingTh: 'สวัสดี!',
    greetingEn: 'Hello!',
    lastSeenUtc: Date.now()
  };
}

describe('Real-Only Online Presence & Home Visiting System', () => {
  it('starts with zero AI bot players and encodes/decodes shareable player home invite links', () => {
    expect(useOnlineStore.getState().livePlayers.length).toBe(0);

    const codeA = deriveHomeCode('device_b_user_1');
    const codeB = deriveHomeCode('device_b_user_1');
    expect(codeA).toMatch(/^MC-[A-Z0-9]{4}$/);
    expect(codeA).toBe(codeB);

    const realFriend = createSampleRealPlayerHome('device_b_user_1', 'ต้นข้าว');
    const encoded = encodeHomeInviteParam(realFriend);
    expect(encoded.length).toBeGreaterThan(20);
    const decoded = decodeHomeInviteParam(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.ownerName).toBe('ต้นข้าว');
    expect(decoded?.homeCode).toBe(realFriend.homeCode);
  });

  it('allows visiting another live online player by home code, interacting, and returning safely', () => {
    const online = useOnlineStore.getState();
    const initialCoins = useGameStore.getState().coins;
    const initialFurniture = useGameStore.getState().placedFurniture;

    const friendHome = createSampleRealPlayerHome('remote_phone_player_99', 'ฟ้าใส');
    online.ingestLivePlayerForTest(friendHome);

    // Visit via friend's real home code
    const found = useOnlineStore.getState().visitByHomeCode(friendHome.homeCode);
    expect(found).toBe(true);
    expect(useOnlineStore.getState().visitState?.home.ownerName).toBe('ฟ้าใส');

    // Walk, pet, give welcome treat (+10 coins once/day), like, and wave
    useOnlineStore.getState().moveVisitorTo(0.2, 0.4);
    useOnlineStore.getState().stepVisitSimulation(0.05);
    expect(useOnlineStore.getState().visitState?.visitorAnim).toBe('walk');

    useOnlineStore.getState().petVisitedCat();
    expect(useOnlineStore.getState().visitState?.visitorAnim).toBe('pet_cat');
    expect(useOnlineStore.getState().visitState?.hostCatBehavior).toBe('pet_accept');

    useOnlineStore.getState().giveVisitedCatTreat();
    expect(useGameStore.getState().coins).toBe(initialCoins + 10);
    useOnlineStore.getState().giveVisitedCatTreat();
    expect(useGameStore.getState().coins).toBe(initialCoins + 10);

    const likesBefore = useOnlineStore.getState().visitState!.home.likesCount;
    useOnlineStore.getState().likeVisitedHome();
    expect(useOnlineStore.getState().visitState?.home.likesCount).toBe(likesBefore + 1);

    useOnlineStore.getState().waveAtVisitedHome('สวัสดีจ้า! 👋');
    expect(useOnlineStore.getState().visitState?.waveBubbleText).toBe('สวัสดีจ้า! 👋');

    // Return home: own furniture untouched!
    useOnlineStore.getState().leaveVisitedHome();
    expect(useOnlineStore.getState().visitState).toBeNull();
    expect(useGameStore.getState().placedFurniture).toEqual(initialFurniture);
  });
});
