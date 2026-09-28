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

    longnecks: {
      href: '/crew/longnecks.html',
      mobileLabel: 'Longnecks'
    },

    polls: {
      href: '/crew/polls.html',
      mobileLabel: 'Polls'
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

    if (path.endsWith('/longnecks.html')) {
      return 'longnecks';
    }

    if (path.endsWith('/polls.html')) {
      return 'polls';
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
     MOBILE BAR
  ========================================================= */

  function buildMobileBar(activePage) {
    const config =
      PAGE_CONFIG[activePage] ||
      PAGE_CONFIG.dashboard;

    return `
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


        ${
          activePage === 'account'
            ? `
              <a
                class="crew-button"
                href="/crew/dashboard.html"
              >
                Command Center
              </a>
            `
            : `
              <a
                class="crew-button"
                href="/crew/account.html"
              >
                Account
              </a>
            `
        }

      </div>
    `;
  }


  /* =========================================================
     CREW IDENTITY
  ========================================================= */

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
