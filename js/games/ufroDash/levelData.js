const TILE = 56;

function block(x, y, width = 1, height = 1) {
  return { type: "block", x, y, width: width * TILE, height: height * TILE };
}

function spike(x, y, count = 1) {
  return { type: "spike", x, y, width: count * TILE, height: TILE, count };
}

function pillar(x, topY, floors = 1) {
  return Array.from({ length: floors }, (_, index) => block(x, topY + index * TILE));
}

function flat(x, count) {
  return block(x, 534, count, 1);
}

export const ufroDashLevel = {
  tile: TILE,
  speed: 560,
  gravity: 3200,
  jumpVelocity: -1040,
  groundY: 590,
  playerStartX: 180,
  playerSize: 48,
  levelEndPadding: 640,
  obstacles: [
    spike(1120, 534),
    spike(1520, 534, 2),
    flat(1928, 1),
    spike(2336, 534),

    ...pillar(2728, 478, 2),
    flat(3144, 2),
    spike(3580, 534, 2),

    ...pillar(4004, 478, 2),
    flat(4420, 6),
    ...pillar(4836, 422, 3),
    spike(5288, 534, 2),

    flat(5724, 3),
    spike(6204, 534, 3),
    ...pillar(6684, 478, 2),
    flat(7100, 2),

    spike(7544, 534, 2),
    flat(7968, 1),
    ...pillar(8360, 422, 2),
    spike(8812, 534, 2),
    flat(9248, 3),
  ],
};

ufroDashLevel.length = Math.max(
  ...ufroDashLevel.obstacles.map((obstacle) => obstacle.x + obstacle.width),
) + ufroDashLevel.levelEndPadding;
