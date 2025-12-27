AFRAME.registerComponent('desktop-controls', {
  schema: {
    enabled: {default: true},
    handOffsetX: {default: 0.25},
    handOffsetY: {default: 1.2},
    handOffsetZ: {default: -0.5},
    handStep: {default: 0.05}
  },

  init: function () {
    this.inputMode = AFRAME.utils.getUrlParameter('input') || 'desktop';
    this.isEnabled = this.data.enabled && this.inputMode === 'desktop';
    if (!this.isEnabled) { return; }

    this.leftHand = document.getElementById('leftHand');
    this.rightHand = document.getElementById('rightHand');
    this.camera = document.getElementById('camera');
    this.cameraWorldPosition = new THREE.Vector3();
    this.handOffset = new THREE.Vector3();
    this.handPosition = new THREE.Vector3();
    this.leftOffset = new THREE.Vector3(-this.data.handOffsetX, this.data.handOffsetY, this.data.handOffsetZ);
    this.rightOffset = new THREE.Vector3(this.data.handOffsetX, this.data.handOffsetY, this.data.handOffsetZ);
    this.rightDelta = new THREE.Vector3();
    this.leftDelta = new THREE.Vector3();
    this.keysDown = new Set();
    this.didEmitConnected = false;

    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    window.addEventListener('contextmenu', evt => evt.preventDefault());
  },

  onKeyDown: function (evt) {
    this.keysDown.add(evt.code);
    if (evt.code === 'Space' && this.rightHand) {
      this.rightHand.emit('triggerdown');
    }
    if (evt.code === 'ShiftLeft' && this.leftHand) {
      this.leftHand.emit('triggerdown');
    }
  },

  onKeyUp: function (evt) {
    this.keysDown.delete(evt.code);
    if (evt.code === 'Space' && this.rightHand) {
      this.rightHand.emit('triggerup');
    }
    if (evt.code === 'ShiftLeft' && this.leftHand) {
      this.leftHand.emit('triggerup');
    }
  },

  onMouseDown: function (evt) {
    if (!this.rightHand) { return; }
    if (evt.button === 0) { this.rightHand.emit('triggerdown'); }
    if (evt.button === 2 && this.rightHand) { this.rightHand.emit('gripdown'); }
  },

  onMouseUp: function (evt) {
    if (!this.rightHand) { return; }
    if (evt.button === 0) { this.rightHand.emit('triggerup'); }
    if (evt.button === 2 && this.rightHand) { this.rightHand.emit('gripup'); }
  },

  emitControllerConnected: function () {
    const payload = {name: 'desktop-controls'};
    if (this.leftHand) {
      this.leftHand.emit('controllerconnected', payload);
    }
    if (this.rightHand) {
      this.rightHand.emit('controllerconnected', payload);
    }
    this.didEmitConnected = true;
  },

  tick: function () {
    if (!this.isEnabled) { return; }

    if (!this.didEmitConnected) {
      this.emitControllerConnected();
    }

    if (this.camera && this.camera.object3D) {
      this.camera.object3D.getWorldPosition(this.cameraWorldPosition);
    }

    if (this.leftHand) {
      this.handPosition.copy(this.cameraWorldPosition).add(this.leftOffset);
      if (this.leftHand.object3D.parent) {
        this.leftHand.object3D.parent.worldToLocal(this.handPosition);
      }
      this.leftHand.object3D.position.copy(this.handPosition).add(this.leftDelta);
    }

    if (this.rightHand) {
      this.handPosition.copy(this.cameraWorldPosition).add(this.rightOffset);
      if (this.rightHand.object3D.parent) {
        this.rightHand.object3D.parent.worldToLocal(this.handPosition);
      }
      this.rightHand.object3D.position.copy(this.handPosition).add(this.rightDelta);
    }

    this.applyHandMovement();
  },

  applyHandMovement: function () {
    const step = this.data.handStep;

    if (this.keysDown.has('KeyI')) { this.rightDelta.z -= step; }
    if (this.keysDown.has('KeyK')) { this.rightDelta.z += step; }
    if (this.keysDown.has('KeyJ')) { this.rightDelta.x -= step; }
    if (this.keysDown.has('KeyL')) { this.rightDelta.x += step; }
    if (this.keysDown.has('KeyU')) { this.rightDelta.y += step; }
    if (this.keysDown.has('KeyO')) { this.rightDelta.y -= step; }

    if (this.keysDown.has('KeyW')) { this.leftDelta.z -= step; }
    if (this.keysDown.has('KeyS')) { this.leftDelta.z += step; }
    if (this.keysDown.has('KeyA')) { this.leftDelta.x -= step; }
    if (this.keysDown.has('KeyD')) { this.leftDelta.x += step; }
    if (this.keysDown.has('KeyQ')) { this.leftDelta.y += step; }
    if (this.keysDown.has('KeyE')) { this.leftDelta.y -= step; }

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    this.rightDelta.x = clamp(this.rightDelta.x, -1, 1);
    this.rightDelta.y = clamp(this.rightDelta.y, -1, 1);
    this.rightDelta.z = clamp(this.rightDelta.z, -1, 1);
    this.leftDelta.x = clamp(this.leftDelta.x, -1, 1);
    this.leftDelta.y = clamp(this.leftDelta.y, -1, 1);
    this.leftDelta.z = clamp(this.leftDelta.z, -1, 1);
  }
});
