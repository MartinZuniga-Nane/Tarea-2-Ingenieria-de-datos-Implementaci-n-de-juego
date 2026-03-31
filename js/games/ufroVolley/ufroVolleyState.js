export class UfroVolleyState {
  constructor(config) {
    this.config = config;
    this.resetMatch();
  }

  resetMatch() {
    this.score = { left: 0, right: 0 };
    this.servingTeam = "left";
    this.lastPointWinner = null;
    this.matchWinner = null;
    this.phase = "menu";
    this.round = 1;
  }

  setPhase(phase) {
    this.phase = phase;
  }

  awardPoint(team) {
    if (!this.score[team] && this.score[team] !== 0) {
      return;
    }

    this.score[team] += 1;
    this.lastPointWinner = team;
    this.round += 1;

    if (this.hasWinner()) {
      this.setMatchWinner(team);
    }
  }

  hasWinner() {
    return this.score.left >= this.config.match.pointsToWin || this.score.right >= this.config.match.pointsToWin;
  }

  setServingTeam(team) {
    this.servingTeam = team;
  }

  swapServe() {
    this.servingTeam = this.servingTeam === "left" ? "right" : "left";
  }

  setMatchWinner(team) {
    this.matchWinner = team;
  }
}
