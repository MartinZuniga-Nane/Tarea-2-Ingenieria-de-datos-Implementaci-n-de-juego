export const AnimationSystem = {
  easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  },

  lerp(start, end, amount) {
    return start + (end - start) * amount;
  },

  approach(current, target, rate, dt) {
    return current + (target - current) * Math.min(1, rate * (dt / 1000));
  },

  normalized(elapsed, duration) {
    if (duration <= 0) {
      return 1;
    }

    return Math.max(0, Math.min(1, elapsed / duration));
  },
};
