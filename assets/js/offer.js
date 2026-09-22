/**
 * DYO — Albume Absolvenți (Promoția 2027)
 * Masonry gallery + shuffle + scroll-linked D/Y/O → package highlight
 * + inquiry modal (WhatsApp / e-mail)
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Gallery images: loaded from offer-gallery/manifest.json (WebP from Ramase).
  var OFFER_GALLERY = [];
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

  // ---- Masonry gallery (CSS columns + shuffle) -------------------------------

  function MasonryGallery(el, items) {
    this.el = el;
    this.items = items || [];
  }

  MasonryGallery.prototype.setItems = function (items) {
    this.items = items || [];
    this.render();
  };

  MasonryGallery.prototype.render = function () {
    var html = "";
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      html +=
        '<figure class="masonry-item" role="listitem">' +
        '<img src="' +
        it.src +
        '" alt="' +
        (it.alt || "DYO") +
        '" width="' +
        (it.width || "") +
        '" height="' +
        (it.height || "") +
        '" loading="lazy" decoding="async" />' +
        "</figure>";
    }
    this.el.innerHTML = html;
  };

  MasonryGallery.prototype.mount = function () {
    this.render();
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
              if (!letter || !letter.classList.contains("is-active")) {
                entry.target.classList.remove("is-highlight");
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

  // ---- Gallery + reshuffle ----------------------------------------------------

  var galleryInstance = null;


  function reshuffleGallery() {
    if (!galleryInstance) return;
    galleryInstance.setItems(shuffle(OFFER_GALLERY));
  }

  function bindGalleryControls() {
    var refreshBtn = document.getElementById("gallery-refresh");
    if (refreshBtn && !refreshBtn.dataset.bound) {
      refreshBtn.dataset.bound = "1";
      refreshBtn.addEventListener("click", function () {
        reshuffleGallery();
      });
    }
  }

  function mountGallery(items) {
    var mount = document.getElementById("offer-gallery");
    if (!mount) return;
    OFFER_GALLERY = items || [];
    galleryInstance = new MasonryGallery(mount, shuffle(OFFER_GALLERY));
    galleryInstance.mount();
    bindGalleryControls();
  }

  function initGallery() {
    var mount = document.getElementById("offer-gallery");
    if (!mount) return;
    bindGalleryControls();
    fetch("assets/images/optimized/offer-gallery/manifest.json")
      .then(function (r) {
        if (!r.ok) throw new Error("manifest " + r.status);
        return r.json();
      })
      .then(function (items) {
        mountGallery(items);
      })
      .catch(function (err) {
        console.warn("DYO gallery manifest failed", err);
        mount.innerHTML = "<p class=\"gallery-hint\">Galeria se încarcă în curând.</p>";
      });
  }

  // Expose for optional external use / debugging
  window.DYOOfferGallery = {
    reshuffle: reshuffleGallery
  };

  // ---- Inquiry modal ----------------------------------------------------------

  function buildInquiryMessage(data) {
    var lines = [
      "Bună DYO! Sunt interesat(ă) de albumele pentru Promoția 2027.",
      "",
      "Școală / liceu: " + data.school,
      "Clasă: " + data.className,
      "Număr elevi: " + data.students
    ];
    if (data.name) lines.push("Nume: " + data.name);
    if (data.phone) lines.push("Telefon: " + data.phone);
    return lines.join("\n");
  }

  function collectInquiry(form) {
    var fd = new FormData(form);
    return {
      school: String(fd.get("school") || "").trim(),
      className: String(fd.get("class") || "").trim(),
      students: String(fd.get("students") || "").trim(),
      name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || "").trim()
    };
  }

  function initInquiryModal() {
    var modal = document.getElementById("inquiry-modal");
    var openBtn = document.getElementById("inquiry-open");
    var form = document.getElementById("inquiry-form");
    if (!modal || !openBtn || !form) return;

    var closeEls = modal.querySelectorAll("[data-inquiry-close]");
    var lastFocus = null;

    function openModal() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.body.classList.add("modal-open");
      var first = form.querySelector("input");
      if (first) first.focus();
    }

    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove("modal-open");
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    }

    openBtn.addEventListener("click", function (e) {
      e.preventDefault();
      openModal();
    });

    closeEls.forEach(function (el) {
      el.addEventListener("click", closeModal);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var actionBtn = e.submitter || form.querySelector("[data-action]");
      var action = (actionBtn && actionBtn.getAttribute("data-action")) || "whatsapp";
      var data = collectInquiry(form);

      if (!data.school || !data.className || !data.students) {
        form.reportValidity();
        return;
      }

      var message = buildInquiryMessage(data);

      if (action === "email") {
        var subject = encodeURIComponent("Promoția 2027 — " + data.school + " · " + data.className);
        var body = encodeURIComponent(message);
        window.location.href = "mailto:DYO.office@gmail.com?subject=" + subject + "&body=" + body;
      } else {
        var wa = "https://wa.me/40754241346?text=" + encodeURIComponent(message);
        window.open(wa, "_blank", "noopener");
      }
    });
  }

  function boot() {
    initHeaderScroll();
    initGallery();
    initLetterPackageLink();
    initInquiryModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
