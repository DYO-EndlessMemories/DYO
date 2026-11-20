let cards = [];
let activeTitle = "";
const dialog = document.querySelector("#lightbox");
const largePhoto = document.querySelector("#large-photo");
const position = document.querySelector("#position");
const singleDownload = document.querySelector("#single-download");
const stage = dialog.querySelector(".lightbox-stage");
const viewer = stage.querySelector(".lightbox-image");
const track = viewer.querySelector(".lightbox-track");
const beforePhoto = track.querySelector(".slide-before img");
const afterPhoto = track.querySelector(".slide-after img");
const filmstrip = document.querySelector("#filmstrip");
const lightboxFavorites = [document.querySelector("#lightbox-favorite"), document.querySelector("#stage-favorite")];
const mobileLayout = matchMedia("(max-width: 700px)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let current = 0;
let gesture = null;
let slideTimer;
let suppressClickUntil = 0;
let filmstripCards;
let filmstripTimer;

const usesIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const usesAndroid = /Android/i.test(navigator.userAgent);
const collections = new Map();
const favoriteStorageKey = "potetos-zalau-favorites";
const favoriteGrid = document.querySelector("#favorite-grid");
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

function updateFavorites() {
  const selected = [...collections.values()].flatMap(collection => collection.cards)
    .filter(card => favorites.has(card.dataset.original));
  document.querySelector("[data-favorite-count]").textContent = selected.length;
  document.querySelector("#favorite-empty").hidden = selected.length > 0;
  document.querySelector("#favorite-download-all").hidden = selected.length === 0;

  const focused = favoriteGrid.contains(document.activeElement) ? document.activeElement : null;
  const focusIndex = focused ? [...favoriteGrid.children].indexOf(focused.closest(".photo")) : -1;
  const previews = selected.map((source, index) => {
    const card = source.cloneNode(true);
    card.querySelector(".photo-actions").remove();
    bindPhoto(card, selected, "Favorite", index);
    addPhotoActions(card);
    return card;
  });
  favoriteGrid.replaceChildren(...previews);
  if (focused) {
    const next = previews[Math.min(focusIndex, previews.length - 1)]?.querySelector(".favorite-toggle");
    (next || document.querySelector("#favorite-title")).focus({ preventScroll: true });
  }
}

function toggleFavorite(key) {
  if (favorites.has(key)) favorites.delete(key);
  else favorites.add(key);
  try {
    localStorage.setItem(favoriteStorageKey, JSON.stringify([...favorites]));
  } catch {
    // Favorites still work for the current page when storage is unavailable.
  }
  for (const button of document.querySelectorAll("[data-favorite-key]")) {
    if (button.dataset.favoriteKey === key) renderFavorite(button, key);
  }
  if (dialog.open) {
    for (const button of lightboxFavorites) renderFavorite(button, cards[current].dataset.original);
  }
  updateFavorites();
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
  if (usesIOS) {
    download.setAttribute("aria-label", `Salvează în Poze: ${file.name}`);
    download.title = "Salvează în Poze";
    download.addEventListener("click", event => openSinglePhoto(event, file));
  } else {
    download.setAttribute("aria-label", `Descarcă ${file.name}`);
  }
  const favorite = document.createElement("button");
  favorite.type = "button";
  favorite.className = "favorite-toggle";
  favorite.dataset.favoriteKey = original;
  renderFavorite(favorite, original);
  favorite.addEventListener("click", () => toggleFavorite(original));
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
    if (!dialog.open || !filmstrip.children.length || gesture?.dragging || slideTimer) return;
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

function wrapIndex(index) {
  return (index + cards.length) % cards.length;
}

function setTrackOffset(offset) {
  track.style.transform = offset ? `translate3d(${offset}px, 0, 0)` : "";
}

function resetTrack() {
  clearTimeout(slideTimer);
  slideTimer = null;
  track.style.transition = "";
  setTrackOffset(0);
}

function showPhoto(index) {
  resetTrack();
  current = wrapIndex(index);
  const card = cards[current];
  largePhoto.src = card.querySelector("img").src;
  beforePhoto.hidden = afterPhoto.hidden = cards.length < 2;
  if (cards.length > 1) {
    beforePhoto.src = cards[wrapIndex(current - 1)].querySelector("img").src;
    afterPhoto.src = cards[wrapIndex(current + 1)].querySelector("img").src;
  }
  largePhoto.alt = `${activeTitle} · ${current + 1} / ${cards.length}`;
  position.textContent = `${current + 1} / ${cards.length}`;
  singleDownload.href = card.dataset.original;
  singleDownload.download = photoFile(card).name;
  for (const button of lightboxFavorites) renderFavorite(button, card.dataset.original);
  updateFilmstrip();
  if (usesIOS && hasNativePhotoShare()) scheduleOriginal(photoFile(card));
}

function settleSlide(direction, offset = 0) {
  if (slideTimer || cards.length < 2) return;
  if (reducedMotion.matches) {
    showPhoto(current + direction);
    return;
  }
  const destination = -direction * (viewer.clientWidth + 12);
  const duration = direction ? 235 : 190;
  setTrackOffset(offset);
  // Commit the drag position before changing the transform, even for a quick flick.
  track.getBoundingClientRect();
  track.style.transition = `transform ${duration}ms cubic-bezier(.2,.75,.25,1)`;
  setTrackOffset(destination);
  slideTimer = setTimeout(() => showPhoto(current + direction), duration + 16);
}
for (const button of lightboxFavorites) {
  button.addEventListener("click", () => toggleFavorite(cards[current].dataset.original));
}
document.querySelector("#close").addEventListener("click", () => dialog.close());
document.querySelector("#previous").addEventListener("click", () => settleSlide(-1));
document.querySelector("#next").addEventListener("click", () => settleSlide(1));
dialog.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    settleSlide(event.key === "ArrowRight" ? 1 : -1);
  }
});
viewer.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.pointerType === "mouse" || event.target.closest("button, a") || slideTimer || cards.length < 2) return;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, offset: 0, dragging: false };
});
viewer.addEventListener("pointermove", event => {
  if (event.pointerId !== gesture?.id) return;
  const horizontal = event.clientX - gesture.x;
  const vertical = Math.abs(event.clientY - gesture.y);
  if (!gesture.dragging) {
    if (vertical > 12 && vertical > Math.abs(horizontal)) {
      gesture = null;
      return;
    }
    if (Math.abs(horizontal) < 8 || Math.abs(horizontal) < vertical) return;
    gesture.dragging = true;
    if (event.isTrusted) viewer.setPointerCapture(event.pointerId);
  }
  const limit = viewer.clientWidth;
  gesture.offset = Math.max(-limit, Math.min(limit, horizontal));
  setTrackOffset(gesture.offset);
});

function endSwipe(event) {
  if (event.pointerId !== gesture?.id) return;
  const { offset, time, dragging } = gesture;
  gesture = null;
  if (!dragging) return;
  suppressClickUntil = performance.now() + 350;
  const distance = Math.abs(offset);
  const flick = distance > 24 && distance / Math.max(1, event.timeStamp - time) > .4;
  const advances = event.type === "pointerup" && (distance > Math.min(90, viewer.clientWidth * .24) || flick);
  settleSlide(advances ? -Math.sign(offset) : 0, offset);
}
viewer.addEventListener("pointerup", endSwipe);
viewer.addEventListener("pointercancel", endSwipe);
viewer.addEventListener("lostpointercapture", event => {
  if (event.target === viewer) endSwipe(event);
});
dialog.addEventListener("click", event => {
  if ((event.target === stage || event.target === dialog || event.target.matches(".lightbox-image, .lightbox-slide")) && performance.now() > suppressClickUntil) dialog.close();
});
dialog.addEventListener("close", () => {
  clearTimeout(filmstripTimer);
  clearTimeout(originalTimer);
  if (!singleSaving) forgetOriginal();
  resetTrack();
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

function bindPhoto(card, groupCards, title, index) {
  card.querySelector(".view").addEventListener("click", () => {
    cards = groupCards;
    activeTitle = title;
    dialog.showModal();
    showPhoto(index);
    document.querySelector("#close").focus();
  });
}

function setupGallery(section) {
  const groupCards = [...section.querySelectorAll(".photo")];
  const title = section.querySelector("h2").textContent;
  const rest = section.querySelector(".gallery-rest");
  const sample = section.querySelector(".sample-grid");
  const grid = rest?.querySelector(".grid");

  groupCards.forEach((card, index) => bindPhoto(card, groupCards, title, index));
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
        bindPhoto(preview, groupCards, title, index);
        addPhotoActions(preview);
        sample.append(preview);
      }
      customPreview = true;
    }
  }
  groupCards.forEach(addPhotoActions);

  const toggle = section.querySelector(".gallery-toggle");
  const collapse = section.querySelector(".collapse-gallery");
  const sampleCards = customPreview ? [] : [...sample.children];
  const fullGridCards = [...sampleCards, ...grid.children];
  const shown = new Set([...sample.children].map(card => card.dataset.original));
  const teaser = document.createElement("div");
  teaser.className = "gallery-teaser sample-grid";
  teaser.setAttribute("aria-hidden", "true");
  for (const card of fullGridCards.filter(card => !shown.has(card.dataset.original)).slice(0, 4)) {
    const thumb = card.querySelector("img").cloneNode();
    thumb.alt = "";
    teaser.append(thumb);
  }
  const more = document.createElement("div");
  more.className = "gallery-more";
  more.append(teaser, toggle);
  sample.after(more);
  const aspectRatios = fullGridCards.map(card => {
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
      applyMasonry(fullGridCards, aspectRatios, width, gap);
    } else {
      applyJustified(fullGridCards, aspectRatios, width, gap);
    }
  }

  function setExpanded(expanded) {
    rest.hidden = !expanded;
    sample.hidden = expanded;
    if (expanded) {
      grid.prepend(...sampleCards);
    } else {
      for (const card of sampleCards) {
        card.style.width = "";
        card.style.gridArea = "";
      }
      sample.append(...sampleCards);
      lastWidth = 0;
    }
    teaser.hidden = expanded;
    more.classList.toggle("is-expanded", expanded);
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
const downloadBatch = document.querySelector("#download-batch");
const downloadPhotos = document.querySelector("#download-photos");
const downloadPhotosHelp = document.querySelector("#download-photos-help");
const downloadFiles = document.querySelector("#download-files");
const downloadHelp = document.querySelector("#download-help");
const downloadStatus = document.querySelector("#download-status");
const zipHelp = document.querySelector("#zip-help");
const downloadFrames = new Map();
let archiveCatalog;
let activeDownloads = [];
let batchTimer;

function setDownloadLink(link, file) {
  link.href = file.href;
  link.download = file.name;
}

function dispatchDownload(link) {
  if (link.origin !== location.origin) {
    // Each external attachment needs its own navigation while the server responds.
    if (!downloadFrames.has(link.href)) {
      const frame = document.createElement("iframe");
      frame.name = `original-download-${downloadFrames.size}`;
      frame.hidden = true;
      document.body.append(frame);
      downloadFrames.set(link.href, frame);
    }
    link.target = downloadFrames.get(link.href).name;
  }
  link.click();
  link.removeAttribute("target");
}

downloadBatch.addEventListener("click", () => {
  const rows = [...downloadFiles.children];
  const batchSize = rows.length;
  downloadBatch.disabled = true;
  for (const row of rows) row.lastElementChild.textContent = "În coadă";
  let next = 0;

  function dispatchNext() {
    if (!downloadDialog.open) return;
    const row = rows[next++];
    if (row.lastElementChild.textContent === "În coadă") dispatchDownload(row.firstElementChild);
    if (next < batchSize) {
      if (next === 1 || next % 20 === 0) downloadStatus.textContent = `${next} din ${batchSize} trimise browserului.`;
      batchTimer = setTimeout(dispatchNext, 150);
    } else {
      downloadStatus.textContent = `${batchSize} din ${batchSize} trimise browserului. Verifică finalizarea în lista de descărcări a browserului.`;
      downloadBatch.disabled = false;
    }
  }

  dispatchNext();
});
downloadDialog.addEventListener("close", () => clearTimeout(batchTimer));
downloadPhotos.addEventListener("click", () => openPhotos(activeDownloads));

async function openDownloads(key) {
  const all = [...collections.values()].flatMap(collection => collection.files);
  const collection = key === "all" ? { title: "Toate galeriile", files: all }
    : key === "favorites" ? { title: "Favorite", files: favoriteFiles() }
    : collections.get(key);
  activeDownloads = collection.files;
  downloadTitle.textContent = collection.title;
  downloadCount.textContent = activeDownloads.length
    ? activeDownloads.length === 1 ? "1 fișier în format original" : `${activeDownloads.length} fișiere în format original`
    : "Apasă pe o inimă din galerie pentru a adăuga fotografii aici.";
  downloadArchive.hidden = true;
  zipHelp.hidden = true;
  zipHelp.open = false;
  const hasFiles = activeDownloads.length > 0;
  downloadBatch.hidden = !hasFiles;
  const androidShare = usesAndroid && hasNativePhotoShare();
  downloadPhotos.hidden = !hasFiles || !(usesIOS || androidShare);
  downloadPhotos.textContent = usesIOS ? "Salvează în Poze" : "Partajează fotografiile";
  downloadPhotosHelp.textContent = usesIOS
    ? "Salvează originalele din meniul iPhone-ului."
    : "Destinațiile disponibile apar în meniul de partajare al telefonului.";
  downloadPhotosHelp.hidden = downloadPhotos.hidden;
  downloadHelp.hidden = !hasFiles;
  downloadStatus.textContent = "";
  downloadBatch.disabled = false;
  downloadBatch.textContent = activeDownloads.every(file => /\.jpe?g$/i.test(file.name))
    ? "Descarcă toate JPG-urile" : "Descarcă toate separat";
  downloadFiles.replaceChildren(...activeDownloads.map(file => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    setDownloadLink(link, file);
    link.textContent = file.name;
    const status = document.createElement("span");
    link.addEventListener("click", () => { status.textContent = "Trimis browserului"; });
    item.append(link, status);
    return item;
  }));
  downloadDialog.showModal();

  if (key === "favorites") return;
  archiveCatalog ??= fetch("download-archives.json?v=1")
    .then(response => response.ok ? response.json() : {})
    .catch(() => ({}));
  const requestFiles = activeDownloads;
  const archive = (await archiveCatalog)[key];
  if (!downloadDialog.open || activeDownloads !== requestFiles || !archive) return;
  const originals = requestFiles.map(file => file.href).sort();
  if (JSON.stringify(originals) === JSON.stringify([...archive.originals].sort())) {
    downloadArchive.href = archive.url;
    downloadArchive.hidden = false;
    zipHelp.hidden = false;
    if (usesIOS) {
      downloadBatch.hidden = true;
      downloadHelp.hidden = true;
    }
  }
}

const photosDialog = document.querySelector("#save-photos");
const photoStatus = document.querySelector("#save-photos-status");
const photoProgress = document.querySelector("#save-photos-progress");
const originalPhoto = document.querySelector("#save-photos-original");
const originalDownload = document.querySelector("#save-photos-download");
const sharePhotos = document.querySelector("#save-photos-share");
const nextPhotos = document.querySelector("#save-photos-next");
const showOriginal = document.querySelector("#save-photos-show-original");
// Limit the amount of original image data handed to the browser at once.
const shareByteBudget = (usesAndroid ? 48 : 96) * 1024 * 1024;
const shareFileLimit = usesAndroid ? 10 : Infinity;
const originalRelease = "https://github.com/DYO-EndlessMemories/DYO/releases/download/potetos-zalau-materiale/";
const originalMedia = "https://raw.githubusercontent.com/DYO-EndlessMemories/DYO/ddac8dc0fb401b00941dbacaf065b37e2bbf5343/";
let photoSession;
let singleOriginal;
let originalTimer;
let singleSaving = false;
let saveFeedbackTimer;

function originalShareUrl(file) {
  if (file.href.startsWith(originalRelease)) {
    return originalMedia + file.href.slice(originalRelease.length);
  }
  return file.href;
}

function openSinglePhoto(event, file) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  shareSinglePhoto(file);
}

function forgetOriginal() {
  singleOriginal?.controller.abort();
  singleOriginal = null;
}

function prepareOriginal(file) {
  if (singleOriginal?.href === file.href) return singleOriginal;
  forgetOriginal();
  const controller = new AbortController();
  const entry = { href: file.href, controller };
  entry.pending = readOriginal(file, controller.signal).then(original => {
    entry.payload = { files: [original] };
    return entry.payload;
  }).catch(() => {
    if (singleOriginal === entry) singleOriginal = null;
    return null;
  });
  singleOriginal = entry;
  return entry;
}

function scheduleOriginal(file) {
  clearTimeout(originalTimer);
  originalTimer = setTimeout(() => {
    if (dialog.open && !singleSaving) prepareOriginal(file);
  }, 240);
}

function showSaveFeedback(text, persistent = false) {
  clearTimeout(saveFeedbackTimer);
  const message = document.querySelector(dialog.open ? "#lightbox-save-status" : "#page-save-status");
  const other = document.querySelector(dialog.open ? "#page-save-status" : "#lightbox-save-status");
  other.textContent = "";
  message.textContent = text;
  if (text && !persistent) saveFeedbackTimer = setTimeout(() => { message.textContent = ""; }, 4500);
}

async function shareSinglePhoto(file) {
  if (singleSaving) return;
  if (!hasNativePhotoShare()) {
    openPhotos([file]);
    return;
  }
  singleSaving = true;
  try {
    const entry = prepareOriginal(file);
    if (!entry.payload) showSaveFeedback("Se încarcă fotografia originală…", true);
    const payload = entry.payload || await entry.pending;
    if (!payload || !navigator.canShare(payload)) {
      showSaveFeedback("Originalul nu s-a încărcat pentru salvare. Încearcă din nou.");
      return;
    }
    if (navigator.userActivation?.isActive === false) {
      showSaveFeedback("Fotografia e gata. Apasă din nou săgeata de descărcare.");
      return;
    }
    showSaveFeedback("");
    await navigator.share(payload);
  } catch (error) {
    if (error.name !== "AbortError") {
      showSaveFeedback("Meniul de salvare nu s-a deschis. Apasă din nou săgeata de descărcare.");
    }
  } finally {
    singleSaving = false;
  }
}

function individualPhotoGroups(files) {
  return files.map(file => ({ files: [file], share: false }));
}

function hasNativePhotoShare() {
  return typeof navigator.share === "function" && typeof navigator.canShare === "function";
}

function openPhotos(files) {
  if (!files.length || photosDialog.open) return;
  const groups = hasNativePhotoShare() ? [] : individualPhotoGroups(files);
  if (hasNativePhotoShare()) {
    for (let start = 0; start < files.length; start += shareFileLimit) {
      groups.push({ files: files.slice(start, start + shareFileLimit), share: true });
    }
  }
  photoSession = { groups, total: files.length, index: 0, offset: 0, controller: new AbortController() };
  document.querySelector("#save-photos-title").textContent = usesIOS ? "Salvează în Poze" : "Partajează fotografiile";
  photosDialog.showModal();
  preparePhotos(photoSession);
}

function resetPhotoPanel() {
  sharePhotos.hidden = nextPhotos.hidden = showOriginal.hidden = originalPhoto.hidden = originalDownload.hidden = true;
  originalPhoto.onload = originalPhoto.onerror = null;
  originalPhoto.removeAttribute("src");
  originalPhoto.alt = "";
}

function showFullPhoto(file) {
  sharePhotos.hidden = true;
  showOriginal.hidden = true;
  originalPhoto.hidden = true;
  originalPhoto.alt = file.name;
  setDownloadLink(originalDownload, file);
  originalDownload.hidden = false;
  photoStatus.textContent = "Se încarcă fotografia originală…";
  originalPhoto.onload = () => {
    originalPhoto.hidden = false;
    photoStatus.textContent = "Ține apăsat pe original, apoi alege „Salvează în Poze”.";
  };
  originalPhoto.onerror = () => {
    photoStatus.textContent = "Originalul nu s-a afișat. Îl poți descărca și importa în Poze din Fișiere.";
  };
  originalPhoto.src = originalShareUrl(file);
}

async function readOriginal(file, signal) {
  const response = await fetch(originalShareUrl(file), { signal });
  if (!response.ok) throw new Error("Original unavailable");
  const blob = await response.blob();
  const extension = file.name.split(".").pop().toLowerCase();
  const types = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const type = blob.type.startsWith("image/") ? blob.type : types[extension];
  if (!blob.size || !type || (blob.type && blob.type !== "application/octet-stream" && !blob.type.startsWith("image/"))) {
    throw new Error("Invalid image response");
  }
  return new File([blob], file.name, { type });
}

function renderPhotoProgress(session) {
  const count = session.groups[session.index].files.length;
  const first = session.offset + 1;
  const last = session.offset + count;
  const range = count === 1 ? first : first + "–" + last;
  photoProgress.textContent = session.total === 1 ? "" : range + " din " + session.total + " fotografii";
  nextPhotos.hidden = session.index + 1 >= session.groups.length;
}

async function preparePhotos(session) {
  resetPhotoPanel();
  session.ready = null;
  const { files, share } = session.groups[session.index];
  renderPhotoProgress(session);
  if (!share) {
    showFullPhoto(files[0]);
    return;
  }

  nextPhotos.hidden = true;
  photoStatus.textContent = files.length === 1 ? "Se încarcă fotografia originală…" : "Se încarcă fotografiile originale…";
  const originals = [];
  const loaded = [];
  const failed = [];
  let size = 0;
  let remaining = [];
  for (const [index, file] of files.entries()) {
    if (session.controller.signal.aborted) return;
    try {
      const original = session.deferred?.href === file.href
        ? session.deferred.original : await readOriginal(file, session.controller.signal);
      session.deferred = null;
      if (originals.length && size + original.size > shareByteBudget) {
        session.deferred = { href: file.href, original };
        remaining = files.slice(index);
        break;
      }
      size += original.size;
      originals.push(original);
      loaded.push(file);
    } catch {
      failed.push(file);
    }
  }
  if (photoSession !== session || !photosDialog.open) return;

  const followUp = remaining.length ? [{ files: remaining, share: true }] : [];
  const payload = { files: originals };
  if (!originals.length || !navigator.canShare(payload)) {
    session.groups.splice(session.index, 1, ...individualPhotoGroups([...loaded, ...failed]), ...followUp);
    preparePhotos(session);
    return;
  }

  session.groups.splice(session.index, 1, { files: loaded, share: true }, ...individualPhotoGroups(failed), ...followUp);
  session.ready = payload;
  sharePhotos.hidden = false;
  const count = originals.length;
  sharePhotos.textContent = usesIOS ? (count === 1 ? "Salvează în Poze" : "Salvează " + count + " în Poze") : "Partajează " + count;
  photoStatus.textContent = usesIOS ? (count === 1
    ? "Alege „Salvează imaginea” din meniul iPhone-ului."
    : "Alege „Salvează imaginile” din meniul iPhone-ului.") : "Alege destinația din meniul telefonului.";
  if (session.index + 1 < session.groups.length) {
    photoStatus.textContent += " Apoi continuă cu următoarele fotografii.";
  }
  showOriginal.textContent = originals.length === 1 ? "Deschide originalul" : "Deschide originalele pe rând";
  renderPhotoProgress(session);
}

async function sharePreparedPhotos() {
  const session = photoSession;
  const payload = session?.ready;
  if (!payload || sharePhotos.disabled) return;
  sharePhotos.disabled = nextPhotos.disabled = showOriginal.disabled = true;
  try {
    await navigator.share(payload);
  } catch (error) {
    if (error.name !== "AbortError" && photoSession === session && session.ready === payload && photosDialog.open) {
      photoStatus.textContent = "Meniul de salvare nu s-a deschis. Încearcă din nou sau deschide originalul.";
      showOriginal.hidden = false;
    }
  } finally {
    sharePhotos.disabled = nextPhotos.disabled = showOriginal.disabled = false;
  }
}

sharePhotos.addEventListener("click", sharePreparedPhotos);
showOriginal.addEventListener("click", () => {
  const session = photoSession;
  if (!session?.ready) return;
  const { files } = session.groups[session.index];
  session.groups.splice(session.index, 1, ...individualPhotoGroups(files));
  preparePhotos(session);
});
nextPhotos.addEventListener("click", () => {
  const session = photoSession;
  if (!session || nextPhotos.hidden) return;
  session.offset += session.groups[session.index].files.length;
  session.index++;
  preparePhotos(session);
});
photosDialog.addEventListener("close", () => {
  if (photosDialog.open) return;
  photoSession?.controller.abort();
  photoSession = null;
  resetPhotoPanel();
});

if (usesIOS) {
  singleDownload.setAttribute("aria-label", "Salvează fotografia în Poze");
  singleDownload.title = "Salvează în Poze";
  singleDownload.addEventListener("click", event => openSinglePhoto(event, photoFile(cards[current])));
}

if (usesIOS && hasNativePhotoShare()) {
  document.documentElement.classList.add("ios-photo-save");
  let press;
  let preventPreviewClick = false;

  function previewCard(target) {
    if (target === largePhoto) return cards[current];
    return target.closest(".view img")?.closest(".photo");
  }

  function cancelPress() {
    clearTimeout(press?.timer);
    press = null;
  }

  document.addEventListener("pointerdown", event => {
    cancelPress();
    preventPreviewClick = false;
    if (!event.isPrimary || event.pointerType !== "touch") return;
    const card = previewCard(event.target);
    if (!card) return;
    press = {
      id: event.pointerId, x: event.clientX, y: event.clientY, started: event.timeStamp, file: photoFile(card),
      timer: setTimeout(() => { if (!singleSaving) prepareOriginal(photoFile(card)); }, 425)
    };
  }, true);

  document.addEventListener("pointermove", event => {
    if (press?.id === event.pointerId &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) >= 8) cancelPress();
  }, true);
  document.addEventListener("pointerup", event => {
    if (press?.id !== event.pointerId) return;
    const held = press.contextMenu || event.timeStamp - press.started >= 550;
    const { file } = press;
    cancelPress();
    if (!held || gesture?.dragging) return;
    preventPreviewClick = true;
    gesture = null;
    shareSinglePhoto(file);
  }, true);
  for (const event of ["pointercancel", "scroll"]) {
    document.addEventListener(event, cancelPress, { capture: true, passive: true });
  }
  document.addEventListener("contextmenu", event => {
    const card = previewCard(event.target);
    if (!card) return;
    event.preventDefault();
    if (press) press.contextMenu = true;
  });
  document.addEventListener("click", event => {
    if (!preventPreviewClick || !previewCard(event.target)) return;
    preventPreviewClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}

for (const section of document.querySelectorAll(".gallery-section")) {
  if (["fotografii", "gta-vi", "gta-afise"].includes(section.id)) {
    const galleryCards = [...section.querySelectorAll(".photo")];
    const files = galleryCards.map(photoFile);
    collections.set(section.id, { title: section.querySelector("h2").textContent, files, cards: galleryCards });
    const actions = document.createElement("div");
    actions.className = "section-actions";
    section.querySelector(".section-head").append(actions);
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
document.querySelector(".intro-favorites").hidden = false;
document.querySelector("#favorite").hidden = false;
updateFavorites();

if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const highlight = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle("is-highlighted", entry.isIntersecting);
  }, { rootMargin: "-18% 0px -22% 0px" });
  document.querySelectorAll(".gallery-section .section-head").forEach(heading => highlight.observe(heading));
}
