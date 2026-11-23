export type Language = 'th' | 'en';
export type QualityPreset = 'low' | 'medium' | 'high';

export type LifeStage =
  | 'newborn'
  | 'baby_kitten'
  | 'young_kitten'
  | 'adolescent'
  | 'adult';

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

export type BodyCondition = 'underweight' | 'lean' | 'healthy' | 'overweight';

export type CatBehaviorState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sit'
  | 'sleep'
  | 'stretch'
  | 'groom'
  | 'eat'
  | 'drink'
  | 'explore'
  | 'play'
  | 'approach_player'
  | 'hide'
  | 'observe'
  | 'jump'
  | 'react_to_sound'
  | 'knead'
  | 'head_bunt'
  | 'pounce_crouch'
  | 'hiss_defend'
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

export type MinigameId = 'fishing' | 'matching' | 'clean_room';

export type ActiveTab = 'care' | 'food' | 'play' | 'shop' | 'minigames';

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
  headRatio: number;
  legRatio: number;
  tailRatio: number;
  earRatio: number;
  eyeOpenness: number;
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
  isPurring: boolean;
  mouthOpenAmount: number;    // 0..1 synced with vocalization & yawn
  recentTouchCount: number;   // Tracks overstimulation from repeated unwanted touching
  recentTouchDecayTimer: number;
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
  timeScale: 1 | 5 | 20;
  followCat: boolean;
}

export interface SaveDataV2 {
  version: 2;
  savedAt: number;
  hasAdoptedInitialCat: boolean;
  cat: CatRuntimeState;
  room: RoomStatus;
  coins: number;
  gems: number;
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
  };
}
