// Seal signatures are heuristic approximations of the 12 canon hand seals.
// Feature keys: fingers = [thumb, index, middle, ring, pinky], 1 extended / 0 curled.
// verticalOffset: hand A above hand B (normalised by hand size). palmGap: palms apart.
// Calibrated templates (Settings → Calibrate) override these per device.

export const SEALS = [
  {
    id: "tiger", name: "Tiger", romaji: "Tora", kanji: "寅", emoji: "🐯",
    hint: "Palms together, index and middle fingers of both hands extended straight up and pressed together; other fingers interlaced.",
    sig: { fingersA: [0, 1, 1, 0, 0], fingersB: [0, 1, 1, 0, 0], palmGap: 0, verticalOffset: 0 },
  },
  {
    id: "ram", name: "Ram", romaji: "Hitsuji", kanji: "未", emoji: "🐏",
    hint: "Like Tiger, but the left hand sits higher — index and middle of both hands extended, left fingertips resting above the right.",
    sig: { fingersA: [1, 1, 1, 0, 0], fingersB: [0, 1, 1, 0, 0], palmGap: 0, verticalOffset: 0.5 },
  },
  {
    id: "snake", name: "Snake", romaji: "Mi", kanji: "巳", emoji: "🐍",
    hint: "Fingers of both hands fully interlaced and folded down, palms pressed together — like a tight prayer clasp.",
    sig: { fingersA: [0, 0, 0, 0, 0], fingersB: [0, 0, 0, 0, 0], palmGap: 0, verticalOffset: 0 },
  },
  {
    id: "rat", name: "Rat", romaji: "Ne", kanji: "子", emoji: "🐭",
    hint: "Left index and middle fingers extended upward; right hand wraps around them in a fist.",
    sig: { fingersA: [0, 1, 1, 0, 0], fingersB: [0, 0, 0, 0, 0], palmGap: 0, verticalOffset: 0.3, either: true },
  },
  {
    id: "ox", name: "Ox", romaji: "Ushi", kanji: "丑", emoji: "🐂",
    hint: "Right hand horizontal, left hand vertical, fingers of both hands extended and interlocked at right angles.",
    sig: { fingersA: [1, 1, 1, 1, 1], fingersB: [1, 1, 1, 1, 1], palmGap: 0, verticalOffset: 0, crossed: true },
  },
  {
    id: "hare", name: "Hare", romaji: "U", kanji: "卯", emoji: "🐰",
    hint: "Left hand in a fist with the pinky extended; right hand cups beneath it, thumb and fingers loosely curled.",
    sig: { fingersA: [0, 0, 0, 0, 1], fingersB: [1, 0, 0, 0, 0], palmGap: 0, verticalOffset: 0.4, either: true },
  },
  {
    id: "dragon", name: "Dragon", romaji: "Tatsu", kanji: "辰", emoji: "🐲",
    hint: "Hands stacked with fingers interlaced and folded, both thumbs extended upward like spines.",
    sig: { fingersA: [1, 0, 0, 0, 0], fingersB: [1, 0, 0, 0, 0], palmGap: 0, verticalOffset: 0.2 },
  },
  {
    id: "horse", name: "Horse", romaji: "Uma", kanji: "午", emoji: "🐴",
    hint: "Index fingers extended and pressed together forming a peak; other fingers bent, knuckles touching, elbows out.",
    sig: { fingersA: [0, 1, 0, 0, 0], fingersB: [0, 1, 0, 0, 0], palmGap: 0, verticalOffset: 0 },
  },
  {
    id: "monkey", name: "Monkey", romaji: "Saru", kanji: "申", emoji: "🐵",
    hint: "Both hands flat and horizontal, one resting on top of the other, thumbs sticking out to the sides.",
    sig: { fingersA: [1, 1, 1, 1, 1], fingersB: [1, 1, 1, 1, 1], palmGap: 0, verticalOffset: 0.3, flat: true },
  },
  {
    id: "bird", name: "Bird", romaji: "Tori", kanji: "酉", emoji: "🐦",
    hint: "Fingertips of both hands touch in an arch — thumbs and pinkies meet below, middle fingers fold inward like a bird's beak.",
    sig: { fingersA: [1, 1, 0, 1, 1], fingersB: [1, 1, 0, 1, 1], palmGap: 0.4, verticalOffset: 0 },
  },
  {
    id: "dog", name: "Dog", romaji: "Inu", kanji: "戌", emoji: "🐶",
    hint: "Left hand flat, palm down, resting on top of the right fist.",
    sig: { fingersA: [1, 1, 1, 1, 1], fingersB: [0, 0, 0, 0, 0], palmGap: 0, verticalOffset: 0.4, either: true, flat: true },
  },
  {
    id: "boar", name: "Boar", romaji: "I", kanji: "亥", emoji: "🐗",
    hint: "Both hands horizontal, palms facing you, fingers curled with both wrists pressed together.",
    sig: { fingersA: [0, 0, 0, 0, 0], fingersB: [0, 0, 0, 0, 0], palmGap: 0.3, verticalOffset: 0, flat: true },
  },
];

export const JUTSUS = [
  {
    id: "transformation", name: "Transformation Jutsu", romaji: "Henge no Jutsu",
    rank: "genin", seq: ["dog", "boar", "ram"],
    blurb: "The Academy classic — take on any appearance.",
  },
  {
    id: "clone", name: "Clone Jutsu", romaji: "Bunshin no Jutsu",
    rank: "genin", seq: ["ram", "snake", "tiger"],
    blurb: "Create intangible copies of yourself.",
  },
  {
    id: "fireball", name: "Fireball Jutsu", romaji: "Katon: Gōkakyū no Jutsu",
    rank: "chunin", seq: ["snake", "ram", "monkey", "boar", "horse", "tiger"],
    blurb: "The Uchiha rite of passage — exhale a roaring sphere of flame.",
  },
  {
    id: "summoning", name: "Summoning Jutsu", romaji: "Kuchiyose no Jutsu",
    rank: "chunin", seq: ["boar", "dog", "bird", "monkey", "ram"],
    blurb: "Call a contracted beast to the battlefield.",
  },
  {
    id: "chidori", name: "Chidori", romaji: "Chidori",
    rank: "jonin", seq: ["ox", "hare", "monkey"],
    blurb: "One Thousand Birds — lightning concentrated in the palm.",
  },
  {
    id: "water-dragon", name: "Water Dragon Jutsu", romaji: "Suiton: Suiryūdan no Jutsu",
    rank: "kage", seq: ["ox", "monkey", "hare", "rat", "boar", "bird", "ox", "horse", "snake", "dragon"],
    blurb: "Condensed from its legendary forty-four seals. Speed and precision, Hokage-style.",
  },
];

export const RANKS = [
  { id: "academy", name: "Academy Student", icon: "🎓" },
  { id: "genin", name: "Genin", icon: "🍃" },
  { id: "chunin", name: "Chunin", icon: "🛡️" },
  { id: "jonin", name: "Jonin", icon: "⚡" },
  { id: "kage", name: "Kage", icon: "🔥" },
];

export const XP = { sealLesson: 25, jutsu: { genin: 50, chunin: 80, jonin: 120, kage: 200 } };

export function sealById(id) {
  return SEALS.find((s) => s.id === id);
}

export function jutsusForRank(rankId) {
  return JUTSUS.filter((j) => j.rank === rankId);
}
