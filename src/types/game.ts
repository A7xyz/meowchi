export type Language = 'th' | 'en';
export type QualityPreset = 'low' | 'medium' | 'high';

export type LifeStage =
  | 'newborn'
  | 'baby_kitten'
  | 'young_kitten'
  | 'adolescent'
  | 'adult'
  | 'senior';

export type SurvivalMode = 'standard' | 'casual';

export type CatSex = 'female' | 'male';

export type CatBreed =
  | 'persian'
  | 'british_shorthair'
  | 'scottish_straight'
  | 'maine_coon'
  | 'ragdoll'
  | 'siamese'
  | 'american_shorthair'
  | 'bengal'
  | 'munchkin'
  | 'thai_mixed';

export type FurColorId =
  | 'white'
  | 'black'
  | 'orange'
  | 'gray'
  | 'cream'
  | 'brown'
  | 'blue_gray';

export type FurPattern =
  | 'solid'
  | 'tabby'
  | 'bicolor'
  | 'tortoiseshell'
  | 'calico'
  | 'colorpoint'
  | 'spotted';

export type EyeColorId = 'blue' | 'amber' | 'green' | 'gold' | 'hazel' | 'copper';

export type AccessoryId =
  | 'none'
  | 'ribbon_coral'
  | 'bell_collar_gold'
  | 'linen_bandana'
  | 'sage_bow';

/**
 * 8-trait continuous personality model (0-100 each), randomized on adoption
 * and evolved gradually through player care.
 */
export interface PersonalityTraits {
  aggression: number;   // Defensiveness / overstimulation sensitivity
  affection: number;    // Warmth & desire for closeness
  independence: number; // Stubbornness / self-reliance
  fearfulness: number;  // Startle & caution level
  playfulness: number;  // Drive to chase toys & pounce
  curiosity: number;    // Exploration & sniffing drive
  sociability: number;  // Comfort around player & greetings
  trust: number;        // Deep emotional safety with player
}

export type CatEmotion =
  | 'happy_relaxed'
  | 'affectionate'
  | 'fearful'
  | 'defensive_angry'
  | 'playful'
  | 'sleepy'
  | 'curious';

export type BodyCondition = 'underweight' | 'lean' | 'healthy' | 'overweight' | 'obese';

export type CatBehaviorState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'zoomies'
  | 'roll_play'
  | 'box_ambush'
  | 'chase_imaginary'
  | 'sit'
  | 'sleep'
  | 'stretch'
  | 'groom'
  | 'eat'
  | 'drink'
  | 'use_litter'
  | 'explore'
  | 'play'
  | 'approach_player'
  | 'hide'
  | 'observe'
  | 'jump_prep'
  | 'jump'
  | 'jump_land'
  | 'react_to_sound'
  | 'knead'
  | 'head_bunt'
  | 'pounce_crouch'
  | 'hiss_defend'
  | 'bite_defend'
  | 'yawn';

export type FoodItemId =
  | 'kitten_milk'
  | 'kitten_wet'
  | 'kitten_dry'
  | 'adult_dry'
  | 'adult_wet'
  | 'premium_wet'
  | 'cat_treat';

export type ToyType =
  | 'feather_wand'
  | 'ball'
  | 'toy_mouse'
  | 'scratching_post'
  | 'cardboard_box';

export type FurnitureCategory =
  | 'bed'
  | 'food_bowl'
  | 'water_bowl'
  | 'litter_box'
  | 'scratching_post'
  | 'cat_tower'
  | 'toy'
  | 'carpet'
  | 'sofa'
  | 'table'
  | 'wall_decor'
  | 'lighting';

export type AutoEquipmentCatalogId =
  | 'auto_water_fountain'
  | 'auto_food_feeder'
  | 'auto_litter_box'
  | 'smart_cat_bed'
  | 'auto_cat_toy';

export type MinigameId =
  | 'fishing'
  | 'matching'
  | 'toy_challenge'
  | 'delivery'
  | 'clean_room';

export type MinigamePerformanceTier = 'low' | 'normal' | 'excellent' | 'exceptional';

export type ActiveTab = 'care' | 'food' | 'play' | 'shop' | 'minigames';

export type CareActionType =
  | 'pet'
  | 'feed'
  | 'brush'
  | 'water'
  | 'pickup'
  | 'play_toy'
  | 'clean_litter'
  | 'clean_room'
  | 'respect_space'
  | 'sleep'
  | 'refill_fountain'
  | 'clean_fountain'
  | 'empty_auto_litter';

export type ActionPhase = 'approaching' | 'aligning' | 'performing' | 'finishing';

export interface ActiveCareAction {
  id: string;
  type: CareActionType;
  phase: ActionPhase;
  startedAtMs: number;
  phaseStartedAtMs: number;
  durationMs: number;
  contactAtMs: number;
  maxTotalMs: number;
  committed: boolean;
  reservedFoodId?: FoodItemId;
  bitten?: boolean;
  foodId?: FoodItemId;
  toyType?: ToyType;
  targetInstanceId?: string;
  targetPoint: Vec2;
  alignTarget: Vec2;
}

export type HumanGender = 'female' | 'male';

export type HumanSkinToneId =
  | 'porcelain'
  | 'fair'
  | 'warm_beige'
  | 'olive'
  | 'tan'
  | 'brown'
  | 'deep';

export type HumanHairStyle =
  | 'short'
  | 'medium'
  | 'long'
  | 'bob'
  | 'ponytail'
  | 'curly'
  | 'wavy'
  | 'buzz'
  | 'side_part'
  | 'bun';

export type HumanHairColorId =
  | 'black'
  | 'dark_brown'
  | 'chestnut'
  | 'light_brown'
  | 'blonde'
  | 'red'
  | 'auburn'
  | 'gray'
  | 'white';

export type HumanEyeShape = 'almond' | 'round' | 'hooded' | 'upturned' | 'wide';

export type HumanEyeColorId = 'dark_brown' | 'brown' | 'hazel' | 'green' | 'blue' | 'gray';

export type HumanMouthShape = 'natural' | 'smile' | 'full' | 'thin' | 'gentle';

export type HumanTopStyle = 'tshirt' | 'long_sleeve' | 'hoodie' | 'casual_shirt' | 'sweater';

export type HumanBottomStyle =
  | 'jeans'
  | 'shorts'
  | 'casual_pants'
  | 'long_pants'
  | 'skirt'
  | 'pleated_skirt';

export type HumanFootwearStyle = 'sneakers' | 'sandals' | 'slippers' | 'casual_shoes';

export interface HumanAppearance {
  name: string;
  gender: HumanGender;
  skinTone: HumanSkinToneId;
  hairStyle: HumanHairStyle;
  hairColor: HumanHairColorId;
  eyeShape: HumanEyeShape;
  eyeColor: HumanEyeColorId;
  eyeSize: number; // 0.85 .. 1.18
  mouthShape: HumanMouthShape;
  lipColor: string;
  topStyle: HumanTopStyle;
  topColor: string;
  bottomStyle: HumanBottomStyle;
  bottomColor: string;
  footwearStyle: HumanFootwearStyle;
  footwearColor: string;
}

export type HumanAnimState =
  | 'idle'
  | 'walk'
  | 'turn'
  | 'kneel_pet'
  | 'pour_food'
  | 'bottle_feed'
  | 'brush'
  | 'pour_water'
  | 'play_toy'
  | 'pickup_cat'
  | 'carry_cat'
  | 'putdown_cat'
  | 'clean_litter'
  | 'clean_room'
  | 'step_back'
  | 'tuck_sleep'
  | 'flinch';

export interface HumanRuntimeState {
  position: Vec3;
  rotationY: number;
  velocity: Vec2;
  targetPosition: Vec2 | null;
  facingTarget: Vec2 | null;
  animState: HumanAnimState;
  carryingCat: boolean;
  navStuckTimer: number;
}

export interface CatWelfareWarning {
  id: string;
  severity: 'mild' | 'escalating' | 'critical';
  type: 'water' | 'food' | 'attention' | 'health';
  messageTh: string;
  messageEn: string;
}

export interface CatSurvivalState {
  isAlive: boolean;
  dehydrationHours: number;
  malnutritionHours: number;
  criticalHealthHours: number;
  lastCareAtUtc: number;
  offlineGraceHours: number;
  warnings: CatWelfareWarning[];
  causeOfDeath?: 'dehydration' | 'malnutrition' | 'neglect';
  passedAtUtc?: number;
}

export interface CatMemorialEntry {
  id: string;
  catName: string;
  breed: CatBreed;
  ageDays: number;
  adoptedAt: number;
  passedAt: number;
  daysTogether: number;
  photoDataUrl?: string;
  bondLevel: number;
  epitaphTh: string;
  epitaphEn: string;
}

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Internal physiological variables — hunger & satiety are NEVER shown as UI bars!
 * Communicated strictly through natural feline cues, behavior, and body condition.
 */
export interface CatNeeds {
  hunger: number;     // Internal 0 (hungry) -> 100 (satiated)
  thirst: number;     // Internal 0 (thirsty) -> 100 (hydrated)
  energy: number;     // Internal 0 (exhausted) -> 100 (rested)
  happiness: number;  // Internal 0 -> 100
  hygiene: number;    // Internal 0 -> 100
  health: number;     // Internal 0 -> 100
  stress: number;     // Internal 0 (calm) -> 100 (stressed/overstimulated)
}

export interface CatWeightState {
  currentWeightKg: number;
  bodyFatIndex: number;       // -1.0 (underweight) .. 0.0 (ideal) .. +1.0 (overweight)
  condition: BodyCondition;
  metabolism: number;         // 0.85 .. 1.15 individual metabolic factor
  calorieBuffer: number;      // Pending energy balance applied gradually over time
}

export interface CatGrowthMetrics {
  stage: LifeStage;
  stageProgress: number;
  overallGrowth: number;
  bodyScale: number;
  heightRatio: number;
  bodyLengthRatio: number;
  headRatio: number;
  legRatio: number;
  pawScale: number;
  tailRatio: number;
  earRatio: number;
  eyeOpenness: number;
  coatMaturity: number;       // 0 (soft kitten down) -> 1 (full adult coat)
  coatSilvering: number;      // 0 -> 1 gentle senior muzzle/coat frosting
  activityLevel: number;      // 0.3 .. 1.35 life-stage activity & play drive
  animSpeedFactor: number;    // 0.72 .. 1.18 natural movement & animation tempo
  idealWeightKg: number;
  canWalk: boolean;
  canRun: boolean;
  canJump: boolean;
  canEatWetFood: boolean;
  canEatDryFood: boolean;
  canUseToys: boolean;
  maxMoveSpeed: number;
}

export interface CatIdentity {
  id: string;
  name: string;
  sex: CatSex;
  breed: CatBreed;
  furColorId: FurColorId;
  furColor: string;
  furSecondary: string;
  eyeColorId: EyeColorId;
  eyeColor: string;
  furPattern: FurPattern;
  equippedAccessory: AccessoryId;
  adoptedAt: number;
}

export interface CatRuntimeState {
  identity: CatIdentity;
  ageDays: number;
  lifeStage: LifeStage;
  needs: CatNeeds;
  traits: PersonalityTraits;
  emotion: CatEmotion;
  weight: CatWeightState;
  bondLevel: number;
  bondXp: number;
  level: number;
  xp: number;
  behavior: CatBehaviorState;
  behaviorTimer: number;
  position: Vec3;
  rotationY: number;
  velocity: Vec2;
  targetPosition: Vec2 | null;
  targetFurnitureId: string | null;
  jumpProgress: number;
  jumpStartY: number;
  jumpTargetY: number;
  jumpPrepTimer: number;
  jumpLandTimer: number;
  zoomieWaypointsRemaining: number;
  isPurring: boolean;
  mouthOpenAmount: number;    // 0..1 synced with vocalization, hiss, bite & yawn
  recentTouchCount: number;   // Tracks overstimulation from repeated unwanted touching
  recentTouchDecayTimer: number;
  ignoredWarningsCount: number; // Escalates toward rare defensive bite only if player ignores warnings
  calmDownUntilUtc: number;   // Post-bite calm-down timestamp (UTC ms)
  lastBiteAtUtc: number;      // Last defensive bite timestamp (UTC ms)
  vocalizationCooldown: number;
  moodRefusalCooldown: number;
}

export interface FoodCatalogItem {
  id: FoodItemId;
  nameTh: string;
  nameEn: string;
  descTh: string;
  descEn: string;
  priceCoins: number;
  packSize: number;
  minAgeDays: number;
  maxAgeDays?: number;
  satietyGain: number;
  hydrationGain: number;
  calories: number;           // Contributes gradually to body condition
  happinessGain: number;
  bondGain: number;
}

export interface AccessoryCatalogItem {
  id: Exclude<AccessoryId, 'none'>;
  nameTh: string;
  nameEn: string;
  descTh: string;
  descEn: string;
  priceCoins: number;
  colorHex: string;
}

export interface FurnitureCatalogItem {
  id: string;
  category: FurnitureCategory;
  nameTh: string;
  nameEn: string;
  descTh: string;
  descEn: string;
  priceCoins: number;
  width: number;
  depth: number;
  height: number;
  walkable: boolean;
  jumpableHeight?: number;
  wallMounted?: boolean;
  accentColor: string;
  unlockLevel: number;
  isAutoEquipment?: boolean;
}

export interface PlacedFurniture {
  instanceId: string;
  catalogId: string;
  x: number;
  z: number;
  rotationY: number;
}

export interface RoomStatus {
  foodBowlLevel: number;
  foodBowlItemId: FoodItemId;
  waterBowlLevel: number;
  litterCleanliness: number;
  roomCleanliness: number;
  tableMugKnocked: boolean;
}

export interface WaterFountainState {
  waterLevel: number;         // 0..100
  cleanliness: number;        // 0..100
  isFlowing: boolean;
}

export interface AutoFeederState {
  storedFoodId: FoodItemId;
  storedServings: number;     // 0..12 — loaded strictly from player's foodInventory!
  maxStorage: number;
  portionSize: 1 | 2;         // Servings dispensed per scheduled meal
  scheduleHours: 4 | 6 | 8;   // Feeding schedule interval
  bowlServingsLevel: number;  // 0..100 visible food in feeder tray
  lastDispensedAtUtc: number;
  dispensingAnimTimer: number;
}

export interface AutoLitterBoxState {
  wasteLevel: number;         // 0..100 (waste bin capacity)
  litterCleanliness: number;  // 0..100
  catInside: boolean;
  needsCleaning: boolean;
  cleaningProgress: number;   // 0..1 animated drum cycle
  isCleaning: boolean;
  kittenSafeLock: boolean;    // Prevents auto-rotation when cat is kitten (<57 days)
  pendingCleanDelaySec: number;
}

export interface SmartCatBedState {
  warmthLevel: number;        // 1..3 comfort warmth setting
  occupied: boolean;
}

export interface AutoCatToyState {
  enabled: boolean;
  activeSecondsRemaining: number;
  cooldownSecondsRemaining: number;
  armAngle: number;
}

export interface EquipmentStateMap {
  waterFountain: WaterFountainState;
  autoFeeder: AutoFeederState;
  autoLitterBox: AutoLitterBoxState;
  smartCatBed: SmartCatBedState;
  autoCatToy: AutoCatToyState;
}

export interface PlayerEnergyState {
  current: number;            // 0..20 (human player energy for minigames only)
  max: number;                // 20
  lastRegenAtUtc: number;     // UTC ms anchor for next +1 regen tick
  lastSeenUtc: number;        // Monotonic UTC guard against refresh/clock replay
}

export interface MinigameSession {
  sessionId: string;
  gameId: MinigameId;
  startedAtUtc: number;
  durationSec: number;
  energyDeducted: boolean;
  claimed: boolean;
}

export interface MinigameResultEntry {
  sessionId: string;
  gameId: MinigameId;
  score: number;
  tier: MinigamePerformanceTier;
  coinsEarned: number;
  completedAtUtc: number;
}

export interface DailyTask {
  id: string;
  type: 'feed' | 'play' | 'clean' | 'photo' | 'bond';
  titleTh: string;
  titleEn: string;
  progress: number;
  target: number;
  rewardCoins: number;
  rewardXp: number;
  claimed: boolean;
}

export interface Achievement {
  id: string;
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
  unlocked: boolean;
  unlockedAt?: number;
  rewardCoins: number;
}

export interface PhotoEntry {
  id: string;
  dataUrl: string;
  takenAt: number;
  catName: string;
  ageDays: number;
  lifeStage: LifeStage;
  behavior: CatBehaviorState;
}

export interface GameSettings {
  language: Language;
  quality: QualityPreset;
  soundEnabled: boolean;
  followCat: boolean;
  reduceBiteVisuals: boolean; // When true, replaces subtle blood-like bite edge with clean red warning flash
  survivalMode: SurvivalMode; // 'standard' includes balanced survival; 'casual' disables death
  offlineGraceHours: number;  // Configurable offline grace hours before survival decay starts
}

export interface SaveDataV4 {
  version: 4;
  savedAt: number;
  lastGrowthSyncAtUtc: number;
  hasCreatedHuman: boolean;
  hasAdoptedInitialCat: boolean;
  humanAppearance: HumanAppearance;
  human: HumanRuntimeState;
  cat: CatRuntimeState;
  survival: CatSurvivalState;
  memorials: CatMemorialEntry[];
  room: RoomStatus;
  equipment: EquipmentStateMap;
  coins: number;
  gems: number;
  playerEnergy: PlayerEnergyState;
  claimedRewardIds: string[];
  actionCooldowns: Record<string, number>;
  minigameHistory: MinigameResultEntry[];
  foodInventory: Record<FoodItemId, number>;
  ownedAccessories: AccessoryId[];
  ownedFurniture: Record<string, number>;
  ownedToys: ToyType[];
  placedFurniture: PlacedFurniture[];
  dailyTasks: DailyTask[];
  lastDailyResetDay: number;
  achievements: Achievement[];
  photos: PhotoEntry[];
  settings: GameSettings;
  stats: {
    totalFeeds: number;
    totalPets: number;
    totalPlays: number;
    totalCleans: number;
    totalPhotos: number;
    knocksCaused: number;
    minigamesCompleted: number;
    defensiveBites: number;
  };
}

/** Backward-compatible type aliases */
export type SaveDataV3 = SaveDataV4;
export type SaveDataV2 = SaveDataV4;
