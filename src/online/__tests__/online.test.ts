import { describe, expect, it } from 'vitest';
import { getCommunityNeighborHomes } from '../communityHomes';
import {
  decodeHomeInviteParam,
  deriveHomeCode,
  encodeHomeInviteParam
} from '../onlineService';
import { useGameStore } from '../../store/useGameStore';
import { useOnlineStore } from '../../store/useOnlineStore';

describe('Online Presence & Home Visiting System', () => {
  it('derives deterministic MC-XXXX home codes and encodes/decodes shareable invite payloads', () => {
    const codeA = deriveHomeCode('player_alpha_123');
    const codeB = deriveHomeCode('player_alpha_123');
    expect(codeA).toMatch(/^MC-[A-Z0-9]{4}$/);
    expect(codeA).toBe(codeB);

    const neighbors = getCommunityNeighborHomes();
    expect(neighbors.length).toBeGreaterThanOrEqual(6);

    const encoded = encodeHomeInviteParam(neighbors[0]);
    expect(encoded.length).toBeGreaterThan(20);
    const decoded = decodeHomeInviteParam(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.ownerName).toBe(neighbors[0].ownerName);
    expect(decoded?.catIdentity.name).toBe(neighbors[0].catIdentity.name);
    expect(decoded?.placedFurniture.length).toBe(neighbors[0].placedFurniture.length);
  });

  it('allows visiting a neighbor home, petting, giving a welcome treat (+10 coins once/day), liking, and returning safely', () => {
    const online = useOnlineStore.getState();
    const initialCoins = useGameStore.getState().coins;
    const initialFurniture = useGameStore.getState().placedFurniture;

    // Visit via home code
    const found = online.visitByHomeCode('MC-MAY1');
    expect(found).toBe(true);
    expect(useOnlineStore.getState().visitState?.home.ownerName).toBe('พี่เมย์');

    // Step simulation while visiting
    useOnlineStore.getState().moveVisitorTo(0.2, 0.4);
    useOnlineStore.getState().stepVisitSimulation(0.05);
    expect(useOnlineStore.getState().visitState?.visitorAnim).toBe('walk');

    // Pet host's cat
    useOnlineStore.getState().petVisitedCat();
    expect(useOnlineStore.getState().visitState?.visitorAnim).toBe('pet_cat');
    expect(useOnlineStore.getState().visitState?.hostCatBehavior).toBe('pet_accept');

    // Give welcome treat (+10 coins once per house per day)
    useOnlineStore.getState().giveVisitedCatTreat();
    expect(useGameStore.getState().coins).toBe(initialCoins + 10);
    useOnlineStore.getState().giveVisitedCatTreat();
    expect(useGameStore.getState().coins).toBe(initialCoins + 10); // No duplicate reward same day!

    // Like host home
    const likesBefore = useOnlineStore.getState().visitState!.home.likesCount;
    useOnlineStore.getState().likeVisitedHome();
    expect(useOnlineStore.getState().visitState?.home.likesCount).toBe(likesBefore + 1);
    expect(useOnlineStore.getState().visitState?.likedThisVisit).toBe(true);

    // Return home: own furniture untouched!
    useOnlineStore.getState().leaveVisitedHome();
    expect(useOnlineStore.getState().visitState).toBeNull();
    expect(useGameStore.getState().placedFurniture).toEqual(initialFurniture);
  });
});
