AFRAME.registerComponent('gamepad-hand-tracking', {
  schema: {
    crouchHeight: {default: 1.0},
    enabled: {default: true},
    handOffsetX: {default: 0.25},
    handOffsetY: {default: 1.3},
    handOffsetZ: {default: -0.5},
    standHeight: {default: 1.6},
    strafeDistance: {default: 0.6}
  },

  init: function () {
    this.handOrientation = new THREE.Quaternion();
    this.handPosition = new THREE.Vector3();
    this.handOffset = new THREE.Vector3();
    this.cameraWorldPosition = new THREE.Vector3();
    this.inputMode = AFRAME.utils.getUrlParameter('input') || 'vr';
    this.isEnabled = this.data.enabled && this.inputMode === 'gamepad';
    this.leftIndex = null;
    this.rightIndex = null;
    this.leftHand = document.getElementById('leftHand');
    this.rightHand = document.getElementById('rightHand');
    this.cameraRig = document.getElementById('cameraRig');
    this.camera = document.getElementById('camera');
    this.prevButtonStates = new Map();
    this.strafeX = 0;
    this.rigY = this.data.standHeight;
    this.didEmitConnected = false;

    if (!this.isEnabled) { return; }
  },

  tick: function () {
    if (!this.isEnabled) { return; }

    if (!this.didEmitConnected) {
      this.emitControllerConnected();
    }

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (!gamepads) { return; }

    this.assignGamepads(gamepads);

    const leftGamepad = this.leftIndex !== null ? gamepads[this.leftIndex] : null;
    const rightGamepad = this.rightIndex !== null ? gamepads[this.rightIndex] : null;

    if (leftGamepad && this.leftHand) {
      this.updateHand(leftGamepad, this.leftHand, -1);
    }

    if (rightGamepad && this.rightHand) {
      this.updateHand(rightGamepad, this.rightHand, 1);
    }

    const movementPad = leftGamepad || rightGamepad;
    if (movementPad) {
      this.updateRig(leftGamepad, rightGamepad);
      this.handlePause(movementPad);
    }
  },

  emitControllerConnected: function () {
    const payload = {name: 'gamepad-controls'};
    if (this.leftHand) {
      this.leftHand.emit('controllerconnected', payload);
    }
    if (this.rightHand) {
      this.rightHand.emit('controllerconnected', payload);
    }
    this.didEmitConnected = true;
  },

  assignGamepads: function (gamepads) {
    if (this.leftIndex !== null && this.rightIndex !== null) { return; }

    let left = null;
    let right = null;

    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];
      if (!gamepad) { continue; }
      if (gamepad.hand === 'left') { left = i; }
      if (gamepad.hand === 'right') { right = i; }
    }

    if (left === null || right === null) {
      const available = [];
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) { available.push(i); }
      }
      if (left === null && available.length > 0) { left = available[0]; }
      if (right === null && available.length > 1) { right = available[1]; }
      if (right === null && available.length === 1) { right = available[0]; }
    }

    this.leftIndex = left;
    this.rightIndex = right;
  },

  updateHand: function (gamepad, handEl, side) {
    const pose = gamepad.pose;
    const handObject = handEl.object3D;

    if (pose && pose.orientation) {
      this.handOrientation.fromArray(pose.orientation);
      handObject.quaternion.copy(this.handOrientation);
    }

    if (this.camera && this.camera.object3D) {
      this.camera.object3D.getWorldPosition(this.cameraWorldPosition);
    }

    this.handOffset.set(this.data.handOffsetX * side, this.data.handOffsetY, this.data.handOffsetZ);
    this.handPosition.copy(this.cameraWorldPosition).add(this.handOffset);

    if (pose && pose.position) {
      this.handPosition.x += pose.position[0];
      this.handPosition.y += pose.position[1];
      this.handPosition.z += pose.position[2];
    }

    if (handObject.parent) {
      handObject.parent.worldToLocal(this.handPosition);
    }
    handObject.position.copy(this.handPosition);

    this.handleTrigger(gamepad, handEl);
  },

  updateRig: function (leftGamepad, rightGamepad) {
    if (!this.cameraRig) { return; }

    const leftAxisX = this.getAxisValue(leftGamepad, 0);
    const rightAxisX = rightGamepad
      ? this.getAxisValue(rightGamepad, 0)
      : this.getAxisValue(leftGamepad, 2);
    let axisX = leftAxisX + rightAxisX;
    axisX = THREE.MathUtils.clamp(axisX, -1, 1);
    const targetStrafe = axisX * this.data.strafeDistance;

    this.strafeX = THREE.MathUtils.lerp(this.strafeX, targetStrafe, 0.2);

    const leftAxisY = this.getAxisValue(leftGamepad, 1);
    const rightAxisY = rightGamepad
      ? this.getAxisValue(rightGamepad, 1)
      : this.getAxisValue(leftGamepad, 3);
    const crouchAmount = Math.max(0, leftAxisY, rightAxisY);
    const targetY = THREE.MathUtils.lerp(
      this.data.standHeight,
      this.data.crouchHeight,
      THREE.MathUtils.clamp(crouchAmount, 0, 1)
    );
    this.rigY = THREE.MathUtils.lerp(this.rigY, targetY, 0.2);

    this.cameraRig.object3D.position.x = this.strafeX;
    this.cameraRig.object3D.position.y = this.rigY;
  },

  handleTrigger: function (gamepad, handEl) {
    const triggerPressed = this.isButtonPressed(gamepad, 0);
    const key = `${gamepad.index}-trigger`;
    const wasPressed = this.prevButtonStates.get(key);

    if (triggerPressed && !wasPressed) {
      handEl.emit('triggerdown');
    }
    if (!triggerPressed && wasPressed) {
      handEl.emit('triggerup');
    }

    this.prevButtonStates.set(key, triggerPressed);
  },

  handlePause: function (gamepad) {
    if (!this.rightHand) { return; }
    const pausePressed = this.isButtonPressed(gamepad, 9);
    const key = `${gamepad.index}-pause`;
    const wasPressed = this.prevButtonStates.get(key);

    if (pausePressed && !wasPressed) {
      this.rightHand.emit('thumbstickdown');
    }

    this.prevButtonStates.set(key, pausePressed);
  },

  isButtonPressed: function (gamepad, index) {
    if (!gamepad.buttons || !gamepad.buttons[index]) { return false; }
    return gamepad.buttons[index].pressed;
  },

  getAxisValue: function (gamepad, index) {
    if (!gamepad || !gamepad.axes || gamepad.axes[index] === undefined) { return 0; }
    const value = gamepad.axes[index];
    return Math.abs(value) > 0.2 ? value : 0;
  }
});
