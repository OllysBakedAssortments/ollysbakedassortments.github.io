(() => {
  'use strict';

  /* =========================================================
     OBA COOKIE CREW — SHARED SHELL

     Owns:
     - Desktop Crew sidebar
     - Canonical navigation structure
     - Active-page state
     - Account footer
     - Mobile Crew bar
     - Crew identity rendering

     Does NOT own:
     - Page header
     - Page-specific actions
     - Page content
     - Page-specific API logic
  ========================================================= */


  const PAGE_CONFIG = {
    dashboard: {
      href: '/crew/dashboard.html',
      mobileLabel: 'Command Center'
    },

    inventory: {
      href: '/crew/inventory.html',
      mobileLabel: 'Inventory'
    },

    pickup: {
      href: '/crew/pickup.html',
      mobileLabel: 'Pickups'
    },

    drops: {
      href: '/crew/drops.html',
      mobileLabel: 'Drops'
    },

    schedule: {
      href: '/crew/schedule.html',
      mobileLabel: 'Crew Schedule'
    },

    bulletin: {
      href: '/crew/bulletin.html',
      mobileLabel: 'Bertha Bulletin'
    },

    adventureHub: { href: '/crew/adventure-hub.html', mobileLabel: 'Adventure Hub' },
    adventures: { href: '/crew/adventures.html', mobileLabel: 'Adventure Manager' },
    longnecks: {
      href: '/crew/longnecks.html',
      mobileLabel: 'Longnecks'
    },

    polls: {
      href: '/crew/polls.html',
      mobileLabel: 'Polls'
    },

    reviews: {
      href: '/crew/reviews-manager.html',
      mobileLabel: 'Reviews'
    },

    analytics: {
      href: '/crew/analytics.html',
      mobileLabel: 'Analytics'
    },

    products: {
      href: '/crew/products.html',
      mobileLabel: 'Products'
    },

    settings: {
      href: '/crew/settings.html',
      mobileLabel: 'Settings'
    },

    crewAccess: {
      href: '/crew/crew-access.html',
      mobileLabel: 'Crew Access'
    },

    account: {
      href: '/crew/account.html',
      mobileLabel: 'Account Settings'
    }
  };


  const NAV_GROUPS = [
    {
      label: 'Operations',
      ariaLabel: 'Crew operations',

      items: [
        {
          page: 'dashboard',
          label: 'Command Center',
          icon: '⌂'
        },

        {
          page: 'inventory',
          label: 'Inventory',
          icon: '▦'
        },

        {
          page: 'pickup',
          label: 'Pickups',
          icon: '◫'
        },

        {
          page: 'drops',
          label: 'Drops',
          icon: '◉'
        },

        {
          page: 'schedule',
          label: 'Crew Schedule',
          icon: '▣'
        }
      ]
    },

    {
      label: 'Longnecks',
      ariaLabel: 'Longneck tools',

      items: [
        {
          page: 'bulletin',
          label: 'Bertha Bulletin',
          icon: '✉'
        },

        {
          page: 'adventureHub', label: 'Adventure Hub', icon: '◇'
        },
        {
          page: 'longnecks',
          label: 'Longnecks',
          icon: '♙'
        },

        {
          page: 'polls',
          label: 'Polls',
          icon: '✓'
        }
      ]
    },

    {
      label: 'Business',
      ariaLabel: 'Business tools',

      items: [
        {
          page: 'reviews',
          label: 'Reviews',
          icon: '★'
        },

        {
          page: 'analytics',
          label: 'Analytics',
          icon: '↗'
        },

        {
          page: 'products',
          label: 'Products',
          icon: '◇'
        },

        {
          page: 'crewAccess',
          label: 'Crew Access',
          icon: '♟'
        },

        {
          page: 'settings',
          label: 'Settings',
          icon: '⚙'
        }
      ]
    }
  ];


  /* =========================================================
     HELPERS
  ========================================================= */

  function normalizePage(page) {
    if (
      typeof page === 'string' &&
      PAGE_CONFIG[page]
    ) {
      return page;
    }

    return detectPage();
  }


  function detectPage() {
    const path =
      window.location.pathname
        .toLowerCase();

    if (
      path.endsWith('/dashboard.html') ||
      path.endsWith('/crew/')
    ) {
      return 'dashboard';
    }

    if (path.endsWith('/inventory.html')) {
      return 'inventory';
    }

    if (path.endsWith('/pickup.html')) {
      return 'pickup';
    }

    if (path.endsWith('/drops.html')) {
      return 'drops';
    }

    if (path.endsWith('/schedule.html')) {
      return 'schedule';
    }

    if (path.endsWith('/bulletin.html')) {
      return 'bulletin';
    }

    if (path.endsWith('/adventure-hub.html')) return 'adventureHub';
    if (path.endsWith('/adventures.html')) return 'adventureHub';
    if (path.endsWith('/longnecks.html')) {
      return 'longnecks';
    }

    if (path.endsWith('/polls.html')) {
      return 'polls';
    }

    if (path.endsWith('/reviews-manager.html')) {
      return 'reviews';
    }

    if (path.endsWith('/analytics.html')) {
      return 'analytics';
    }

    if (path.endsWith('/products.html')) {
      return 'products';
    }

    if (path.endsWith('/settings.html')) {
      return 'settings';
    }

    if (path.endsWith('/crew-access.html')) {
      return 'crewAccess';
    }

    if (path.endsWith('/account.html')) {
      return 'account';
    }

    return 'dashboard';
  }


  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }


  function formatRole(role) {
    if (!role) {
      return 'Crew';
    }

    return (
      role.charAt(0).toUpperCase() +
      role.slice(1)
    );
  }


  /* =========================================================
     NAVIGATION
  ========================================================= */

  function buildNavigation(activePage) {
    return NAV_GROUPS
      .map(group => {

        const items =
          group.items
            .map(item => {

              const config =
                PAGE_CONFIG[item.page];

              const isActive =
                item.page === activePage;

              return `
                <a
                  href="${config.href}"
                  ${
                    isActive
                      ? 'aria-current="page"'
                      : ''
                  }
                >
                  <span class="crew-nav-icon">
                    ${escapeHtml(item.icon)}
                  </span>

                  ${escapeHtml(item.label)}
                </a>
              `;
            })
            .join('');


        return `
          <div class="crew-nav-section-label">
            ${escapeHtml(group.label)}
          </div>

          <nav
            class="crew-nav"
            aria-label="${escapeHtml(
              group.ariaLabel
            )}"
          >
            ${items}
          </nav>
        `;
      })
      .join('');
  }


  /* =========================================================
     DESKTOP SIDEBAR
  ========================================================= */

  function buildSidebar(activePage) {
    const accountIsActive =
      activePage === 'account';

    return `
      <aside class="crew-sidebar">

        <a
          class="crew-brand"
          href="/crew/dashboard.html"
        >
          <img
            src="/images/brand/logo.png"
            alt=""
          >

          <span class="crew-brand-copy">
            <strong>
              OBA Cookie Crew
            </strong>

            <span>
              Crew Operations
            </span>
          </span>
        </a>


        ${buildNavigation(activePage)}


        <div class="crew-sidebar-footer">

          <a
            href="/crew/account.html"
            class="crew-account-link"
            ${
              accountIsActive
                ? 'aria-current="page"'
                : ''
            }
          >
            <strong data-crew-user-name>
              Cookie Crew
            </strong>

            <span data-crew-user-role>
              Authenticated Crew Operations
            </span>
          </a>

        </div>

      </aside>
    `;
  }


  /* =========================================================
     MOBILE NAVIGATION
  ========================================================= */

  function buildMobileNavigation(activePage) {
    return NAV_GROUPS
      .map(group => {

        const items =
          group.items
            .map(item => {

              const config =
                PAGE_CONFIG[item.page];

              const isActive =
                item.page === activePage;

              return `
                <a
                  href="${config.href}"
                  class="crew-mobile-nav-link"
                  ${
                    isActive
                      ? 'aria-current="page"'
                      : ''
                  }
                >
                  <span class="crew-nav-icon">
                    ${escapeHtml(item.icon)}
                  </span>

                  <span>
                    ${escapeHtml(item.label)}
                  </span>
                </a>
              `;
            })
            .join('');


        return `
          <div class="crew-mobile-nav-group">

            <div class="crew-nav-section-label">
              ${escapeHtml(group.label)}
            </div>

            <nav
              class="crew-mobile-nav-links"
              aria-label="${escapeHtml(
                group.ariaLabel
              )}"
            >
              ${items}
            </nav>

          </div>
        `;
      })
      .join('');
  }


  function buildMobileBar(activePage) {
    const config =
      PAGE_CONFIG[activePage] ||
      PAGE_CONFIG.dashboard;

    const accountIsActive =
      activePage === 'account';

    return `
      <div class="crew-mobile-shell">

        <div class="crew-mobile-bar">

          <a
            class="crew-mobile-brand"
            href="/crew/dashboard.html"
          >
            <img
              src="/images/brand/logo.png"
              alt=""
            >

            <span>
              Cookie Crew ·
              ${escapeHtml(
                config.mobileLabel
              )}
            </span>
          </a>


          <button
            type="button"
            class="crew-button crew-mobile-menu-button"
            data-crew-menu-button
            aria-expanded="false"
            aria-controls="crew-mobile-drawer"
          >
            Crew Menu
          </button>

        </div>


        <div
          class="crew-mobile-overlay"
          data-crew-menu-overlay
          hidden
        ></div>


        <aside
          class="crew-mobile-drawer"
          id="crew-mobile-drawer"
          data-crew-menu-drawer
          aria-hidden="true"
        >

          <div class="crew-mobile-drawer-header">

            <a
              class="crew-brand"
              href="/crew/dashboard.html"
            >
              <img
                src="/images/brand/logo.png"
                alt=""
              >

              <span class="crew-brand-copy">
                <strong>
                  OBA Cookie Crew
                </strong>

                <span>
                  Crew Operations
                </span>
              </span>
            </a>


            <button
              type="button"
              class="crew-mobile-menu-close"
              data-crew-menu-close
              aria-label="Close Crew menu"
            >
              ×
            </button>

          </div>


          <div class="crew-mobile-drawer-content">

            ${buildMobileNavigation(activePage)}

          </div>


          <div class="crew-mobile-drawer-footer">

            <a
              href="/crew/account.html"
              class="crew-account-link"
              ${
                accountIsActive
                  ? 'aria-current="page"'
                  : ''
              }
            >
              <strong data-crew-user-name>
                Cookie Crew
              </strong>

              <span data-crew-user-role>
                Authenticated Crew Operations
              </span>
            </a>

          </div>

        </aside>

      </div>
    `;
  }


  function initializeMobileMenu() {
    const button =
      document.querySelector(
        '[data-crew-menu-button]'
      );

    const drawer =
      document.querySelector(
        '[data-crew-menu-drawer]'
      );

    const overlay =
      document.querySelector(
        '[data-crew-menu-overlay]'
      );

    const closeButton =
      document.querySelector(
        '[data-crew-menu-close]'
      );


    if (
      !button ||
      !drawer ||
      !overlay ||
      !closeButton
    ) {
      return;
    }


    function openMenu() {
      drawer.classList.add('is-open');

      overlay.hidden = false;

      requestAnimationFrame(() => {
        overlay.classList.add('is-open');
      });

      drawer.setAttribute(
        'aria-hidden',
        'false'
      );

      button.setAttribute(
        'aria-expanded',
        'true'
      );

      document.body.classList.add(
        'crew-menu-open'
      );
    }


    function closeMenu() {
      drawer.classList.remove('is-open');

      overlay.classList.remove('is-open');

      drawer.setAttribute(
        'aria-hidden',
        'true'
      );

      button.setAttribute(
        'aria-expanded',
        'false'
      );

      document.body.classList.remove(
        'crew-menu-open'
      );

      window.setTimeout(() => {
        if (
          !overlay.classList.contains(
            'is-open'
          )
        ) {
          overlay.hidden = true;
        }
      }, 180);
    }


    button.addEventListener(
      'click',
      openMenu
    );

    closeButton.addEventListener(
      'click',
      closeMenu
    );

    overlay.addEventListener(
      'click',
      closeMenu
    );


    drawer
      .querySelectorAll('a')
      .forEach(link => {
        link.addEventListener(
          'click',
          closeMenu
        );
      });


    document.addEventListener(
      'keydown',
      event => {
        if (
          event.key === 'Escape' &&
          drawer.classList.contains(
            'is-open'
          )
        ) {
          closeMenu();

          button.focus();
        }
      }
    );
  }


  /* =========================================================
     CREW IDENTITY
  ========================================================= */

  const PAGE_PERMISSIONS = {
    dashboard: 'dashboard.view',
    inventory: 'inventory.view',
    pickup: 'pickups.view',
    drops: 'drops.view',
    schedule: 'schedule.view',
    bulletin: 'bulletin.view',
    adventures: 'adventures.view',
    longnecks: 'longnecks.view',
    polls: 'polls.view',
    reviews: 'reviews.view',
    analytics: 'analytics.view',
    products: 'products.view',
    crewAccess: 'crew_access.view',
    settings: 'settings.view'
  };

  function applyPermissionVisibility(session) {
    const user = session?.user || {};
    const role = String(user.role || '').toLowerCase();
    if (role === 'owner') return;
    const rawPermissions = user.effectivePermissions;
    const allowed = new Set(
      Array.isArray(rawPermissions)
        ? rawPermissions
        : Object.entries(rawPermissions || {})
            .filter(([, isAllowed]) => isAllowed === true)
            .map(([permissionKey]) => permissionKey)
    );
    Object.entries(PAGE_PERMISSIONS).forEach(([page, permission]) => {
      if (allowed.has(permission)) return;
      const href = PAGE_CONFIG[page]?.href;
      if (!href) return;
      document.querySelectorAll(`a[href="${href}"]`).forEach(link => {
        const nav = link.closest('.crew-nav, .crew-mobile-nav-links');
        link.remove();
        if (nav && !nav.querySelector('a')) {
          const label = nav.previousElementSibling;
          nav.remove();
          if (label?.classList.contains('crew-nav-section-label')) label.remove();
        }
      });
    });
  }

  function renderCrewIdentity(session) {
    const user =
      session?.user || {};

    const firstName =
      user.firstName || '';

    const lastName =
      user.lastName || '';

    const fullName =
      `${firstName} ${lastName}`.trim() ||
      'Cookie Crew';

    const role =
      formatRole(
        user.role
      );


    document
      .querySelectorAll(
        '[data-crew-user-name]'
      )
      .forEach(element => {
        element.textContent =
          fullName;
      });


    document
      .querySelectorAll(
        '[data-crew-user-role]'
      )
      .forEach(element => {
        element.textContent =
          role;
      });

    applyPermissionVisibility(session);
  }


  /* =========================================================
     SHELL MOUNT
  ========================================================= */

  function mount(options = {}) {
    const activePage =
      normalizePage(
        options.activePage
      );

    const sidebarMount =
      document.querySelector(
        '[data-crew-sidebar]'
      );

    const mobileMount =
      document.querySelector(
        '[data-crew-mobile-bar]'
      );


    if (!sidebarMount) {
      console.error(
        'Crew shell: [data-crew-sidebar] mount not found.'
      );
    } else {
      sidebarMount.outerHTML =
        buildSidebar(activePage);
    }


    if (!mobileMount) {
      console.error(
        'Crew shell: [data-crew-mobile-bar] mount not found.'
      );
    } else {
      mobileMount.outerHTML =
        buildMobileBar(activePage);

      initializeMobileMenu();
    }


    document.dispatchEvent(
      new CustomEvent(
        'oba:crew-shell-ready',
        {
          detail: {
            activePage
          }
        }
      )
    );


    return activePage;
  }


  /* =========================================================
     PUBLIC API
  ========================================================= */

  window.OBA_CREW_SHELL = {
    mount,
    renderCrewIdentity,
    detectPage
  };

})();
