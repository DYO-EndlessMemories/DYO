let cards = [];
let activeTitle = "";
const dialog = document.querySelector("#lightbox");
const largePhoto = document.querySelector("#large-photo");
const position = document.querySelector("#position");
const singleDownload = document.querySelector("#single-download");
const stage = dialog.querySelector(".lightbox-stage");
const filmstrip = document.querySelector("#filmstrip");
const lightboxFavorite = document.querySelector("#lightbox-favorite");
const mobileLayout = matchMedia("(max-width: 700px)");
let current = 0;
let gesture = null;
let suppressClickUntil = 0;
let filmstripCards;
let filmstripTimer;

const collections = new Map();
const favoriteStorageKey = "potetos-zalau-favorites";
const favoriteButtons = new Map();
let favorites;
try {
  const saved = JSON.parse(localStorage.getItem(favoriteStorageKey));
  favorites = new Set(Array.isArray(saved) ? saved : []);
} catch {
  favorites = new Set();
}

function renderFavorite(button, key) {
  const selected = favorites.has(key);
  button.setAttribute("aria-pressed", String(selected));
  button.setAttribute("aria-label", selected ? "Scoate din favorite" : "Adaugă la favorite");
  button.textContent = selected ? "♥" : "♡";
}

function updateFavoriteCount() {
  document.querySelectorAll("[data-favorite-count]").forEach(element => {
    element.textContent = favoriteFiles().length;
  });
}

function toggleFavorite(key) {
  if (favorites.has(key)) favorites.delete(key);
  else favorites.add(key);
  try {
    localStorage.setItem(favoriteStorageKey, JSON.stringify([...favorites]));
  } catch {
    // Favorites still work for the current page when storage is unavailable.
  }
  for (const button of favoriteButtons.get(key) || []) renderFavorite(button, key);
  if (dialog.open) renderFavorite(lightboxFavorite, cards[current].dataset.original);
  updateFavoriteCount();
}

function photoFile(card) {
  const href = card.dataset.original;
  const name = card.dataset.filename || decodeURIComponent(new URL(href, document.baseURI).pathname.split("/").pop());
  return { href, name };
}

function favoriteFiles() {
  return [...collections.values()].flatMap(collection => collection.files).filter(file => favorites.has(file.href));
}

function addPhotoActions(card) {
  const original = card.dataset.original;
  const file = photoFile(card);
  const actions = document.createElement("div");
  actions.className = "photo-actions";
  const download = document.createElement("a");
  download.className = "photo-download";
  download.href = file.href;
  download.download = file.name;
  download.textContent = "↓";
  download.setAttribute("aria-label", `Descarcă ${file.name}`);
  const favorite = document.createElement("button");
  favorite.type = "button";
  favorite.className = "favorite-toggle";
  renderFavorite(favorite, original);
  favorite.addEventListener("click", () => toggleFavorite(original));
  if (!favoriteButtons.has(original)) favoriteButtons.set(original, []);
  favoriteButtons.get(original).push(favorite);
  actions.append(download, favorite);
  card.append(actions);
}

function updateFilmstrip() {
  if (filmstripCards !== cards) {
    const thumbnails = cards.map((card, index) => {
      const image = document.createElement("img");
      image.src = card.querySelector("img").src;
      image.loading = "lazy";
      image.alt = "";
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Fotografia ${index + 1}`);
      button.addEventListener("click", () => showPhoto(index));
      button.append(image);
      return button;
    });
    filmstrip.replaceChildren(...thumbnails);
    filmstripCards = cards;
  }
  filmstrip.querySelector("[aria-current]")?.removeAttribute("aria-current");
  const selected = filmstrip.children[current];
  selected.setAttribute("aria-current", "true");
  const left = selected.offsetLeft + (selected.offsetWidth - filmstrip.clientWidth) / 2;
  if (Math.abs(filmstrip.scrollLeft - left) > 2) filmstrip.scrollLeft = left;
}

filmstrip.addEventListener("scroll", () => {
  clearTimeout(filmstripTimer);
  filmstripTimer = setTimeout(() => {
    if (!dialog.open || !filmstrip.children.length) return;
    const center = filmstrip.scrollLeft + filmstrip.clientWidth / 2;
    let closest = current;
    let distance = Infinity;
    for (const [index, thumbnail] of [...filmstrip.children].entries()) {
      const offset = Math.abs(thumbnail.offsetLeft + thumbnail.offsetWidth / 2 - center);
      if (offset < distance) {
        distance = offset;
        closest = index;
      }
    }
    if (closest !== current) showPhoto(closest);
  }, 120);
}, { passive: true });

function showPhoto(index) {
  current = (index + cards.length) % cards.length;
  const card = cards[current];
  largePhoto.src = card.querySelector("img").src;
  largePhoto.alt = `${activeTitle} · ${current + 1} / ${cards.length}`;
  position.textContent = `${current + 1} / ${cards.length}`;
  singleDownload.href = card.dataset.original;
  singleDownload.download = card.dataset.filename || "";
  renderFavorite(lightboxFavorite, card.dataset.original);
  updateFilmstrip();
}
lightboxFavorite.addEventListener("click", () => toggleFavorite(cards[current].dataset.original));
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
  clearTimeout(filmstripTimer);
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
  const sample = section.querySelector(".sample-grid");
  const grid = rest?.querySelector(".grid");

  function bindPhoto(card, index) {
    card.querySelector(".view").addEventListener("click", () => {
      cards = groupCards;
      activeTitle = title;
      dialog.showModal();
      showPhoto(index);
      document.querySelector("#close").focus();
    });
  }

  groupCards.forEach(bindPhoto);
  if (!grid) {
    groupCards.forEach(addPhotoActions);
    return;
  }

  let customPreview = false;
  if (sample && section.dataset.previewFrames) {
    const byFrame = new Map(groupCards.map((card, index) => {
      const filename = card.dataset.filename || card.dataset.original.split("/").pop();
      const frame = filename.match(/^DYO_POT2_O-(\d+)\.jpe?g$/i)?.[1];
      return [frame, { card, index }];
    }));
    const selected = section.dataset.previewFrames.split(/\s+/).map(frame => byFrame.get(frame));
    if (selected.every(Boolean)) {
      grid.prepend(...sample.children);
      for (const { card, index } of selected) {
        const preview = card.cloneNode(true);
        bindPhoto(preview, index);
        addPhotoActions(preview);
        sample.append(preview);
      }
      customPreview = true;
    }
  }
  groupCards.forEach(addPhotoActions);

  const toggle = section.querySelector(".gallery-toggle");
  const collapse = section.querySelector(".collapse-gallery");
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
    if (customPreview) sample.hidden = expanded;
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

  if ("ResizeObserver" in window) {
    new ResizeObserver(layout).observe(grid);
  } else {
    addEventListener("resize", layout);
  }
}

const downloadDialog = document.querySelector("#downloads");
const downloadTitle = document.querySelector("#downloads-title");
const downloadCount = document.querySelector("#downloads-count");
const downloadArchive = document.querySelector("#download-archive");
const downloadNext = document.querySelector("#download-next");
const downloadFiles = document.querySelector("#download-files");
let archiveCatalog;
let activeDownloads = [];
let downloadIndex = 0;

function setDownloadLink(link, file) {
  link.href = file.href;
  link.download = file.name;
}

function updateNextDownload() {
  const file = activeDownloads[downloadIndex];
  downloadNext.hidden = !file;
  if (file) {
    setDownloadLink(downloadNext, file);
    downloadNext.textContent = `Descarcă separat ${downloadIndex + 1}/${activeDownloads.length}`;
  }
}

downloadNext.addEventListener("click", () => {
  downloadIndex++;
  setTimeout(updateNextDownload, 0);
});

async function openDownloads(key) {
  const all = [...collections.values()].flatMap(collection => collection.files);
  const collection = key === "all" ? { title: "Toate galeriile", files: all }
    : key === "favorites" ? { title: "Favorite", files: favoriteFiles() }
    : collections.get(key);
  activeDownloads = collection.files;
  downloadIndex = 0;
  downloadTitle.textContent = collection.title;
  downloadCount.textContent = activeDownloads.length
    ? activeDownloads.length === 1 ? "1 fișier în format original" : `${activeDownloads.length} fișiere în format original`
    : "Apasă pe o inimă din galerie pentru a adăuga fotografii aici.";
  downloadArchive.hidden = true;
  updateNextDownload();
  downloadFiles.replaceChildren(...activeDownloads.map(file => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    setDownloadLink(link, file);
    link.textContent = file.name;
    item.append(link);
    return item;
  }));
  downloadDialog.showModal();

  if (key === "favorites") return;
  archiveCatalog ??= fetch("download-archives.json?v=1")
    .then(response => response.ok ? response.json() : {})
    .catch(() => ({}));
  const requestFiles = activeDownloads;
  const archive = (await archiveCatalog)[key];
  if (activeDownloads !== requestFiles || !archive) return;
  const originals = requestFiles.map(file => file.href).sort();
  if (JSON.stringify(originals) === JSON.stringify([...archive.originals].sort())) {
    downloadArchive.href = archive.url;
    downloadArchive.hidden = false;
  }
}

for (const section of document.querySelectorAll(".gallery-section")) {
  if (["fotografii", "gta-vi", "gta-afise"].includes(section.id)) {
    const files = [...section.querySelectorAll(".photo")].map(photoFile);
    collections.set(section.id, { title: section.querySelector("h2").textContent, files });
    const actions = document.createElement("div");
    actions.className = "section-actions";
    const toggle = section.querySelector(".gallery-toggle");
    toggle.before(actions);
    actions.append(toggle);
    const download = document.createElement("button");
    download.className = "button outline";
    download.type = "button";
    download.dataset.downloadSet = section.id;
    download.textContent = "Descarcă tot";
    actions.append(download);
  }
  setupGallery(section);
}

document.querySelectorAll("[data-download-set]").forEach(button => {
  button.hidden = false;
  button.addEventListener("click", () => openDownloads(button.dataset.downloadSet));
});
updateFavoriteCount();

if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const highlight = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle("is-highlighted", entry.isIntersecting);
  }, { rootMargin: "-18% 0px -22% 0px" });
  document.querySelectorAll(".gallery-section .section-head").forEach(heading => highlight.observe(heading));
}
