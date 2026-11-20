let cards = [];
let activeTitle = "";
const dialog = document.querySelector("#lightbox");
const largePhoto = document.querySelector("#large-photo");
const position = document.querySelector("#position");
const singleDownload = document.querySelector("#single-download");
const stage = dialog.querySelector(".lightbox-stage");
const filmstrip = document.querySelector("#filmstrip");
const mobileLayout = matchMedia("(max-width: 700px)");
let current = 0;
let gesture = null;
let suppressClickUntil = 0;

function updateFilmstrip() {
  if (!mobileLayout.matches) {
    filmstrip.replaceChildren();
    return;
  }

  const count = Math.min(cards.length, 7);
  const start = Math.max(0, Math.min(current - Math.floor(count / 2), cards.length - count));
  const focusInStrip = filmstrip.contains(document.activeElement);
  const thumbnails = document.createDocumentFragment();
  let selected;

  for (let index = start; index < start + count; index++) {
    const image = document.createElement("img");
    image.src = cards[index].querySelector("img").src;
    image.alt = "";

    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", `Fotografia ${index + 1}`);
    if (index === current) {
      button.setAttribute("aria-current", "true");
      selected = button;
    }
    button.addEventListener("click", () => {
      showPhoto(index);
      filmstrip.querySelector('[aria-current="true"]').focus({ preventScroll: true });
    });
    button.append(image);
    thumbnails.append(button);
  }
  filmstrip.replaceChildren(thumbnails);
  if (focusInStrip) selected.focus({ preventScroll: true });
}

function showPhoto(index) {
  current = (index + cards.length) % cards.length;
  const card = cards[current];
  largePhoto.src = card.querySelector("img").src;
  largePhoto.alt = `${activeTitle} · ${current + 1} / ${cards.length}`;
  position.textContent = `${current + 1} / ${cards.length}`;
  singleDownload.href = card.dataset.original;
  singleDownload.download = card.dataset.filename || "";
  updateFilmstrip();
}
document.querySelector("#close").addEventListener("click", () => dialog.close());
document.querySelector("#previous").addEventListener("click", () => showPhoto(current - 1));
document.querySelector("#next").addEventListener("click", () => showPhoto(current + 1));
dialog.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    showPhoto(current + (event.key === "ArrowRight" ? 1 : -1));
  }
});
stage.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.pointerType === "mouse" || event.target.closest("button")) return;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
stage.addEventListener("pointerup", event => {
  if (event.pointerId !== gesture?.id) return;
  const horizontal = event.clientX - gesture.x;
  const vertical = event.clientY - gesture.y;
  gesture = null;
  if (Math.abs(horizontal) < 42 || Math.abs(horizontal) < Math.abs(vertical) * 1.2) return;
  suppressClickUntil = performance.now() + 350;
  showPhoto(current + (horizontal < 0 ? 1 : -1));
});
stage.addEventListener("pointercancel", () => { gesture = null; });
dialog.addEventListener("click", event => {
  if ((event.target === stage || event.target === dialog) && performance.now() > suppressClickUntil) dialog.close();
});
dialog.addEventListener("close", () => {
  gesture = null;
  suppressClickUntil = 0;
});
mobileLayout.addEventListener("change", () => {
  if (dialog.open) updateFilmstrip();
});


const clips = Array.isArray(window.potetosVideos) ? window.potetosVideos : [];
if (clips.length) {
  const grid = document.querySelector("#video-grid");
  for (const clip of clips) {
    const card = document.createElement("article");
    const title = document.createElement("h3");
    title.textContent = clip.title;
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "none";
    video.src = clip.src;
    if (clip.poster) video.poster = clip.poster;
    video.setAttribute("aria-label", clip.title);
    const download = document.createElement("a");
    download.className = "button outline";
    download.href = clip.download || clip.src;
    download.download = "";
    download.textContent = "Descarcă clipul";
    card.append(video, title, download);
    grid.append(card);
  }
  document.querySelector("#videouri").hidden = false;
  document.querySelector("#video-link").hidden = false;
}


function applyMasonry(cards, aspectRatios, width, gap) {
  const columnWidth = (width - gap) / 2;
  const heights = [1, 1];

  cards.forEach((card, index) => {
    const column = heights[0] <= heights[1] ? 0 : 1;
    const height = Math.ceil(columnWidth / aspectRatios[index]);
    card.style.width = "";
    card.style.gridColumnStart = column + 1;
    card.style.gridRowStart = heights[column];
    card.style.gridRowEnd = "span " + height;
    heights[column] += height + gap;
  });
}

function applyJustified(cards, aspectRatios, width, gap) {
  const preferredHeight = Math.max(190, Math.min(310, width / 4.4));
  let rowStart = 0;
  let rowRatio = 0;

  function finishRow(rowEnd, height, fill) {
    let remaining = width - (rowEnd - rowStart - 1) * gap;
    for (let index = rowStart; index < rowEnd; index++) {
      const card = cards[index];
      const cardWidth = fill && index === rowEnd - 1
        ? remaining
        : Math.floor(aspectRatios[index] * height * 64) / 64;
      card.style.width = cardWidth + "px";
      card.style.gridArea = "";
      remaining -= cardWidth;
    }
    rowStart = rowEnd;
    rowRatio = 0;
  }

  aspectRatios.forEach((ratio, index) => {
    const count = index - rowStart + 1;
    rowRatio += ratio;
    const rowHeight = (width - (count - 1) * gap) / rowRatio;
    if (rowHeight <= preferredHeight) finishRow(index + 1, rowHeight, true);
  });

  if (rowStart < cards.length) finishRow(cards.length, preferredHeight, false);
}

function setupGallery(section) {
  const groupCards = [...section.querySelectorAll(".photo")];
  const title = section.querySelector("h2").textContent;
  const rest = section.querySelector(".gallery-rest");
  const toggle = section.querySelector(".gallery-toggle");
  const collapse = section.querySelector(".collapse-gallery");
  const grid = rest.querySelector(".grid");
  const extraCards = [...grid.children];
  const aspectRatios = extraCards.map(card => {
    const img = card.querySelector("img");
    return Number(img.getAttribute("width")) / Number(img.getAttribute("height"));
  });
  let lastWidth = 0;

  function layout() {
    if (rest.hidden) return;
    const width = Math.floor(grid.getBoundingClientRect().width * 64) / 64;
    if (!width || width === lastWidth) return;
    lastWidth = width;
    const gap = parseFloat(getComputedStyle(grid).columnGap);
    grid.classList.toggle("is-masonry", mobileLayout.matches);
    grid.classList.toggle("is-justified", !mobileLayout.matches);
    if (mobileLayout.matches) {
      applyMasonry(extraCards, aspectRatios, width, gap);
    } else {
      applyJustified(extraCards, aspectRatios, width, gap);
    }
  }

  function setExpanded(expanded) {
    rest.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.firstChild.textContent = expanded ? "Restrânge " : "Vezi toate ";
    toggle.querySelector("span").textContent = expanded ? "−" : "+";
    if (expanded) layout();
  }

  toggle.hidden = false;
  collapse.hidden = false;
  setExpanded(false);
  toggle.addEventListener("click", () => setExpanded(rest.hidden));
  collapse.addEventListener("click", () => {
    setExpanded(false);
    toggle.focus({ preventScroll: true });
    section.scrollIntoView({ block: "start" });
  });

  groupCards.forEach((card, index) => {
    card.querySelector(".view").addEventListener("click", () => {
      cards = groupCards;
      activeTitle = title;
      showPhoto(index);
      dialog.showModal();
      document.querySelector("#close").focus();
    });
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(layout).observe(grid);
  } else {
    addEventListener("resize", layout);
  }
}

document.querySelectorAll(".gallery-section").forEach(setupGallery);
