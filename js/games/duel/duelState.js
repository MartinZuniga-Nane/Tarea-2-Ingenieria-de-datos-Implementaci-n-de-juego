export class DuelState {
  constructor(config) {
    this.config = config;
    this.resetRun();
  }

  resetRun() {
    this.hasSeenControls = false;
    this.selectedPlayers = {
      left: { modelId: "luffy" },
      right: { modelId: "ace" },
    };
    this.selectedStage = "bg1";
    this.lastBattle = null;
  }

  setPlayer(slot, selection) {
    this.selectedPlayers[slot] = { ...selection };
  }

  setStage(stageId) {
    this.selectedStage = stageId;
  }

  setBattleResult(result) {
    this.lastBattle = result;
  }
}
