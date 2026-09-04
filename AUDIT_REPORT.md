# Audit site DYO — 2026-09-04

## Rezumat

Proiectul este un site static HTML/CSS/JS găzduit pe GitHub Pages.
Repo local: `D:\Pagina\github\DYO`
Remote Git: `https://github.com/DYO-EndlessMemories/DYO.git`
Site public funcțional: `https://DYO-EndlessMemories.github.io/DYO/`

Starea Git la audit:
- Branch: `main`, sincronizat cu `origin/main`.
- Există două foldere necomise: `assets/fonts/Agatho RO/` și `assets/fonts/DYO Serif/`.

Verificări rulate:
- `git status --short --branch`
- `git remote -v`
- scan local pentru referințe `src`, `href`, `url(...)`
- verificare dimensiuni imagini cu Python/Pillow
- server static local `python -m http.server 8088`
- request-uri locale pentru toate paginile principale: toate au returnat HTTP 200
- verificare site public GitHub Pages: URL-ul corect returnează 200; URL-ul vechi/singular returnează 404

## Structura proiectului

Pagini HTML:
- `index.html` — homepage
- `portfolio.html` — portofoliu
- `films.html` — video/filme
- `experience.html` — proces/experiență
- `private-gallery.html` — galerii clienți
- `contact.html` — contact/formular

Assets:
- `assets/css/style.css` — tot styling-ul, ~34 KB
- `assets/js/main.js` — carousel, mosaic, animații statistici, ~4.8 KB
- `assets/images/optimized/...` — imaginile folosite efectiv în majoritatea zonelor
- `assets/images/...` — există încă multe JPG-uri mari, probabil surse/vechi
- `assets/fonts/...` — fonturi locale

Nu există momentan:
- `package.json`
- `README.md`
- `sitemap.xml`
- `robots.txt`
- `.nojekyll`

## Probleme critice / de reparat primele

### 1. Email greșit în linkurile de contact

În `contact.html`, textul afișat este `DYO.office@gmail.com`, dar linkul/formularul folosesc `DYO.office@dgmail.com`.

Locuri:
- `contact.html` — link `mailto:DYO.office@dgmail.com`
- `contact.html` — form action `mailto:DYO.office@dgmail.com`

Impact:
- clienții care apasă pe email sau trimit formularul pot trimite către o adresă invalidă.

Recomandare:
- schimbat peste tot în `DYO.office@gmail.com`.
- pe termen mediu: înlocuit formularul `mailto:` cu un formular real, ex. Formspree, Netlify Forms, Google Forms embed sau backend simplu.

### 2. Numerele de telefon afișate au `tel:` greșit

În `contact.html`, textul afișat:
- `+40 754 241 346`
- `+40 725 037 591`

Dar ambele linkuri au:
- `tel:+40700000000`

Impact:
- pe telefon, utilizatorul apasă și sună la numărul greșit/dummy.

Recomandare:
- `tel:+40754241346`
- `tel:+40725037591`

### 3. Link greșit către site în footer homepage

În `index.html`, footerul trimite către:
- `https://DYO-EndlessMemory.github.io/DYO/` — 404

Site-ul funcțional verificat este:
- `https://DYO-EndlessMemories.github.io/DYO/` — 200

Recomandare:
- schimbat footer link-ul sau făcut relativ `index.html`.

### 4. Font principal lipsă / cale greșită în CSS

În `assets/css/style.css`:
```css
src: url("../fonts/Agatho_LightCAPS.otf") format("opentype");
```

Fișierul acesta nu există exact cu acel nume. Există variante precum:
- `assets/fonts/Agatho_ LightCAPS.otf` — cu spațiu după underscore
- `assets/fonts/Agatho RO/AgathoRO_LightCAPS.otf` — folder necomis

Impact:
- heading-urile probabil cad pe fallback font, deci design-ul public poate să nu arate ca local/intenționat.

Recomandare:
- alegem o singură familie de fonturi, cu nume fără spații dubioase.
- ideal: convertim în `.woff2` și actualizăm `@font-face`.
- apoi comitem fonturile necesare sau eliminăm fonturile nefolosite.

## SEO / indexare

### Lipsesc meta tag-uri sociale

Paginile au `title` și `description`, dar lipsesc:
- canonical URL
- Open Graph: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`
- Twitter card tags

Impact:
- linkurile distribuite pe Facebook/WhatsApp/Discord pot arăta generic sau fără preview bun.

Recomandare:
- adăugat set comun de meta pentru fiecare pagină.
- ales un `og:image` bun, probabil hero/portofoliu optimizat.

### Lipsesc `sitemap.xml` și `robots.txt`

Impact:
- Google poate indexa site-ul, dar mai lent/mai neclar.

Recomandare:
- adăugat `sitemap.xml` cu cele 6 pagini.
- adăugat `robots.txt` care permite crawling și indică sitemap-ul.

### `portfolio.html` nu are `<h1>`

Verificare:
- `portfolio.html`: `h1_count: 0`

Impact:
- SEO și structură semantică mai slabă.

Recomandare:
- titlul principal din primul slide ar trebui să fie `<h1>`, nu doar `<h2>`.

### Titluri/descrieri prea generice

Exemple:
- `Filme | DYO`
- `Galerie | DYO`
- `Contact | DYO`

Recomandare:
- titluri mai căutabile/localizate, ex. `DYO Endless Memories | Fotograf și videograf nuntă`.
- dacă business-ul e local, inclus oraș/județ/zonă în pagini.

## Performanță

### Multe imagini mari încă în repo

Există imagini JPG de 6–12 MB în:
- `assets/images/hero/`
- `assets/images/gallery/`
- `assets/images/portfolio/`
- `assets/images/galleries/`

Site-ul pare să folosească în CSS/HTML imaginile optimizate `.webp`, ceea ce e bine. Totuși JPG-urile mari rămân în repo și cresc dimensiunea clone/deploy.

Exemple:
- `assets/images/gallery/gallery-02.jpg` — ~11.65 MB
- `assets/images/galleries/letca-a-viii-a.jpg` — ~11.26 MB
- `assets/images/portfolio/portfolio-03.jpg` — ~10.94 MB

Recomandare:
- dacă nu sunt folosite în site, mutat sursele mari în afara repo-ului sau Git LFS.
- păstrat în repo doar variantele web optimizate.

### Unele WebP-uri sunt încă mari

În `assets/images/optimized/portfolio-curated/`, câteva fișiere au peste 1 MB:
- `babeni-01.webp` — ~1.14 MB
- `babeni-04.webp` — ~1.05 MB
- `babeni-06.webp` — ~1.32 MB
- `ip-camera-05.webp` — ~1.14 MB
- `rus-david-04.webp` — ~1.08 MB
- `rus-david-05.webp` — ~1.12 MB

Recomandare:
- pentru grid-uri, 1400–1800px latura lungă e de obicei suficient.
- generat variante responsive cu `srcset` pentru imaginile din portofoliu.

### Imaginile HTML nu au `width`/`height`

În `portfolio.html` există 30 de imagini `<img>`, toate au `alt` și `loading="lazy"`, dar niciuna nu are `width`/`height`.

Impact:
- posibil layout shift la încărcare.

Recomandare:
- adăugat `width` și `height` conform dimensiunilor reale sau prin CSS `aspect-ratio`.

### Hero este background CSS

Hero-ul homepage e setat ca background în CSS, deci:
- nu are `alt`
- browserul nu poate optimiza la fel de bine ca un `<picture>`/`img`
- nu avem preload explicit pentru LCP

Recomandare:
- pentru homepage, convertit hero-ul într-un `<picture>` cu WebP, `fetchpriority="high"`, dimensiuni și fallback.
- alternativ, păstrat background dar adăugat preload pentru `assets/images/optimized/hero/hero-01.webp`.

### Lipsesc preload/preconnect pentru fonturi/assets cheie

Recomandare:
- preload pentru fontul principal `.woff2`.
- `font-display: swap` există deja, bine.

## Accesibilitate / UX

### Carousel-ul are butoane, dar lipsește suport mai complet

Există butoane cu `aria-label`, bine. Totuși:
- autoplay-ul nu se oprește la hover/focus.
- nu există `aria-live` sau anunțare slide activ.
- nu verifică `prefers-reduced-motion`.

Recomandare:
- respectat `prefers-reduced-motion: reduce` și oprit autoplay-ul/animațiile.
- oprit autoplay la hover/focus.

### Modalul pentru Ip a VIII-a poate fi îmbunătățit

Are `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, bine.

Lipsește probabil:
- focus mutat în modal la deschidere
- focus trap
- revenire focus pe card la închidere

Impact:
- utilizare mai grea din tastatură/screen reader.

### Multe imagini sunt background CSS

Cardurile și galeriile folosesc `div` cu `background-image`. Pentru imagini pur decorative e ok, dar pentru portofoliu/fotografie, conținutul vizual este esențial.

Recomandare:
- unde imaginea este conținut, folosit `<img>`/`picture` cu `alt`.
- background doar pentru decor.

## Conținut / branding

### Inconsistență limbă română/engleză

Site-ul combină: `Let's talk`, `Selected stories`, `The DYO Experience`, `Available galleries`, `Your story next`, etc.

Nu e greșit neapărat, poate fi stil premium/editorial. Dar trebuie decis intenționat:
- fie păstrăm mixul RO/EN ca direcție de brand,
- fie românizăm pentru claritate și conversie locală.

Recomandare:
- pentru CTA-uri importante, româna convertește probabil mai bine: `Hai să vorbim`, `Rezervă data`, `Vezi portofoliul`.

### Footer inconsistent

Unele pagini au footer în română `Foto · Video · Cinematografie`, altele au `Wedding photography & cinematography`.

Recomandare:
- uniformizat footerul.
- actualizat anul la 2026 sau făcut dinamic doar dacă introducem JS/build; pentru static, schimbat manual.

### Texte demo/placeholders pe pagina Filme

În `films.html` apar nume precum:
- `Andreea & Mihai`
- `Maria & David`

Dacă sunt demo, trebuie înlocuite cu proiecte reale sau neutralizate.

### DYO Endless Memory vs Memories

În site apare `DYO Endless Memory`, dar repo/URL este `DYO-EndlessMemories` și Instagram pare `dyo_endlessmemories`.

Recomandare:
- decis forma oficială: `Endless Memory` sau `Endless Memories`.
- uniformizat în logo, footer, meta, URL/social.

## Cod / mentenanță

### Header/nav duplicat în toate paginile

Headerul, mobile menu și footerul sunt duplicate în 6 fișiere.

Impact:
- orice schimbare trebuie făcută de 6 ori; risc de inconsistențe.

Opțiuni:
1. rămâne site static simplu, dar facem disciplină/manual checklist.
2. introducem un generator static simplu — Eleventy/Astro/Vite cu partials.
3. folosim un mic script de build care injectează header/footer.

Recomandare:
- dacă site-ul va crește, merită Eleventy sau Astro.
- dacă modificările sunt rare, păstrăm static și reparăm duplicările cu atenție.

### JavaScript mort/parțial nefolosit

`main.js` caută `[data-count]`, dar în HTML nu există elemente `data-count`.

Impact:
- mic, nu strică site-ul, dar indică funcționalitate rămasă incompletă.

Recomandare:
- fie adăugăm `data-count` la statistici, fie scoatem codul.

### Lipsă documentație proiect

Nu există `README.md`.

Recomandare:
- adăugat un README scurt: structură, cum se testează local, cum se publică pe GitHub Pages, reguli pentru imagini.

## Securitate / privacy

### Galerii client publice

`private-gallery.html` conține linkuri directe Mega/Drive. Dacă galeriile sunt pentru clienți, pagina e publică și poate fi indexată.

Impact:
- oricine găsește pagina poate deschide linkurile.

Recomandare:
- dacă e ok public, lăsăm.
- dacă trebuie private: `robots.txt` nu e suficient; trebuie mutat către pagini cu protecție/parolă sau linkuri nelistate trimise direct clienților.
- măcar redenumit/poziționat ca „Client galleries” dacă vrei să fie public.

### Linkuri externe

Linkurile externe au `target="_blank"` și `rel="noopener"`, bine.

## Prioritate recomandată

### P0 — reparat imediat

1. Email `dgmail` -> `gmail` în `contact.html`.
2. `tel:` dummy -> numere reale.
3. Link GitHub Pages greșit din `index.html`.
4. Font path greșit `Agatho_LightCAPS.otf`.

### P1 — înainte de promovare/trimis la clienți

1. Adăugat H1 pe `portfolio.html`.
2. Meta OG/canonical pe toate paginile.
3. `sitemap.xml` + `robots.txt`.
4. Uniformizat brand: Memory/Memories, limbă CTA-uri, footer.
5. Înlocuit/confirmat textele demo din `films.html`.

### P2 — optimizare serioasă

1. Curățat JPG-urile mari nefolosite sau mutat în Git LFS/storage separat.
2. Adăugat `width`/`height` sau `aspect-ratio` pentru imaginile din portofoliu.
3. Responsive images / `srcset`.
4. Preload pentru hero și font.
5. Respect `prefers-reduced-motion` pentru animații/carousel.
6. Focus management pentru modal.

### P3 — mentenanță

1. README.
2. Partial/template system pentru header/footer.
3. Script de verificare asset-uri lipsă înainte de commit.
4. Eventual GitHub Action simplu pentru lint/check linkuri.

## Propunere de prim pas concret

Aș face un commit mic, sigur, cu reparări P0:
- `contact.html`: email + telefoane
- `index.html`: link footer corect/relativ
- `assets/css/style.css`: reparat font path către un fișier existent sau adoptat fontul nou din `Agatho RO`

După aceea, un commit separat pentru SEO/meta/sitemap, apoi unul pentru performanță imagini.
