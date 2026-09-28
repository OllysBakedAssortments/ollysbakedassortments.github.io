(() => {
  'use strict';

  const API_BASE =
    'https://api.ollysbakedassortments.com';

  const LOGIN_PAGE =
    '/crew/crew-login.html';

  let sessionCheckInProgress = false;


  /* =========================================
     GET CURRENT CREW SESSION
  ========================================== */

  async function getCrewSession() {
    try {
      const response = await fetch(
        `${API_BASE}/crew/session`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        data.ok !== true ||
        data.authenticated !== true
      ) {
        return null;
      }

      return data;

    } catch (error) {
      console.error(
        'Crew session validation failed:',
        error
      );

      return null;
    }
  }


  /* =========================================
     REQUIRE ACTIVE CREW SESSION
  ========================================== */

  async function requireCrewSession() {
    const session =
      await getCrewSession();

    if (!session) {
      window.location.replace(LOGIN_PAGE);
      return null;
    }

    window.OBA_CREW_SESSION = session;

    document.dispatchEvent(
      new CustomEvent(
        'oba:crew-session-ready',
        {
          detail: session
        }
      )
    );

    return session;
  }


  /* =========================================
     RECHECK EXISTING SESSION
  ========================================== */

  async function recheckCrewSession() {

    if (sessionCheckInProgress) {
      return;
    }

    sessionCheckInProgress = true;

    try {
      const session =
        await getCrewSession();

      if (!session) {
        window.OBA_CREW_SESSION = null;

        window.location.replace(
          LOGIN_PAGE
        );

        return;
      }

      window.OBA_CREW_SESSION = session;

    } finally {
      sessionCheckInProgress = false;
    }
  }


  /* =========================================
     RECHECK WHEN USER RETURNS TO PAGE
  ========================================== */

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        document.visibilityState === 'visible' &&
        window.OBA_CREW_SESSION
      ) {
        recheckCrewSession();
      }
    }
  );


  window.addEventListener(
    'focus',
    () => {
      if (window.OBA_CREW_SESSION) {
        recheckCrewSession();
      }
    }
  );


  /* =========================================
     PUBLIC CREW AUTH API
  ========================================== */

  window.OBA_CREW_AUTH = {
    API_BASE,
    getCrewSession,
    requireCrewSession,
    recheckCrewSession
  };

})();
