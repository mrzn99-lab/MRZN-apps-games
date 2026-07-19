/* ===================================================================
   MRZN APPS & GAMES — REVIEW MODERATION FILTER
   Runs entirely in the browser before a review is submitted.
   Flags (doesn't block) suspicious reviews so they wait for admin
   approval instead of showing publicly right away.
   =================================================================== */

// Keep this list short and generic — expand it later based on what
// actually shows up in flagged reviews.
const BAD_WORDS = [
  "spam", "scam", "fuck", "shit", "bitch", "asshole", "bastard",
  "porn", "sex", "nude", "escort", "casino", "betting", "loan",
  "crypto giveaway", "click here", "free money", "whatsapp me",
];

function containsProfanity(text) {
  const lower = text.toLowerCase();
  return BAD_WORDS.some((word) => lower.includes(word));
}

function containsSpamLink(text) {
  // any http(s):// or www. or a bare domain-looking pattern
  return /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|xyz|info|biz)\b)/i.test(text);
}

function isExcessiveCaps(text) {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 12) return false;
  const upper = letters.replace(/[^A-Z]/g, "");
  return upper.length / letters.length > 0.7; // more than 70% caps
}

function isRepeatedChars(text) {
  return /(.)\1{6,}/.test(text); // same character repeated 7+ times, e.g. "!!!!!!!"
}

/**
 * Checks a review comment and returns whether it should be auto-flagged
 * for admin review instead of shown publicly right away.
 * Returns { flagged: boolean, reason: string|null }
 */
function moderateReview(text) {
  if (!text || !text.trim()) return { flagged: false, reason: null };

  if (containsProfanity(text)) return { flagged: true, reason: "profanity" };
  if (containsSpamLink(text)) return { flagged: true, reason: "link/spam" };
  if (isExcessiveCaps(text)) return { flagged: true, reason: "excessive caps" };
  if (isRepeatedChars(text)) return { flagged: true, reason: "spam pattern" };

  return { flagged: false, reason: null };
}
