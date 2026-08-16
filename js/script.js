// Olly's Baked Assortments — shared site behavior
document.addEventListener('DOMContentLoaded', function () {

  // Auto-update the copyright year in the footer
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Mobile navigation
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Homepage image carousel
  var carousel = document.querySelector('.home-carousel');

  if (carousel) {
    var track = carousel.querySelector('.carousel-track');
    var slides = Array.from(carousel.querySelectorAll('.carousel-slide'));
    var prevButton = carousel.querySelector('.carousel-prev');
    var nextButton = carousel.querySelector('.carousel-next');
    var dotsContainer = carousel.querySelector('.carousel-dots');

    var currentIndex = 0;

    slides.forEach(function (_, index) {
      var dot = document.createElement('button');
      dot.className = 'carousel-dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', 'Show image ' + (index + 1));

      dot.addEventListener('click', function () {
        currentIndex = index;
        updateCarousel();
      });

      dotsContainer.appendChild(dot);
    });

    var dots = Array.from(
      dotsContainer.querySelectorAll('.carousel-dot')
    );

    function updateCarousel() {
      track.style.transform =
        'translateX(-' + (currentIndex * 100) + '%)';

      dots.forEach(function (dot, index) {
        dot.classList.toggle('active', index === currentIndex);
      });
    }

    prevButton.addEventListener('click', function () {
      currentIndex =
        currentIndex === 0
          ? slides.length - 1
          : currentIndex - 1;

      updateCarousel();
    });

    nextButton.addEventListener('click', function () {
      currentIndex =
        currentIndex === slides.length - 1
          ? 0
          : currentIndex + 1;

      updateCarousel();
    });

    updateCarousel();
  }

});
