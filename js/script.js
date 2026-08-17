// Olly's Baked Assortments — shared site behavior
document.addEventListener('DOMContentLoaded', function () {

  // =========================================================
  // FOOTER YEAR
  // =========================================================

  var yearEl = document.getElementById('year');

  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }


  // =========================================================
  // MOBILE NAVIGATION
  // =========================================================

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');

  if (toggle && nav) {

    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');

      toggle.setAttribute(
        'aria-expanded',
        isOpen ? 'true' : 'false'
      );
    });

    nav.querySelectorAll('a').forEach(function (link) {

      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });

    });
  }


  // =========================================================
  // HOMEPAGE IMAGE CAROUSEL
  // =========================================================

  var carousel = document.querySelector('.home-carousel');

  if (carousel) {

    var track = carousel.querySelector('.carousel-track');
    var slides = Array.from(
      carousel.querySelectorAll('.carousel-slide')
    );

    var prevButton = carousel.querySelector('.carousel-prev');
    var nextButton = carousel.querySelector('.carousel-next');
    var dotsContainer = carousel.querySelector('.carousel-dots');

    var currentIndex = 0;

    // Time between automatic slides
    var autoplayDelay = 5000;

    var autoplayTimer = null;

    // Respect accessibility preference
    var reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );


    // =======================================================
    // CREATE CAROUSEL DOTS
    // =======================================================

    if (dotsContainer) {

      // Prevent duplicate dots if script is ever initialized again
      dotsContainer.innerHTML = '';

      slides.forEach(function (_, index) {

        var dot = document.createElement('button');

        dot.className = 'carousel-dot';
        dot.type = 'button';

        dot.setAttribute(
          'aria-label',
          'Show image ' + (index + 1)
        );

        dot.addEventListener('click', function () {

          currentIndex = index;

          updateCarousel();
          restartAutoplay();

        });

        dotsContainer.appendChild(dot);

      });
    }


    var dots = dotsContainer
      ? Array.from(
          dotsContainer.querySelectorAll('.carousel-dot')
        )
      : [];


    // =======================================================
    // UPDATE CAROUSEL POSITION
    // =======================================================

    function updateCarousel() {

      if (!track || slides.length === 0) {
        return;
      }

      track.style.transform =
        'translateX(-' + (currentIndex * 100) + '%)';


      // Update active dot
      dots.forEach(function (dot, index) {

        var isActive = index === currentIndex;

        dot.classList.toggle(
          'active',
          isActive
        );

        dot.setAttribute(
          'aria-current',
          isActive ? 'true' : 'false'
        );

      });

    }


    // =======================================================
    // NEXT SLIDE
    // =======================================================

    function nextSlide() {

      if (slides.length === 0) {
        return;
      }

      currentIndex =
        currentIndex === slides.length - 1
          ? 0
          : currentIndex + 1;

      updateCarousel();

    }


    // =======================================================
    // PREVIOUS SLIDE
    // =======================================================

    function previousSlide() {

      if (slides.length === 0) {
        return;
      }

      currentIndex =
        currentIndex === 0
          ? slides.length - 1
          : currentIndex - 1;

      updateCarousel();

    }


    // =======================================================
    // AUTOPLAY
    // =======================================================

    function startAutoplay() {

      // Don't autoplay if:
      // - there's only one image
      // - user prefers reduced motion
      // - browser tab isn't visible

      if (
        slides.length <= 1 ||
        reduceMotion.matches ||
        document.hidden
      ) {
        return;
      }


      stopAutoplay();


      autoplayTimer = setInterval(function () {

        nextSlide();

      }, autoplayDelay);

    }


    function stopAutoplay() {

      if (autoplayTimer !== null) {

        clearInterval(autoplayTimer);

        autoplayTimer = null;

      }

    }


    function restartAutoplay() {

      stopAutoplay();
      startAutoplay();

    }


    // =======================================================
    // ARROW CONTROLS
    // =======================================================

    if (prevButton) {

      prevButton.addEventListener('click', function () {

        previousSlide();
        restartAutoplay();

      });

    }


    if (nextButton) {

      nextButton.addEventListener('click', function () {

        nextSlide();
        restartAutoplay();

      });

    }


    // =======================================================
    // PAUSE WHEN USER INTERACTS
    // =======================================================

    // Desktop mouse
    carousel.addEventListener('mouseenter', function () {
      stopAutoplay();
    });

    carousel.addEventListener('mouseleave', function () {
      startAutoplay();
    });


    // Mobile / touchscreen
    carousel.addEventListener(
      'touchstart',
      function () {
        stopAutoplay();
      },
      { passive: true }
    );

    carousel.addEventListener(
      'touchend',
      function () {
        startAutoplay();
      },
      { passive: true }
    );


    // =======================================================
    // BROWSER TAB VISIBILITY
    // =======================================================

    document.addEventListener(
      'visibilitychange',
      function () {

        if (document.hidden) {

          stopAutoplay();

        } else {

          startAutoplay();

        }

      }
    );


    // =======================================================
    // REDUCED MOTION SETTING
    // =======================================================

    reduceMotion.addEventListener(
      'change',
      function () {

        if (reduceMotion.matches) {

          stopAutoplay();

        } else {

          startAutoplay();

        }

      }
    );


    // =======================================================
    // INITIALIZE
    // =======================================================

    updateCarousel();
    startAutoplay();

  }

});
