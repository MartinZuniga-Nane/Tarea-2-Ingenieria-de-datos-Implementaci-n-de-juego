const FINGER_CHAINS = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

function point(list, index) {
  const value = list?.[index];
  return value ? { x: value.x ?? value[0], y: value.y ?? value[1], z: value.z ?? value[2] ?? 0 } : null;
}

function distance(a, b) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));
}

function fingerExtended(landmarks, [mcpIndex, pipIndex, dipIndex, tipIndex]) {
  const wrist = point(landmarks, 0);
  const mcp = point(landmarks, mcpIndex);
  const pip = point(landmarks, pipIndex);
  const dip = point(landmarks, dipIndex);
  const tip = point(landmarks, tipIndex);

  if (!wrist || !mcp || !pip || !dip || !tip) {
    return false;
  }

  return distance(tip, wrist) > distance(pip, wrist) && distance(dip, wrist) > distance(mcp, wrist) * 0.9;
}

function thumbExtended(landmarks) {
  const tip = point(landmarks, 4);
  const ip = point(landmarks, 3);
  const mcp = point(landmarks, 2);
  if (!tip || !ip || !mcp) {
    return false;
  }

  return Math.abs(tip.x - mcp.x) > Math.abs(ip.x - mcp.x) * 0.95;
}

function getLandmarks(prediction) {
  return prediction?.landmarks || prediction?.keypoints || prediction?.keypoints3D || null;
}

function getExtendedFingers(landmarks) {
  return {
    thumb: thumbExtended(landmarks),
    index: fingerExtended(landmarks, FINGER_CHAINS.index),
    middle: fingerExtended(landmarks, FINGER_CHAINS.middle),
    ring: fingerExtended(landmarks, FINGER_CHAINS.ring),
    pinky: fingerExtended(landmarks, FINGER_CHAINS.pinky),
  };
}

function estimateDirection(landmarks) {
  const pip = point(landmarks, 6);
  const tip = point(landmarks, 8);
  if (!pip || !tip) {
    return { direction: null, intensity: 0 };
  }

  const dx = tip.x - pip.x;
  const dy = Math.abs(tip.y - pip.y);
  const horizontalIntent = Math.abs(dx) - dy;

  if (horizontalIntent < 10) {
    return { direction: null, intensity: 0 };
  }

  return {
    direction: dx < 0 ? "LEFT_INDEX" : "RIGHT_INDEX",
    intensity: Math.min(1, Math.abs(dx) / 70),
  };
}

export class GestureInterpreter {
  interpret(prediction) {
    const landmarks = getLandmarks(prediction);
    if (!landmarks || landmarks.length < 21) {
      return { label: "NONE", confidence: 0, landmarks: null, details: null };
    }

    const fingers = getExtendedFingers(landmarks);
    const openCount = Object.values(fingers).filter(Boolean).length;
    const direction = estimateDirection(landmarks);
    let label = "NONE";
    let confidence = 0.45;

    if (openCount >= 4 && fingers.index && fingers.middle && fingers.ring && fingers.pinky) {
      label = "OPEN_PALM";
      confidence = 0.95;
    } else if (fingers.index && !fingers.middle && !fingers.ring && !fingers.pinky) {
      label = direction.direction ?? "NONE";
      confidence = direction.intensity || 0.68;
    } else if (fingers.index && fingers.middle && !fingers.ring && !fingers.pinky) {
      label = "TWO_FINGERS";
      confidence = 0.86;
    } else if (fingers.index && fingers.middle && fingers.ring && !fingers.pinky) {
      label = "THREE_FINGERS";
      confidence = 0.88;
    }

    return {
      label,
      confidence,
      landmarks,
      details: { fingers, openCount },
    };
  }
}
