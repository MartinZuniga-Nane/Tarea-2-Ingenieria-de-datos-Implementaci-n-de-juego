export class StateMachine {
  constructor(initialState, transitions = {}) {
    this.state = initialState;
    this.transitions = transitions;
    this.changedAt = performance.now();
  }

  canTransition(nextState) {
    const allowed = this.transitions[this.state];
    return !allowed || allowed.includes(nextState);
  }

  transition(nextState) {
    if (nextState === this.state || !this.canTransition(nextState)) {
      return false;
    }

    this.state = nextState;
    this.changedAt = performance.now();
    return true;
  }

  timeInState(now = performance.now()) {
    return now - this.changedAt;
  }
}
