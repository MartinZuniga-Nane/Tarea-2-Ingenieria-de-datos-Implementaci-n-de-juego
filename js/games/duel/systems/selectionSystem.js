export class SelectionSystem {
  constructor({ rows }) {
    this.rows = rows;
    this.rowIndex = 0;
    this.columnIndexes = rows.map(() => 0);
  }

  moveLeft() {
    this.columnIndexes[this.rowIndex] = (this.columnIndexes[this.rowIndex] - 1 + this.rows[this.rowIndex]) % this.rows[this.rowIndex];
  }

  moveRight() {
    this.columnIndexes[this.rowIndex] = (this.columnIndexes[this.rowIndex] + 1) % this.rows[this.rowIndex];
  }

  moveUp() {
    this.rowIndex = (this.rowIndex - 1 + this.rows.length) % this.rows.length;
  }

  moveDown() {
    this.rowIndex = (this.rowIndex + 1) % this.rows.length;
  }

  getSelection() {
    return {
      rowIndex: this.rowIndex,
      columnIndexes: [...this.columnIndexes],
    };
  }
}
