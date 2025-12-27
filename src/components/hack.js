AFRAME.registerComponent('hack', {
  play: function () {
    if (process.env.NODE_ENV !== 'production') { return; }
    const inputMode = AFRAME.utils.getUrlParameter('input');
    if (inputMode !== 'vr') { return; }
    const interval = setInterval(() => {
      if (!this.el.sceneEl.is('vr-mode')) {
        this.el.sceneEl.enterVR();
        clearInterval(interval);
      }
    }, 1000);
  }
});
