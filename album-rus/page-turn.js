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
  let gesture;
  let suppressClick = false;
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

  pageOpen.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    if (turn) return;
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false};
  });

  pageOpen.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.dragged) {
      if (Math.abs(dx) < 9 || Math.abs(dx) <= Math.abs(dy)) return;
      gesture.dragged = true;
      suppressClick = true;
      pageOpen.setPointerCapture(event.pointerId);
      pageOpen.classList.add('is-dragging');
    }

    const direction = dx < 0 ? 1 : -1;
    const index = current + direction;
    if (!turn && !reducedMotion.matches && index >= 0 && index < pages.length) start(index);
    if (!turn) return;
    const projected = Math.max(-1, Math.min(1, 1 + dx * turn.direction / turn.halfWidth));
    paint(Math.acos(projected) / Math.PI);
  });

  function endGesture(event) {
    if (gesture?.id !== event.pointerId) return;
    const {x, dragged} = gesture;
    gesture = undefined;
    pageOpen.classList.remove('is-dragging');
    if (!dragged) return;
    const dx = event.clientX - x;
    const distance = Math.min(85, Math.max(32, pageOpen.getBoundingClientRect().width * .14));
    const released = event.type === 'pointerup';
    if (turn) {
      settle(released && -dx * turn.direction >= distance);
    } else if (released && reducedMotion.matches && Math.abs(dx) >= distance) {
      turnPage(current + (dx < 0 ? 1 : -1));
    }
  }

  pageOpen.addEventListener('pointerup', endGesture);
  pageOpen.addEventListener('pointercancel', endGesture);
  pageOpen.addEventListener('lostpointercapture', endGesture);
  pageOpen.addEventListener('dragstart', event => event.preventDefault());
  pageOpen.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  pageOpen.addEventListener('click', () => {
    if (viewer.open && turn) clearTurn();
  });
  thumbnails.addEventListener('click', clearTurn);
  window.addEventListener('resize', clearTurn);
}
