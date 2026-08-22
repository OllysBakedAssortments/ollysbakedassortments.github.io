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
  // ONE REVIEW DISPLAYED AT A TIME + AUTOPLAY
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
    // REVIEW AUTOPLAY SETTINGS
    // =======================================================

    // Time each review stays on screen.
    // 3000 = 3 seconds.
    // Change ONLY this number if you want to adjust speed.
    var reviewAutoplayDelay = 3000;

    var reviewAutoplayTimer = null;

    var reviewReduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );


    // =======================================================
    // CREATE REVIEW DOTS
    // =======================================================

    if (reviewsDotsContainer) {

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
          restartReviewAutoplay();

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


      // Update optional review counter
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


      // Accessibility
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
    // REVIEW AUTOPLAY
    // =======================================================

    function startReviewAutoplay() {

      // Do not autoplay if:
      // - there is only one review
      // - reduced motion is enabled
      // - browser tab is hidden

      if (
        reviewSlides.length <= 1 ||
        reviewReduceMotion.matches ||
        document.hidden
      ) {
        return;
      }


      stopReviewAutoplay();


      reviewAutoplayTimer = setInterval(
        function () {

          nextReview();

        },
        reviewAutoplayDelay
      );

    }


    function stopReviewAutoplay() {

      if (reviewAutoplayTimer !== null) {

        clearInterval(reviewAutoplayTimer);

        reviewAutoplayTimer = null;

      }

    }


    function restartReviewAutoplay() {

      stopReviewAutoplay();
      startReviewAutoplay();

    }


    // =======================================================
    // REVIEW ARROW CONTROLS
    // =======================================================

    if (reviewsPrevButton) {

      reviewsPrevButton.addEventListener(
        'click',
        function () {

          previousReview();
          restartReviewAutoplay();

        }
      );

    }


    if (reviewsNextButton) {

      reviewsNextButton.addEventListener(
        'click',
        function () {

          nextReview();
          restartReviewAutoplay();

        }
      );

    }


    // =======================================================
    // PAUSE REVIEW AUTOPLAY DURING INTERACTION
    // =======================================================

    reviewsCarousel.addEventListener(
      'mouseenter',
      function () {

        stopReviewAutoplay();

      }
    );


    reviewsCarousel.addEventListener(
      'mouseleave',
      function () {

        startReviewAutoplay();

      }
    );


    reviewsCarousel.addEventListener(
      'touchstart',
      function () {

        stopReviewAutoplay();

      },
      { passive: true }
    );


    reviewsCarousel.addEventListener(
      'touchend',
      function () {

        startReviewAutoplay();

      },
      { passive: true }
    );


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
            restartReviewAutoplay();

          }


          if (
            event.key === 'ArrowUp' ||
            event.key === 'ArrowLeft'
          ) {

            event.preventDefault();

            previousReview();
            restartReviewAutoplay();

          }

        }
      );

    }


    // =======================================================
    // BROWSER TAB VISIBILITY
    // =======================================================

    document.addEventListener(
      'visibilitychange',
      function () {

        if (document.hidden) {

          stopReviewAutoplay();

        } else {

          startReviewAutoplay();

        }

      }
    );


    // =======================================================
    // REDUCED MOTION SETTING
    // =======================================================

    if (
      typeof reviewReduceMotion.addEventListener === 'function'
    ) {

      reviewReduceMotion.addEventListener(
        'change',
        function () {

          if (reviewReduceMotion.matches) {

            stopReviewAutoplay();

          } else {

            startReviewAutoplay();

          }

        }
      );

    }


    // =======================================================
    // HANDLE SCREEN SIZE CHANGES
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
    startReviewAutoplay();

  }

});
