export class BattleResolver {
  constructor(config) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.validShots = [];
    this.falseStarts = [];
  }

  registerShot(playerId, timestamp, isWindowOpen) {
    if (isWindowOpen) {
      this.validShots.push({ playerId, timestamp });
      return;
    }

    this.falseStarts.push({ playerId, timestamp });
  }

  resolve(players) {
    const byId = new Map(players.map((player) => [player.id, player]));

    if (this.validShots.length > 0) {
      const ordered = [...this.validShots].sort((a, b) => a.timestamp - b.timestamp);
      const first = ordered[0];
      const second = ordered[1];

      let winnerShot = first;

      if (second && second.timestamp - first.timestamp <= this.config.simultaneousMarginMs) {
        winnerShot = first.timestamp <= second.timestamp ? first : second;
      }

      const loser = players.find((player) => player.id !== winnerShot.playerId) ?? null;
      return {
        winner: byId.get(winnerShot.playerId) ?? null,
        loser,
        reason: "fast-shot",
        winningShot: winnerShot,
      };
    }

    if (this.config.earlyShotPenalty && this.falseStarts.length > 0) {
      const earliestFalseStart = [...this.falseStarts].sort((a, b) => a.timestamp - b.timestamp)[0];
      const winner = players.find((player) => player.id !== earliestFalseStart.playerId) ?? null;
      return {
        winner,
        loser: byId.get(earliestFalseStart.playerId) ?? null,
        reason: "false-start",
        winningShot: null,
      };
    }

    return {
      winner: null,
      loser: null,
      reason: "timeout",
      winningShot: null,
    };
  }
}
