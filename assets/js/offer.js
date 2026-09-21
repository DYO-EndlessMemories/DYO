/**
 * DYO — Albume Absolvenți (Promoția 2027)
 * Justified gallery + shuffle + scroll-linked D/Y/O → package highlight
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // TODO: replace PLACEHOLDER_GALLERY with real client / Promoția 2027 photos.
  // Keep { src, width, height, alt } so the justified layout can size rows
  // before images decode. Paths are relative to albume-absolventi.html.
  // ---------------------------------------------------------------------------
  var PLACEHOLDER_GALLERY = [
    { src: "assets/images/optimized/portfolio-curated/babeni-01.webp", width: 2200, height: 3300, alt: "Portret absolvent — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/babeni-02.webp", width: 2200, height: 1466, alt: "Landscape — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/babeni-03.webp", width: 2200, height: 3300, alt: "Portret absolvent — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/babeni-05.webp", width: 2200, height: 1466, alt: "Landscape — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/ip-camera-01.webp", width: 2200, height: 3300, alt: "Portret absolvent — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/ip-camera-02.webp", width: 2200, height: 1466, alt: "Landscape — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/ip-portrait-01.webp", width: 2200, height: 3300, alt: "Portret absolvent — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/ip-edit-02.webp", width: 2200, height: 1466, alt: "Landscape — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/letca-02.webp", width: 2200, height: 3300, alt: "Portret absolvent — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/letca-01.webp", width: 2200, height: 1466, alt: "Landscape — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/rus-01.webp", width: 2200, height: 3300, alt: "Portret absolvent — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/rus-04.webp", width: 2200, height: 1466, alt: "Landscape — placeholder" },
    { src: "assets/images/optimized/portfolio-curated/wedding-01.webp", width: 2200, height: 1466, alt: "Landscape — placeholder" },
    { src: "assets/images/optimized/galleries/david-esra.webp", width: 2000, height: 2666, alt: "Portret cuplu — placeholder" },
    { src: "assets/images/optimized/galleries/vlad-denisa.webp", width: 2000, height: 2666, alt: "Portret cuplu — placeholder" },
    { src: "assets/images/optimized/galleries/weddings_extra.webp", width: 2000, height: 1334, alt: "Landscape — placeholder" }
  ];

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // ---- Justified-row gallery (dependency-free) --------------------------------

  function JustifiedGallery(el, items, options) {
    this.el = el;
    this.items = items;
    this.targetRowHeight = (options && options.targetRowHeight) || 240;
    this.gap = (options && options.gap) || 8;
    this.maxRowHeight = (options && options.maxRowHeight) || 320;
    this._ro = null;
  }

  JustifiedGallery.prototype.render = function () {
    var width = Math.floor(this.el.clientWidth || this.el.getBoundingClientRect().width);
    if (width < 40) return;
    var rows = this._buildRows(width);
    var html = "";
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var h = row.height;
      var gap = this.gap;
      var widths = [];
      var used = gap * Math.max(0, row.items.length - 1);
      for (var i = 0; i < row.items.length; i++) {
        var w = Math.floor(h * (row.items[i].width / row.items[i].height));
        widths.push(w);
        used += w;
      }
      // Absorb rounding error into the last item so the row never overflows
      if (widths.length) {
        widths[widths.length - 1] = Math.max(24, widths[widths.length - 1] + (width - used));
      }
      html += '<div class="justified-row" style="height:' + h + 'px">';
      for (var j = 0; j < row.items.length; j++) {
        var it = row.items[j];
        var ar = it.width / it.height;
        html +=
          '<figure class="justified-item" style="--row-h:' +
          h +
          "px;--ar:" +
          ar +
          ";width:" +
          widths[j] +
          'px;height:' +
          h +
          'px">' +
          '<img src="' +
          it.src +
          '" alt="' +
          (it.alt || "DYO") +
          '" width="' +
          it.width +
          '" height="' +
          it.height +
          '" loading="lazy" decoding="async" />' +
          "</figure>";
      }
      html += "</div>";
    }
    this.el.innerHTML = html;
  };

  JustifiedGallery.prototype._buildRows = function (containerWidth) {
    var rows = [];
    var pending = [];
    var aspectSum = 0;
    var target = this.targetRowHeight;
    var gap = this.gap;

    for (var i = 0; i < this.items.length; i++) {
      var item = this.items[i];
      var ar = item.width / item.height;
      pending.push(item);
      aspectSum += ar;

      var gaps = gap * (pending.length - 1);
      var rowWidthAtTarget = aspectSum * target + gaps;

      if (rowWidthAtTarget >= containerWidth && pending.length > 0) {
        var h = (containerWidth - gaps) / aspectSum;
        if (h > this.maxRowHeight) h = this.maxRowHeight;
        rows.push({ items: pending, height: Math.floor(h) });
        pending = [];
        aspectSum = 0;
      }
    }

    if (pending.length) {
      // Last row: keep closer to target height, left-aligned feel via shorter row
      var gapsLast = gap * Math.max(0, pending.length - 1);
      var hLast = Math.min(target, (containerWidth - gapsLast) / aspectSum);
      rows.push({ items: pending, height: Math.floor(hLast) });
    }
    return rows;
  };

  JustifiedGallery.prototype.mount = function () {
    var self = this;
    this.render();
    if (typeof ResizeObserver !== "undefined") {
      var t = null;
      this._ro = new ResizeObserver(function () {
        if (t) cancelAnimationFrame(t);
        t = requestAnimationFrame(function () {
          self.render();
        });
      });
      this._ro.observe(this.el);
    } else {
      window.addEventListener("resize", function () {
        self.render();
      });
    }
  };

  // ---- Scroll: decorative letters ↔ package cards -----------------------------

  function initLetterPackageLink() {
    var letters = document.querySelectorAll(".offer-letter[data-package]");
    var packages = {};
    ["d", "y", "o"].forEach(function (id) {
      packages[id] = document.getElementById("package-" + id);
    });

    if (!letters.length) return;

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // When a letter is mid-viewport on the way down, highlight matching package.
    // Also observe package cards: when a package enters view, light up its letter.
    if ("IntersectionObserver" in window && !reduce) {
      var letterObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var key = entry.target.getAttribute("data-package");
            var card = packages[key];
            if (!card) return;
            if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
              entry.target.classList.add("is-active");
              card.classList.add("is-highlight");
            } else {
              entry.target.classList.remove("is-active");
              // Keep highlight if the package itself is in view
              if (!card.classList.contains("is-inview")) {
                card.classList.remove("is-highlight");
              }
            }
          });
        },
        { threshold: [0, 0.35, 0.6], rootMargin: "-10% 0px -35% 0px" }
      );

      letters.forEach(function (el) {
        letterObserver.observe(el);
      });

      var pkgObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var id = entry.target.id.replace("package-", "");
            var letter = document.querySelector('.offer-letter[data-package="' + id + '"]');
            if (entry.isIntersecting) {
              entry.target.classList.add("is-inview", "is-highlight");
              if (letter) letter.classList.add("is-active");
            } else {
              entry.target.classList.remove("is-inview");
              // Only clear highlight if letter isn't driving it
              if (!letter || !letter.classList.contains("is-active")) {
                entry.target.classList.remove("is-highlight");
              }
              if (letter && !entry.isIntersecting) {
                // leave letter state to letterObserver
              }
            }
          });
        },
        { threshold: 0.45, rootMargin: "0px 0px -20% 0px" }
      );

      Object.keys(packages).forEach(function (k) {
        if (packages[k]) pkgObserver.observe(packages[k]);
      });
    }

    // Subtle parallax on the big letters while hero is visible (cheap rAF)
    var hero = document.querySelector(".offer-hero");
    var letterWrap = document.querySelector(".offer-hero-letters");
    if (hero && letterWrap && !reduce) {
      var ticking = false;
      window.addEventListener(
        "scroll",
        function () {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(function () {
            var rect = hero.getBoundingClientRect();
            var progress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));
            letterWrap.style.transform = "translate3d(0," + (progress * 48).toFixed(1) + "px,0)";
            letterWrap.style.opacity = String(0.14 + progress * 0.06);
            ticking = false;
          });
        },
        { passive: true }
      );
    }
  }

  function initHeaderScroll() {
    var header = document.querySelector(".offer-header");
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function initGallery() {
    var mount = document.getElementById("offer-gallery");
    if (!mount) return;
    // Verify portrait dims for galleries that may differ; measure if needed later.
    var items = shuffle(PLACEHOLDER_GALLERY);
    // Measure any unknown dims on load (optional safety)
    var gallery = new JustifiedGallery(mount, items, {
      targetRowHeight: window.innerWidth < 640 ? 160 : 220,
      gap: 8,
      maxRowHeight: 280
    });
    gallery.mount();
  }

  function boot() {
    initHeaderScroll();
    initGallery();
    initLetterPackageLink();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
