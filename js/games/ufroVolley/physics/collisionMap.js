export function createCourtCollisionMap(config) {
  const groundPoints = [
    { x: 112, y: 862 },
    { x: 250, y: 860 },
    { x: 410, y: 857 },
    { x: 560, y: 854 },
    { x: 720, y: 851 },
    { x: 860, y: 850 },
    { x: 920, y: 850 },
    { x: 1000, y: 850 },
    { x: 1060, y: 850 },
    { x: 1200, y: 851 },
    { x: 1360, y: 854 },
    { x: 1510, y: 857 },
    { x: 1670, y: 860 },
    { x: 1810, y: 862 },
  ];

  const groundSegments = [];
  for (let index = 0; index < groundPoints.length - 1; index += 1) {
    groundSegments.push({
      a: groundPoints[index],
      b: groundPoints[index + 1],
    });
  }

  const floorYAtNet = sampleGroundYFromPoints(groundPoints, config.net.x);
  const netTop = config.net.y - config.net.height / 2;
  const netBottom = config.net.y + config.net.height / 2;

  return {
    groundPoints,
    groundSegments,
    leftFloorBounds: {
      minX: config.formation.leftBoundary,
      maxX: config.net.x - config.formation.midlinePadding,
    },
    rightFloorBounds: {
      minX: config.net.x + config.formation.midlinePadding,
      maxX: config.formation.rightBoundary,
    },
    netCollider: {
      x: config.net.x,
      y: config.net.y,
      width: config.net.width,
      height: config.net.height,
      restitution: config.net.restitution,
    },
    netFloorCollider: {
      x: config.net.x,
      y: netBottom + (floorYAtNet - netBottom) / 2,
      width: config.render.netPost.extensionWidth,
      height: floorYAtNet - netBottom + 12,
      restitution: config.net.restitution,
    },
    ballBounds: {
      left: config.formation.leftBoundary,
      right: config.formation.rightBoundary,
      top: netTop,
    },
  };
}

function sampleGroundYFromPoints(points, x) {
  if (x <= points[0].x) {
    return points[0].y;
  }

  if (x >= points[points.length - 1].x) {
    return points[points.length - 1].y;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (x >= start.x && x <= end.x) {
      const amount = (x - start.x) / (end.x - start.x || 1);
      return start.y + (end.y - start.y) * amount;
    }
  }

  return points[points.length - 1].y;
}

export function sampleGroundY(collisionMap, x) {
  const points = collisionMap.groundPoints;
  if (x <= points[0].x) {
    return points[0].y;
  }

  if (x >= points[points.length - 1].x) {
    return points[points.length - 1].y;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (x >= start.x && x <= end.x) {
      const amount = (x - start.x) / (end.x - start.x || 1);
      return start.y + (end.y - start.y) * amount;
    }
  }

  return points[points.length - 1].y;
}
