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
    var autoplayDelay = 3000;

    var autoplayTimer = null;

    // Respect accessibility preference
    var reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );


    // =======================================================
    // CREATE IMAGE CAROUSEL DOTS
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
    // UPDATE IMAGE CAROUSEL POSITION
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
    // NEXT IMAGE SLIDE
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
    // PREVIOUS IMAGE SLIDE
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
    // IMAGE CAROUSEL AUTOPLAY
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
    // IMAGE CAROUSEL ARROW CONTROLS
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
    // PAUSE IMAGE CAROUSEL WHEN USER INTERACTS
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

    if (typeof reduceMotion.addEventListener === 'function') {

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

    }


    // =======================================================
    // INITIALIZE IMAGE CAROUSEL
    // =======================================================

    updateCarousel();
    startAutoplay();

  }


  // =========================================================
  // HOMEPAGE REVIEW CAROUSEL
  // ONE REVIEW DISPLAYED AT A TIME
  // =========================================================

  var reviewsCarousel = document.querySelector('.reviews-carousel');

  if (reviewsCarousel) {

    var reviewsViewport = reviewsCarousel.querySelector(
      '.reviews-carousel-viewport'
    );

    var reviewsTrack = reviewsCarousel.querySelector(
      '.reviews-carousel-track'
    );

    var reviewSlides = Array.from(
      reviewsCarousel.querySelectorAll('.reviews-carousel-slide')
    );

    var reviewsPrevButton = reviewsCarousel.querySelector(
      '.reviews-carousel-prev'
    );

    var reviewsNextButton = reviewsCarousel.querySelector(
      '.reviews-carousel-next'
    );

    var reviewsDotsContainer = reviewsCarousel.querySelector(
      '.reviews-carousel-dots'
    );

    var reviewsCounter = reviewsCarousel.querySelector(
      '.reviews-carousel-counter'
    );

    var reviewCurrentIndex = 0;


    // =======================================================
    // CREATE REVIEW DOTS
    // =======================================================

    if (reviewsDotsContainer) {

      // Clear anything already inside so dots cannot duplicate
      reviewsDotsContainer.innerHTML = '';

      reviewSlides.forEach(function (_, index) {

        var reviewDot = document.createElement('button');

        reviewDot.className = 'reviews-carousel-dot';
        reviewDot.type = 'button';

        reviewDot.setAttribute(
          'aria-label',
          'Show review ' + (index + 1)
        );

        reviewDot.addEventListener('click', function () {

          reviewCurrentIndex = index;

          updateReviewsCarousel();

        });

        reviewsDotsContainer.appendChild(reviewDot);

      });

    }


    var reviewDots = reviewsDotsContainer
      ? Array.from(
          reviewsDotsContainer.querySelectorAll(
            '.reviews-carousel-dot'
          )
        )
      : [];


    // =======================================================
    // GET CURRENT REVIEW SLIDE HEIGHT
    //
    // Desktop CSS = 330px
    // Mobile CSS  = 360px
    //
    // We read the actual rendered height instead of hard-
    // coding it here. That keeps the JS synchronized with CSS.
    // =======================================================

    function getReviewSlideHeight() {

      if (reviewSlides.length === 0) {
        return 0;
      }

      return reviewSlides[0].getBoundingClientRect().height;

    }


    // =======================================================
    // UPDATE REVIEW CAROUSEL
    // =======================================================

    function updateReviewsCarousel() {

      if (
        !reviewsTrack ||
        reviewSlides.length === 0
      ) {
        return;
      }


      var slideHeight = getReviewSlideHeight();

      var moveAmount =
        reviewCurrentIndex * slideHeight;


      // Move vertically exactly one review at a time
      reviewsTrack.style.transform =
        'translateY(-' + moveAmount + 'px)';


      // Update review dots
      reviewDots.forEach(function (dot, index) {

        var isActive =
          index === reviewCurrentIndex;

        dot.classList.toggle(
          'active',
          isActive
        );

        dot.setAttribute(
          'aria-current',
          isActive ? 'true' : 'false'
        );

      });


      // Optional counter support
      //
      // Supports HTML such as:
      //
      // <span class="reviews-carousel-current">1</span>
      // <span class="reviews-carousel-total">3</span>

      if (reviewsCounter) {

        var currentCounter =
          reviewsCounter.querySelector(
            '.reviews-carousel-current'
          );

        var totalCounter =
          reviewsCounter.querySelector(
            '.reviews-carousel-total'
          );

        if (currentCounter) {
          currentCounter.textContent =
            reviewCurrentIndex + 1;
        }

        if (totalCounter) {
          totalCounter.textContent =
            reviewSlides.length;
        }

      }


      // Accessibility:
      // only the currently displayed review is treated
      // as the active visible slide

      reviewSlides.forEach(function (slide, index) {

        var isCurrent =
          index === reviewCurrentIndex;

        slide.setAttribute(
          'aria-hidden',
          isCurrent ? 'false' : 'true'
        );

      });

    }


    // =======================================================
    // NEXT REVIEW
    // =======================================================

    function nextReview() {

      if (reviewSlides.length === 0) {
        return;
      }

      reviewCurrentIndex =
        reviewCurrentIndex === reviewSlides.length - 1
          ? 0
          : reviewCurrentIndex + 1;

      updateReviewsCarousel();

    }


    // =======================================================
    // PREVIOUS REVIEW
    // =======================================================

    function previousReview() {

      if (reviewSlides.length === 0) {
        return;
      }

      reviewCurrentIndex =
        reviewCurrentIndex === 0
          ? reviewSlides.length - 1
          : reviewCurrentIndex - 1;

      updateReviewsCarousel();

    }


    // =======================================================
    // REVIEW ARROW CONTROLS
    // =======================================================

    if (reviewsPrevButton) {

      reviewsPrevButton.addEventListener(
        'click',
        function () {

          previousReview();

        }
      );

    }


    if (reviewsNextButton) {

      reviewsNextButton.addEventListener(
        'click',
        function () {

          nextReview();

        }
      );

    }


    // =======================================================
    // KEYBOARD CONTROLS
    // =======================================================

    if (reviewsViewport) {

      reviewsViewport.addEventListener(
        'keydown',
        function (event) {

          if (
            event.key === 'ArrowDown' ||
            event.key === 'ArrowRight'
          ) {

            event.preventDefault();

            nextReview();

          }


          if (
            event.key === 'ArrowUp' ||
            event.key === 'ArrowLeft'
          ) {

            event.preventDefault();

            previousReview();

          }

        }
      );

    }


    // =======================================================
    // HANDLE SCREEN SIZE CHANGES
    //
    // Important because review slides are:
    // 330px tall on desktop
    // 360px tall on mobile.
    // =======================================================

    var reviewResizeTimer = null;

    window.addEventListener(
      'resize',
      function () {

        clearTimeout(reviewResizeTimer);

        reviewResizeTimer = setTimeout(
          function () {

            updateReviewsCarousel();

          },
          100
        );

      }
    );


    // =======================================================
    // INITIALIZE REVIEW CAROUSEL
    // =======================================================

    updateReviewsCarousel();

  }

});
