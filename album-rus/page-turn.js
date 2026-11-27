{
  const stage = document.querySelector('#album-turn');
  const left = document.querySelector('#album-left');
  const right = document.querySelector('#album-right');
  const front = document.querySelector('#album-front');
  const back = document.querySelector('#album-back');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const spreads = pages.map(page => {
    const spread = new Image();
    spread.src = page.src;
    return spread;
  });
  let turn;
  let frame = 0;

  function paint(progress) {
    turn.progress = progress;
    stage.style.setProperty('--turn-angle', (-turn.direction * 180 * progress) + 'deg');
    stage.style.setProperty('--turn-shade', String(.25 + .67 * Math.sin(progress * Math.PI)));
  }

  function start(index) {
    const direction = index > current ? 1 : -1;
    const from = 'url("' + spreads[current].src + '")';
    const to = 'url("' + spreads[index].src + '")';
    turn = {index, from: current, direction, halfWidth: pageOpen.getBoundingClientRect().width / 2};
    left.style.backgroundImage = direction === 1 ? from : to;
    right.style.backgroundImage = direction === 1 ? to : from;
    front.style.backgroundImage = from;
    back.style.backgroundImage = to;
    stage.classList.toggle('is-backward', direction === -1);
    paint(0);
    stage.classList.add('is-active');
  }

  function clearTurn() {
    cancelAnimationFrame(frame);
    stage.classList.remove('is-active');
    turn = undefined;
  }

  function settle(complete) {
    const active = turn;
    const end = complete ? 1 : 0;
    const {progress, index} = active;
    if (reducedMotion.matches) {
      if (complete) showPage(index);
      clearTurn();
      return;
    }
    const duration = 130 + Math.abs(end - progress) * 440;
    const started = performance.now();
    function animate(now) {
      if (turn !== active || current !== active.from) {
        clearTurn();
        return;
      }
      const fraction = Math.min(1, (now - started) / duration);
      const ease = fraction * fraction * (3 - 2 * fraction);
      paint(progress + (end - progress) * ease);
      if (fraction < 1) {
        frame = requestAnimationFrame(animate);
        return;
      }
      if (complete) showPage(index);
      clearTurn();
    }
    frame = requestAnimationFrame(animate);
  }

  turnPage = index => {
    if (index < 0 || index >= pages.length || index === current || turn) return;
    if (viewer.open || reducedMotion.matches) {
      showPage(index);
      return;
    }
    start(index);
    settle(true);
  };

  for (const [id, direction] of [['#corner-prev', -1], ['#corner-next', 1]]) {
    const handle = document.querySelector(id);
    handle.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || turn || handle.disabled) return;
      if (reducedMotion.matches) return;
      start(current + direction);
      turn.pointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
      handle.setPointerCapture(event.pointerId);
      paint(.04);
    });
    handle.addEventListener('pointermove', event => {
      if (turn?.pointer?.id !== event.pointerId) return;
      const distance = (turn.pointer.x - event.clientX) * direction;
      const projected = Math.max(-1, Math.min(1, 1 - distance / turn.halfWidth));
      paint(Math.acos(projected) / Math.PI);
    });
    handle.addEventListener('pointerup', event => {
      if (turn?.pointer?.id !== event.pointerId) return;
      const dx = event.clientX - turn.pointer.x;
      const dy = event.clientY - turn.pointer.y;
      const tapped = Math.hypot(dx, dy) < 9;
      turn.pointer = undefined;
      settle(tapped || -dx * direction >= turn.halfWidth * .85);
    });
    function cancelPointer(event) {
      if (turn?.pointer?.id !== event.pointerId) return;
      turn.pointer = undefined;
      settle(false);
    }
    handle.addEventListener('pointercancel', cancelPointer);
    handle.addEventListener('lostpointercapture', cancelPointer);
    handle.addEventListener('click', event => {
      if (event.detail === 0 || reducedMotion.matches) turnPage(current + direction);
    });
  }

  pageOpen.addEventListener('click', () => {
    if (viewer.open && turn) clearTurn();
  });
  thumbnails.addEventListener('click', clearTurn);
  window.addEventListener('resize', clearTurn);
}
