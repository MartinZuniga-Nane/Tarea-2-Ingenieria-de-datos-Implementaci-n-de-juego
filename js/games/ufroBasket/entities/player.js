export class BasketPlayer {
  constructor(config, assets) {
    this.config = config;
    this.assets = assets;
    this.floorX = config.player.floorX;
    this.floorY = config.player.floorY;
    this.scale = config.player.scale;
    this.pose = "idle";
    this.poseUntil = 0;
  }

  reset() {
    this.pose = "idle";
    this.poseUntil = 0;
  }

  setPose(pose, durationMs = 0, now = performance.now()) {
    this.pose = pose;
    this.poseUntil = durationMs > 0 ? now + durationMs : 0;
  }

  update(now = performance.now()) {
    if (this.pose === "release" && this.poseUntil > 0 && now >= this.poseUntil) {
      this.pose = "idle";
      this.poseUntil = 0;
    }
  }

  getImage() {
    return this.assets.player[this.pose] ?? this.assets.player.idle ?? null;
  }

  getRenderState() {
    const image = this.getImage();
    const width = image ? image.width * this.scale : 120;
    const height = image ? image.height * this.scale : 220;
    return {
      image,
      width,
      height,
      left: this.floorX - width / 2,
      top: this.floorY - height,
    };
  }

  getHandPosition() {
    const anchor = this.config.render.poseAnchors[this.pose] ?? this.config.render.poseAnchors.idle;
    const render = this.getRenderState();
    return {
      x: render.left + anchor.x * render.width,
      y: render.top + anchor.y * render.height,
    };
  }
}
