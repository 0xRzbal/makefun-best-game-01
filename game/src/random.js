// A small seeded random number generator (mulberry32): the same seed gives the same game, which
// is what makes the screenshot scenes repeatable. `spread` returns a value in [-1, 1].

export function createRandom(seed) {
  let a = seed | 0;
  function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    spread() {
      return next() * 2 - 1;
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}
