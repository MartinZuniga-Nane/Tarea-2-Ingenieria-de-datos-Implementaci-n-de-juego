export class CooldownMap {
  constructor(definitions = {}) {
    this.definitions = definitions;
    this.lastTriggerAt = new Map();
  }

  canTrigger(group, now = performance.now()) {
    const cooldown = this.definitions[group] ?? 0;
    const last = this.lastTriggerAt.get(group) ?? -Infinity;
    return now - last >= cooldown;
  }

  trigger(group, now = performance.now()) {
    this.lastTriggerAt.set(group, now);
  }
}
