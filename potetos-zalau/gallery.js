const cards = [...document.querySelectorAll(".photo")];
const dialog = document.querySelector("#lightbox");
const largePhoto = document.querySelector("#large-photo");
const position = document.querySelector("#position");
const singleDownload = document.querySelector("#single-download");
let current = 0;

function showPhoto(index) {
  current = (index + cards.length) % cards.length;
  const card = cards[current];
  largePhoto.src = card.querySelector("img").src;
  largePhoto.alt = `Fotografia ${current + 1} din galeria Poteto’s`;
  position.textContent = `${current + 1} / ${cards.length}`;
  singleDownload.href = card.querySelector(".download").href;
}
cards.forEach((card, index) => {
  card.querySelector("button").addEventListener("click", () => {
    showPhoto(index);
    dialog.showModal();
    document.querySelector("#close").focus();
  });
});
document.querySelector("#close").addEventListener("click", () => dialog.close());
document.querySelector("#previous").addEventListener("click", () => showPhoto(current - 1));
document.querySelector("#next").addEventListener("click", () => showPhoto(current + 1));
dialog.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    showPhoto(current + (event.key === "ArrowRight" ? 1 : -1));
  }
});
dialog.addEventListener("click", event => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }
});

const clips = window.potetosVideos;
if (clips.length) {
  document.querySelector("#video-status").textContent = "Vizualizare online și descărcare.";
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
}
