{
  const underPage = document.querySelector('#under-page');
  const paper = document.querySelector('#fold-paper');
  const shape = document.querySelector('#fold-shape');
  const light = document.querySelector('#paper-light');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let fold;
  let frame = 0;

  function clip(points, signedDistance, side) {
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const da = signedDistance(a);
      const db = signedDistance(b);
      if (da * side >= 0) result.push(a);
      if ((da * side >= 0) !== (db * side >= 0)) {
        const fraction = da / (da - db);
        result.push([a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction]);
      }
    }
    return result;
  }

  function start(index) {
    const {width, height} = pageOpen.getBoundingClientRect();
    const direction = index > current ? 1 : -1;
    const corner = [direction === 1 ? width : 0, height];
    fold = {index, startPage: current, width, height, direction, corner, point: corner};
    underPage.src = pages[index].src;
    paper.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    pageOpen.classList.add('is-turning');
  }

  function render(x, y) {
    const {corner, direction, width, height} = fold;
    x = direction === 1 ? Math.min(x, corner[0] - .1) : Math.max(x, corner[0] + .1);
    y = Math.min(height, Math.max(-height, y));
    fold.point = [x, y];
    const dx = corner[0] - x;
    const dy = corner[1] - y;
    const distance = Math.hypot(dx, dy);
    const nx = dx / distance;
    const ny = dy / distance;
    const midX = (corner[0] + x) / 2;
    const midY = (corner[1] + y) / 2;
    const signed = ([px, py]) => (px - midX) * nx + (py - midY) * ny;
    const rectangle = [[0, 0], [width, 0], [width, height], [0, height]];
    const front = clip(rectangle, signed, -1);
    image.style.clipPath = front.length < 3
      ? 'inset(0 100% 0 0)'
      : 'polygon(' + front.map(([px, py]) => px + 'px ' + py + 'px').join(',') + ')';
    const back = clip(rectangle, signed, 1).map(point => {
      const offset = 2 * signed(point);
      return [point[0] - offset * nx, point[1] - offset * ny];
    });
    shape.setAttribute('points', back.map(point => point.join(',')).join(' '));
    light.setAttribute('x1', midX);
    light.setAttribute('y1', midY);
    light.setAttribute('x2', x);
    light.setAttribute('y2', y);
  }

  function clearFold() {
    cancelAnimationFrame(frame);
    fold = undefined;
    image.style.clipPath = '';
    pageOpen.classList.remove('is-turning');
  }

  function settle(complete) {
    const {corner, direction, width, index, point, startPage} = fold;
    if (reducedMotion.matches) {
      clearFold();
      if (complete) showPage(index);
      return;
    }
    const endX = complete ? corner[0] - direction * width * 2.04 : corner[0];
    const duration = complete ? 350 : 210;
    const started = performance.now();
    function animate(now) {
      if (current !== startPage) {
        clearFold();
        return;
      }
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      render(point[0] + (endX - point[0]) * eased, point[1] + (corner[1] - point[1]) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
        return;
      }
      if (complete) showPage(index);
      clearFold();
    }
    frame = requestAnimationFrame(animate);
  }

  turnPage = index => {
    if (index < 0 || index >= pages.length || index === current || fold) return;
    if (viewer.open || reducedMotion.matches) {
      showPage(index);
      return;
    }
    start(index);
    render(fold.corner[0] - fold.direction * fold.width * .035, fold.height * .95);
    settle(true);
  };

  for (const [id, direction] of [['#corner-prev', -1], ['#corner-next', 1]]) {
    const handle = document.querySelector(id);
    handle.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || fold || handle.disabled) return;
      start(current + direction);
      fold.pointer = {id: event.pointerId, x: event.clientX, y: event.clientY};
      handle.setPointerCapture(event.pointerId);
      render(fold.corner[0] - direction * 7, fold.corner[1] - 9);
    });
    handle.addEventListener('pointermove', event => {
      if (fold?.pointer?.id !== event.pointerId) return;
      render(
        fold.corner[0] + event.clientX - fold.pointer.x,
        fold.corner[1] + event.clientY - fold.pointer.y,
      );
    });
    handle.addEventListener('pointerup', event => {
      if (fold?.pointer?.id !== event.pointerId) return;
      const distance = (fold.pointer.x - event.clientX) * direction;
      const tapped = Math.hypot(event.clientX - fold.pointer.x, event.clientY - fold.pointer.y) < 9;
      fold.pointer = undefined;
      settle(tapped || distance > fold.width * .22);
    });
    function cancelPointer(event) {
      if (fold?.pointer?.id !== event.pointerId) return;
      fold.pointer = undefined;
      settle(false);
    }
    handle.addEventListener('pointercancel', cancelPointer);
    handle.addEventListener('lostpointercapture', cancelPointer);
    handle.addEventListener('click', event => {
      if (event.detail === 0) turnPage(current + direction);
    });
  }

  thumbnails.addEventListener('click', clearFold);
  window.addEventListener('resize', clearFold);
}
