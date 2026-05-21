const statNumbers = document.querySelectorAll("[data-count]");
const carousel = document.querySelector("[data-carousel]");

if (carousel) {
  const slides = Array.from(carousel.querySelectorAll(".portfolio-slide"));
  const dots = Array.from(carousel.querySelectorAll(".carousel-dots button"));
  const prevButton = carousel.querySelector(".carousel-prev");
  const nextButton = carousel.querySelector(".carousel-next");

  let currentIndex = 0;
  let autoplay;

  function showSlide(index) {
    currentIndex = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === currentIndex);
    });

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === currentIndex);
    });
  }

  function nextSlide() {
    showSlide(currentIndex + 1);
  }

  function prevSlide() {
    showSlide(currentIndex - 1);
  }

  function startAutoplay() {
    autoplay = window.setInterval(nextSlide, 6000);
  }

  function resetAutoplay() {
    window.clearInterval(autoplay);
    startAutoplay();
  }

  nextButton.addEventListener("click", () => {
    nextSlide();
    resetAutoplay();
  });

  prevButton.addEventListener("click", () => {
    prevSlide();
    resetAutoplay();
  });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showSlide(index);
      resetAutoplay();
    });
  });

  showSlide(currentIndex);
  startAutoplay();
}


const mosaic = document.querySelector("[data-mosaic]");

if (mosaic) {
  const images = [
    "assets/images/optimized/portfolio/portfolio-01.webp",
    "assets/images/optimized/gallery/gallery-01.webp",
    "assets/images/optimized/portfolio/portfolio-02.webp",
    "assets/images/optimized/gallery/gallery-02.webp",
    "assets/images/optimized/gallery/gallery-03.webp",
    "assets/images/optimized/gallery/gallery-04.webp",
    "assets/images/optimized/galleries/vlad-denisa.webp",
    "assets/images/optimized/galleries/david-esra.webp",
    "assets/images/optimized/galleries/rus-a-viii-a.webp",
    "assets/images/optimized/galleries/babeni-a-viii-a.webp",
    "assets/images/optimized/galleries/letca-a-viii-a.webp",
    "assets/images/optimized/portfolio/portfolio-04.webp"
  ];

  function getImageOrientation(width, height) {
    const ratio = width / height;

    if (ratio > 1.18) {
      return "landscape";
    }

    if (ratio < 0.85) {
      return "portrait";
    }

    return "square";
  }

  images.forEach((src, index) => {
    const loader = new Image();

    loader.onload = () => {
      const orientation = getImageOrientation(loader.naturalWidth, loader.naturalHeight);

      const item = document.createElement("div");
      item.className = `mosaic-item mosaic-${orientation}`;
      item.style.backgroundImage = `url("${src}")`;
      item.setAttribute("aria-label", `Portfolio image ${index + 1}`);

      mosaic.appendChild(item);
    };

    loader.onerror = () => {
      console.warn(`Could not load mosaic image: ${src}`);
    };

    loader.src = src;
  });
}


if (statNumbers.length) {
  const animateNumber = (element) => {
    const target = Number(element.dataset.count);
    const suffix = element.dataset.suffix || "";
    const duration = 1400;
    const startTime = performance.now();

    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(target * easedProgress);

      element.textContent = `${currentValue}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  };

  const statsObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        animateNumber(entry.target);
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.45
    }
  );

  statNumbers.forEach((number) => {
    statsObserver.observe(number);
  });
}
