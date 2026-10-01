const COOKIE_CATALOG = {
  'salted-caramel-bliss': {
    name: 'Salted Caramel Bliss',
    priceCents: 400
  },

  'brown-butter-bliss': {
    name: 'Brown Butter Bliss',
    priceCents: 400
  },

  'biscoff-lava-crunch': {
    name: 'Biscoff Lava Crunch',
    priceCents: 400
  },

  'campfire-crunch': {
    name: 'Campfire Crunch',
    priceCents: 500
  },

  'peanut-campfire-crunch': {
    name: 'Peanut Campfire Crunch',
    priceCents: 500
  },

  'plain-jane': {
    name: 'Plain Jane',
    priceCents: 400
  }
};

/* =========================================
   OBA LOCAL DELIVERY CONFIGURATION
========================================== */

const DELIVERY_ORIGIN =
  '5842 Dugan Avenue, La Mesa, CA 91942';

const DELIVERY_BASE_MILES = 2;
const DELIVERY_BASE_FEE_CENTS = 500;

const DELIVERY_PER_MILE_CENTS = 150;

const MAX_DELIVERY_MILES = 10;

const METERS_PER_MILE = 1609.344;

const SQUARE_WEBHOOK_URL =
  'https://oba-checkout.ollysbakedassortments.workers.dev/square-webhook';


/* =========================================
   CREW AUTH CRYPTO HELPERS
========================================= */

const CREW_PASSWORD_ITERATIONS = 100000;
const CREW_SESSION_BYTES = 32;

const CREW_LOGIN_WINDOW_MINUTES = 15;
const CREW_LOGIN_MAX_EMAIL_FAILURES = 5;
const CREW_LOGIN_MAX_IP_FAILURES = 10;

function bytesToBase64Url(bytes) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const base64 =
    value
      .replace(/-/g, '+')
      .replace(/_/g, '/');

  const padded =
    base64 +
    '='.repeat(
      (4 - (base64.length % 4)) % 4
    );

  const binary = atob(padded);

  return Uint8Array.from(
    binary,
    character => character.charCodeAt(0)
  );
}

function constantTimeEqualBytes(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index++) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}

async function deriveCrewPasswordHash(
  password,
  salt,
  iterations = CREW_PASSWORD_ITERATIONS
) {
  const encoder = new TextEncoder();

  const keyMaterial =
    await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      {
        name: 'PBKDF2'
      },
      false,
      ['deriveBits']
    );

  const derivedBits =
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations
      },
      keyMaterial,
      256
    );

  return new Uint8Array(derivedBits);
}

async function hashCrewPassword(password) {
  if (
    typeof password !== 'string' ||
    password.length < 12
  ) {
    throw new Error(
      'Crew password must be at least 12 characters.'
    );
  }

  const salt =
    crypto.getRandomValues(
      new Uint8Array(16)
    );

  const hash =
    await deriveCrewPasswordHash(
      password,
      salt
    );

  return [
    'pbkdf2_sha256',
    String(CREW_PASSWORD_ITERATIONS),
    bytesToBase64Url(salt),
    bytesToBase64Url(hash)
  ].join('$');
}

async function verifyCrewPassword(
  password,
  storedPasswordHash
) {
  if (
    typeof password !== 'string' ||
    typeof storedPasswordHash !== 'string'
  ) {
    return false;
  }

  const parts =
    storedPasswordHash.split('$');

  if (
    parts.length !== 4 ||
    parts[0] !== 'pbkdf2_sha256'
  ) {
    return false;
  }

  const iterations =
    Number(parts[1]);

  if (
    !Number.isSafeInteger(iterations) ||
    iterations < 1
  ) {
    return false;
  }

  try {
    const salt =
      base64UrlToBytes(parts[2]);

    const expectedHash =
      base64UrlToBytes(parts[3]);

    const actualHash =
      await deriveCrewPasswordHash(
        password,
        salt,
        iterations
      );

    return constantTimeEqualBytes(
      actualHash,
      expectedHash
    );

  } catch {
    return false;
  }
}

function createCrewSessionToken() {
  const tokenBytes =
    crypto.getRandomValues(
      new Uint8Array(CREW_SESSION_BYTES)
    );

  return bytesToBase64Url(tokenBytes);
}

async function hashCrewSessionToken(token) {
  const encoder = new TextEncoder();

  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(token)
    );

  return bytesToBase64Url(
    new Uint8Array(digest)
  );
}

/* =========================================
   CREW PASSWORD RESET HELPERS
========================================= */

const CREW_PASSWORD_RESET_BYTES = 32;

const CREW_PASSWORD_RESET_TTL_MINUTES = 30;


function createCrewPasswordResetToken() {
  const tokenBytes =
    crypto.getRandomValues(
      new Uint8Array(
        CREW_PASSWORD_RESET_BYTES
      )
    );

  return bytesToBase64Url(tokenBytes);
}


async function hashCrewPasswordResetToken(token) {
  const encoder =
    new TextEncoder();

  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(token)
    );

  return bytesToBase64Url(
    new Uint8Array(digest)
  );
}


function getCrewPasswordResetExpiry() {
  return new Date(
    Date.now() +
      CREW_PASSWORD_RESET_TTL_MINUTES *
        60 *
        1000
  ).toISOString();
}

/* =========================================
   CREW LOGIN SECURITY
========================================= */

async function hashCrewLoginIp(request) {
  const rawIp =
    request.headers.get('CF-Connecting-IP') || '';

  if (!rawIp) {
    return null;
  }

  const encoded =
    new TextEncoder().encode(rawIp);

  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      encoded
    );

  return Array.from(
    new Uint8Array(digest)
  )
    .map(byte =>
      byte
        .toString(16)
        .padStart(2, '0')
    )
    .join('');
}

/* =========================================
   CREW SESSION + COOKIE HELPERS
========================================= */

const CREW_SESSION_COOKIE =
  'oba_crew_session';

const CREW_SESSION_TTL_SECONDS =
  60 * 60 * 12; // 12 hours absolute lifetime

const CREW_SESSION_IDLE_SECONDS =
  60 * 30; // 30 minutes inactivity

function parseCookies(request) {
  const cookieHeader =
    request.headers.get('Cookie');

  const cookies = {};

  if (!cookieHeader) {
    return cookies;
  }

  for (const cookiePart of cookieHeader.split(';')) {
    const separatorIndex =
      cookiePart.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const name =
      cookiePart
        .slice(0, separatorIndex)
        .trim();

    const value =
      cookiePart
        .slice(separatorIndex + 1)
        .trim();

    if (name) {
      cookies[name] = value;
    }
  }

  return cookies;
}

function getCrewSessionTokenFromRequest(request) {
  const cookies =
    parseCookies(request);

  const token =
    cookies[CREW_SESSION_COOKIE];

  return (
    typeof token === 'string' &&
    token.length > 0
  )
    ? token
    : null;
}

function createCrewSessionCookie(token) {
  return [
    `${CREW_SESSION_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${CREW_SESSION_TTL_SECONDS}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict'
  ].join('; ');
}

function createExpiredCrewSessionCookie() {
  return [
    `${CREW_SESSION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Strict'
  ].join('; ');
}

function getCrewSessionExpiry() {
  return new Date(
    Date.now() +
    CREW_SESSION_TTL_SECONDS * 1000
  ).toISOString();
}

async function getCrewSession(
  request,
  env
) {
  const token =
    getCrewSessionTokenFromRequest(
      request
    );

  if (!token) {
    return null;
  }

  const tokenHash =
    await hashCrewSessionToken(token);

  const session =
    await env.OBA_DB
      .prepare(`
        SELECT
          s.session_id,
          s.crew_user_id,
          s.created_at,
          s.expires_at,
          s.last_seen_at,

          u.email,
          u.first_name,
          u.last_name,
          u.role,
          u.status

        FROM crew_sessions AS s

        INNER JOIN crew_users AS u
          ON u.crew_user_id =
             s.crew_user_id

        WHERE
          s.token_hash = ?
          AND s.revoked_at IS NULL
          AND datetime(s.expires_at) >
              datetime('now')
          AND u.status = 'active'

        LIMIT 1
      `)
      .bind(tokenHash)
      .first();

  if (!session) {
    return null;
  }

  const lastSeenAt =
    new Date(
      String(session.last_seen_at)
        .replace(' ', 'T') + 'Z'
    );

  const idleMilliseconds =
    Date.now() - lastSeenAt.getTime();

  const maxIdleMilliseconds =
    CREW_SESSION_IDLE_SECONDS * 1000;

  if (
    !Number.isFinite(lastSeenAt.getTime()) ||
    idleMilliseconds > maxIdleMilliseconds
  ) {
    await env.OBA_DB
      .prepare(`
        UPDATE crew_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE session_id = ?
          AND revoked_at IS NULL
      `)
      .bind(session.session_id)
      .run();

    return null;
  }

  await env.OBA_DB
    .prepare(`
      UPDATE crew_sessions
      SET last_seen_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
        AND revoked_at IS NULL
    `)
    .bind(session.session_id)
    .run();

  return {
    sessionId:
      session.session_id,

    crewUserId:
      Number(session.crew_user_id),

    email:
      session.email,

    firstName:
      session.first_name,

    lastName:
      session.last_name,

    role:
      session.role,

    createdAt:
      session.created_at,

    expiresAt:
      session.expires_at,

    lastSeenAt:
      new Date().toISOString()
  };
}

async function getUnavailableReservationItems(
  env,
  dropId,
  requestedItems,
  excludeReservationId = null
) {
  const unavailableItems = [];

  for (const requestedItem of requestedItems) {

    const inventory =
      await env.OBA_DB
        .prepare(`
          SELECT
            i.inventory_item_id,
            i.product_id,
            i.product_name,
            i.quantity_total,
            i.quantity_sold,

            COALESCE(
              SUM(
                CASE
                  WHEN
                    r.status = 'active'
                    AND julianday(r.expires_at) > julianday('now')
                    AND (
                      ? IS NULL
                      OR r.reservation_id != ?
                    )
                  THEN ri.quantity
                  ELSE 0
                END
              ),
              0
            ) AS quantity_reserved

          FROM inventory_items AS i

          LEFT JOIN cart_reservation_items AS ri
            ON ri.inventory_item_id =
              i.inventory_item_id

          LEFT JOIN cart_reservations AS r
            ON r.reservation_id =
              ri.reservation_id

          WHERE
            i.drop_id = ?
            AND i.product_id = ?

          GROUP BY
            i.inventory_item_id,
            i.product_id,
            i.product_name,
            i.quantity_total,
            i.quantity_sold
        `)
        .bind(
          excludeReservationId,
          excludeReservationId,
          dropId,
          requestedItem.productId
        )
        .first();

    const available =
      inventory
        ? Math.max(
            0,
            Number(inventory.quantity_total) -
            Number(inventory.quantity_sold) -
            Number(inventory.quantity_reserved)
          )
        : 0;

    if (
      !inventory ||
      requestedItem.quantity > available
    ) {
      unavailableItems.push({
        productId:
          requestedItem.productId,

        productName:
          requestedItem.productName,

        requested:
          requestedItem.quantity,

        available
      });
    }
  }

  return unavailableItems;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* =========================================
       CORS
    ========================================== */

        const corsHeaders = {
      'Access-Control-Allow-Origin':
        'https://ollysbakedassortments.com',
      'Access-Control-Allow-Methods':
        'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type',
      'Access-Control-Allow-Credentials':
        'true',
      'Vary':
        'Origin'
        };

    /* =========================================
       CREW LOGIN
    ========================================== */

    if (url.pathname === '/crew/login') {

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }

      if (request.method !== 'POST') {
        return Response.json(
          {
            ok: false,
            error: 'Method Not Allowed'
          },
          {
            status: 405,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-store'
            }
          }
        );
      }

      let body;

      try {
        body = await request.json();
      } catch {
        return Response.json(
          {
            ok: false,
            error: 'Invalid request.'
          },
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-store'
            }
          }
        );
      }

      const email =
        typeof body?.email === 'string'
          ? body.email.trim().toLowerCase()
          : '';

      const password =
        typeof body?.password === 'string'
          ? body.password
          : '';

      if (!email || !password) {
        return Response.json(
          {
            ok: false,
            error: 'Email and password are required.'
          },
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-store'
            }
          }
        );
      }


      /* =========================================
         CREW LOGIN RATE LIMIT
      ========================================== */

      const ipHash =
        await hashCrewLoginIp(request);

      const recentEmailFailures =
        await env.OBA_DB
          .prepare(`
            SELECT COUNT(*) AS failure_count

            FROM crew_login_attempts

            WHERE
              successful = 0
              AND email = ?
              AND attempted_at >=
                datetime(
                  'now',
                  '-' || ? || ' minutes'
                )
          `)
          .bind(
            email,
            CREW_LOGIN_WINDOW_MINUTES
          )
          .first();

      const emailFailureCount =
        Number(
          recentEmailFailures?.failure_count ?? 0
        );


      let ipFailureCount = 0;

      if (ipHash) {
        const recentIpFailures =
          await env.OBA_DB
            .prepare(`
              SELECT COUNT(*) AS failure_count

              FROM crew_login_attempts

              WHERE
                successful = 0
                AND ip_hash = ?
                AND attempted_at >=
                  datetime(
                    'now',
                    '-' || ? || ' minutes'
                  )
            `)
            .bind(
              ipHash,
              CREW_LOGIN_WINDOW_MINUTES
            )
            .first();

        ipFailureCount =
          Number(
            recentIpFailures?.failure_count ?? 0
          );
      }


      if (
        emailFailureCount >=
          CREW_LOGIN_MAX_EMAIL_FAILURES ||
        ipFailureCount >=
          CREW_LOGIN_MAX_IP_FAILURES
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Too many login attempts. Please try again later.'
          },
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-store',
              'Retry-After':
                String(
                  CREW_LOGIN_WINDOW_MINUTES * 60
                )
            }
          }
        );
      }

      const crewUser =
        await env.OBA_DB
          .prepare(`
            SELECT
              crew_user_id,
              email,
              password_hash,
              first_name,
              last_name,
              role,
              status

            FROM crew_users

            WHERE email = ?

            LIMIT 1
          `)
          .bind(email)
          .first();

      const passwordValid =
        crewUser &&
        crewUser.status === 'active'
          ? await verifyCrewPassword(
              password,
              crewUser.password_hash
            )
          : false;

      if (!passwordValid) {

        await env.OBA_DB
          .prepare(`
            INSERT INTO crew_login_attempts (
              email,
              ip_hash,
              successful
            )
            VALUES (?, ?, 0)
          `)
          .bind(
            email,
            ipHash
          )
          .run();

        return Response.json(
          {
            ok: false,
            error: 'Invalid email or password.'
          },
          {
            status: 401,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-store'
            }
          }
        );
      }

      /* =========================================
         RECORD SUCCESSFUL LOGIN
      ========================================== */

      await env.OBA_DB
        .prepare(`
          INSERT INTO crew_login_attempts (
            email,
            ip_hash,
            successful
          )
          VALUES (?, ?, 1)
        `)
        .bind(
          email,
          ipHash
        )
        .run();


      const sessionToken =
        createCrewSessionToken();

      const tokenHash =
        await hashCrewSessionToken(
          sessionToken
        );

      const sessionId =
        crypto.randomUUID();

      const expiresAt =
        getCrewSessionExpiry();


      /* =========================================
         ENFORCE ONE ACTIVE SESSION PER CREW USER
      ========================================== */

      await env.OBA_DB.batch([

        env.OBA_DB
          .prepare(`
            UPDATE crew_sessions

            SET
              revoked_at = CURRENT_TIMESTAMP

            WHERE crew_user_id = ?
              AND revoked_at IS NULL
          `)
          .bind(
            crewUser.crew_user_id
          ),


        env.OBA_DB
          .prepare(`
            INSERT INTO crew_sessions (
              session_id,
              crew_user_id,
              token_hash,
              expires_at
            )
            VALUES (?, ?, ?, ?)
          `)
          .bind(
            sessionId,
            crewUser.crew_user_id,
            tokenHash,
            expiresAt
          ),


        env.OBA_DB
          .prepare(`
            UPDATE crew_users

            SET
              last_login_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP

            WHERE crew_user_id = ?
          `)
          .bind(
            crewUser.crew_user_id
          )

      ]);

      return Response.json(
        {
          ok: true,
          authenticated: true,

          user: {
            crewUserId:
              Number(crewUser.crew_user_id),

            email:
              crewUser.email,

            firstName:
              crewUser.first_name,

            lastName:
              crewUser.last_name,

            role:
              crewUser.role
          },

          session: {
            expiresAt
          }
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-store',
            'Set-Cookie':
              createCrewSessionCookie(
                sessionToken
              )
          }
        }
      );
    }

    /* =========================================
       CREW SESSION STATUS
    ========================================== */

    if (url.pathname === '/crew/session') {

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }

      if (request.method !== 'GET') {
        return Response.json(
          {
            ok: false,
            error: 'Method Not Allowed'
          },
          {
            status: 405,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-store'
            }
          }
        );
      }

      const crewSession =
        await getCrewSession(
          request,
          env
        );

      if (!crewSession) {
        return Response.json(
          {
            ok: false,
            authenticated: false
          },
          {
            status: 401,
            headers: {
              ...corsHeaders,
              'Cache-Control': 'no-store'
            }
          }
        );
      }

      return Response.json(
        {
          ok: true,
          authenticated: true,

          user: {
            crewUserId:
              crewSession.crewUserId,

            email:
              crewSession.email,

            firstName:
              crewSession.firstName,

            lastName:
              crewSession.lastName,

            role:
              crewSession.role
          },

          session: {
            expiresAt:
              crewSession.expiresAt
          }
        },
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-store'
          }
        }
      );
    }
    
/* =========================================
   CREW LOGOUT
========================================= */

if (url.pathname === '/crew/logout') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  const token =
    getCrewSessionTokenFromRequest(
      request
    );

  if (token) {
    const tokenHash =
      await hashCrewSessionToken(token);

    await env.OBA_DB
      .prepare(`
        UPDATE crew_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE token_hash = ?
          AND revoked_at IS NULL
      `)
      .bind(tokenHash)
      .run();
  }

  return Response.json(
    {
      ok: true,
      authenticated: false
    },
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-store',
        'Set-Cookie':
          createExpiredCrewSessionCookie()
      }
    }
    );
}


/* =========================================
   CREW CHANGE PASSWORD
========================================= */

if (url.pathname === '/crew/change-password') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     REQUIRE ACTIVE CREW SESSION
  ========================================== */

  const crewSession =
    await getCrewSession(
      request,
      env
    );

  if (!crewSession) {
    return Response.json(
      {
        ok: false,
        authenticated: false,
        error: 'Crew authentication required.'
      },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     PARSE REQUEST
  ========================================== */

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error: 'Invalid request.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  const currentPassword =
    typeof body?.currentPassword === 'string'
      ? body.currentPassword
      : '';

  const newPassword =
    typeof body?.newPassword === 'string'
      ? body.newPassword
      : '';


  if (!currentPassword || !newPassword) {
    return Response.json(
      {
        ok: false,
        error:
          'Current password and new password are required.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  if (newPassword.length < 12) {
    return Response.json(
      {
        ok: false,
        error:
          'New password must be at least 12 characters.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     LOAD CURRENT PASSWORD HASH
  ========================================== */

  const crewUser =
    await env.OBA_DB
      .prepare(`
        SELECT
          crew_user_id,
          password_hash,
          status

        FROM crew_users

        WHERE crew_user_id = ?

        LIMIT 1
      `)
      .bind(
        crewSession.crewUserId
      )
      .first();


  if (
    !crewUser ||
    crewUser.status !== 'active'
  ) {
    return Response.json(
      {
        ok: false,
        authenticated: false,
        error: 'Crew authentication required.'
      },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     VERIFY CURRENT PASSWORD
  ========================================== */

  const currentPasswordValid =
    await verifyCrewPassword(
      currentPassword,
      crewUser.password_hash
    );

  if (!currentPasswordValid) {
    return Response.json(
      {
        ok: false,
        error: 'Current password is incorrect.'
      },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     PREVENT PASSWORD REUSE
  ========================================== */

  const samePassword =
    await verifyCrewPassword(
      newPassword,
      crewUser.password_hash
    );

  if (samePassword) {
    return Response.json(
      {
        ok: false,
        error:
          'New password must be different from the current password.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     HASH NEW PASSWORD
  ========================================== */

  let newPasswordHash;

  try {
    newPasswordHash =
      await hashCrewPassword(
        newPassword
      );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to update password.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     UPDATE PASSWORD + REVOKE ALL SESSIONS
  ========================================== */

  try {

    await env.OBA_DB.batch([

      env.OBA_DB
        .prepare(`
          UPDATE crew_users

          SET
            password_hash = ?,
            updated_at = CURRENT_TIMESTAMP

          WHERE crew_user_id = ?
            AND status = 'active'
        `)
        .bind(
          newPasswordHash,
          crewSession.crewUserId
        ),

      env.OBA_DB
        .prepare(`
          UPDATE crew_sessions

          SET
            revoked_at = CURRENT_TIMESTAMP

          WHERE crew_user_id = ?
            AND revoked_at IS NULL
        `)
        .bind(
          crewSession.crewUserId
        )

    ]);

  } catch (error) {

    console.error(
      'Crew password change failed:',
      error
    );

    return Response.json(
      {
        ok: false,
        error: 'Unable to update password.'
      },
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     PASSWORD CHANGED
  ========================================== */

  return Response.json(
    {
      ok: true,
      passwordChanged: true,
      authenticated: false
    },
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-store',

        'Set-Cookie':
          createExpiredCrewSessionCookie()
      }
    }
  );
}


/* =========================================
   CREW FORGOT PASSWORD
========================================= */

if (url.pathname === '/crew/forgot-password') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     PARSE REQUEST
  ========================================== */

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error: 'Invalid request.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  const email =
    typeof body?.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';


  if (!email) {
    return Response.json(
      {
        ok: false,
        error: 'Email is required.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /*
   * IMPORTANT:
   *
   * Once a syntactically valid request reaches this
   * point, the public response must remain generic.
   *
   * We do not reveal whether the email belongs to a
   * Crew account.
   */

  const genericResponse = () =>
    Response.json(
      {
        ok: true,
        message:
          'If that email belongs to an active Cookie Crew account, password reset instructions will be sent.'
      },
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );


  /* =========================================
     LOAD ACTIVE CREW USER
  ========================================== */

  const crewUser =
    await env.OBA_DB
      .prepare(`
        SELECT
          crew_user_id,
          email,
          status

        FROM crew_users

        WHERE email = ?

        LIMIT 1
      `)
      .bind(email)
      .first();


  if (
    !crewUser ||
    crewUser.status !== 'active'
  ) {
    return genericResponse();
  }


  /* =========================================
     CREATE RESET TOKEN
  ========================================== */

  const resetToken =
    createCrewPasswordResetToken();

  const tokenHash =
    await hashCrewPasswordResetToken(
      resetToken
    );

  const resetId =
    crypto.randomUUID();

  const expiresAt =
    getCrewPasswordResetExpiry();

  const requestedIpHash =
    await hashCrewLoginIp(request);


  /* =========================================
     STORE RESET REQUEST
  ========================================== */

  try {

    await env.OBA_DB.batch([

      /*
       * Revoke any previous unused reset links
       * for this Crew account.
       */
      env.OBA_DB
        .prepare(`
          UPDATE crew_password_resets

          SET
            revoked_at = CURRENT_TIMESTAMP

          WHERE crew_user_id = ?
            AND used_at IS NULL
            AND revoked_at IS NULL
        `)
        .bind(
          crewUser.crew_user_id
        ),


      env.OBA_DB
        .prepare(`
          INSERT INTO crew_password_resets (
            reset_id,
            crew_user_id,
            token_hash,
            expires_at,
            requested_ip_hash
          )

          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          resetId,
          crewUser.crew_user_id,
          tokenHash,
          expiresAt,
          requestedIpHash
        )

    ]);

  } catch (error) {

    console.error(
      'Crew password reset request failed:',
      error
    );

    /*
     * Do not expose account or database details
     * through the public recovery endpoint.
     */
    return genericResponse();
  }


  /* =========================================
     RESET LINK
  ========================================== */

  const resetUrl =
    'https://ollysbakedassortments.com/crew/reset-password.html' +
    '?token=' +
    encodeURIComponent(resetToken);


  /*
   * EMAIL DELIVERY WILL BE ADDED NEXT.
   *
   * The raw reset token exists only in memory here.
   * D1 contains only its SHA-256 hash.
   *
   * Do NOT return resetToken or resetUrl in the
   * public API response.
   */

  console.log(
    'Crew password reset token created.',
    {
      resetId,
      crewUserId:
        Number(crewUser.crew_user_id),
      expiresAt
    }
  );


  return genericResponse();
}


/* =========================================
   CREW RESET PASSWORD
========================================= */

if (url.pathname === '/crew/reset-password') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     PARSE REQUEST
  ========================================== */

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error: 'Invalid request.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  const resetToken =
    typeof body?.token === 'string'
      ? body.token.trim()
      : '';

  const newPassword =
    typeof body?.newPassword === 'string'
      ? body.newPassword
      : '';


  if (!resetToken || !newPassword) {
    return Response.json(
      {
        ok: false,
        error:
          'Reset token and new password are required.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  if (newPassword.length < 12) {
    return Response.json(
      {
        ok: false,
        error:
          'New password must be at least 12 characters.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     HASH + LOOK UP RESET TOKEN
  ========================================== */

  const tokenHash =
    await hashCrewPasswordResetToken(
      resetToken
    );

  const resetRecord =
    await env.OBA_DB
      .prepare(`
        SELECT
          r.reset_id,
          r.crew_user_id,
          r.expires_at,
          r.used_at,
          r.revoked_at,

          u.password_hash,
          u.status

        FROM crew_password_resets AS r

        INNER JOIN crew_users AS u
          ON u.crew_user_id =
             r.crew_user_id

        WHERE
          r.token_hash = ?
          AND r.used_at IS NULL
          AND r.revoked_at IS NULL
          AND datetime(r.expires_at) >
              datetime('now')
          AND u.status = 'active'

        LIMIT 1
      `)
      .bind(tokenHash)
      .first();


  if (!resetRecord) {
    return Response.json(
      {
        ok: false,
        error:
          'This password reset link is invalid or has expired.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     PREVENT PASSWORD REUSE
  ========================================== */

  const samePassword =
    await verifyCrewPassword(
      newPassword,
      resetRecord.password_hash
    );

  if (samePassword) {
    return Response.json(
      {
        ok: false,
        error:
          'New password must be different from the current password.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     HASH NEW PASSWORD
  ========================================== */

  let newPasswordHash;

  try {
    newPasswordHash =
      await hashCrewPassword(
        newPassword
      );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to reset password.'
      },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     CHANGE PASSWORD + CONSUME TOKEN
     + REVOKE ALL CREW SESSIONS
  ========================================== */

  try {

    await env.OBA_DB.batch([

      env.OBA_DB
        .prepare(`
          UPDATE crew_users

          SET
            password_hash = ?,
            updated_at = CURRENT_TIMESTAMP

          WHERE crew_user_id = ?
            AND status = 'active'
        `)
        .bind(
          newPasswordHash,
          resetRecord.crew_user_id
        ),


      env.OBA_DB
        .prepare(`
          UPDATE crew_password_resets

          SET
            used_at = CURRENT_TIMESTAMP

          WHERE reset_id = ?
            AND used_at IS NULL
            AND revoked_at IS NULL
            AND datetime(expires_at) >
                datetime('now')
        `)
        .bind(
          resetRecord.reset_id
        ),


      /*
       * Any other outstanding reset links for
       * this Crew account become invalid too.
       */
      env.OBA_DB
        .prepare(`
          UPDATE crew_password_resets

          SET
            revoked_at = CURRENT_TIMESTAMP

          WHERE crew_user_id = ?
            AND reset_id != ?
            AND used_at IS NULL
            AND revoked_at IS NULL
        `)
        .bind(
          resetRecord.crew_user_id,
          resetRecord.reset_id
        ),


      /*
       * A successful password recovery signs
       * the Crew member out everywhere.
       */
      env.OBA_DB
        .prepare(`
          UPDATE crew_sessions

          SET
            revoked_at = CURRENT_TIMESTAMP

          WHERE crew_user_id = ?
            AND revoked_at IS NULL
        `)
        .bind(
          resetRecord.crew_user_id
        )

    ]);

  } catch (error) {

    console.error(
      'Crew password reset failed:',
      error
    );

    return Response.json(
      {
        ok: false,
        error: 'Unable to reset password.'
      },
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     PASSWORD RESET COMPLETE
  ========================================== */

  return Response.json(
    {
      ok: true,
      passwordReset: true,
      authenticated: false,
      message:
        'Password reset successfully. Sign in with your new password.'
    },
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-store',
        'Set-Cookie':
          createExpiredCrewSessionCookie()
      }
    }
  );
}


    /* =========================================
       HEALTH CHECK
    ========================================== */
    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        service: 'oba-checkout',
        environment: 'sandbox',
        squareConfigured:
          Boolean(env.SQUARE_ACCESS_TOKEN)
      });
    }


    /* =========================================
       SQUARE CONNECTION TEST
    ========================================== */

    if (url.pathname === '/square-test') {
      try {
        const squareResponse = await fetch(
          'https://connect.squareupsandbox.com/v2/locations',
          {
            method: 'GET',

            headers: {
              'Square-Version': '2026-01-22',
              'Authorization':
                `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const squareData =
          await squareResponse.json();

        return Response.json({
          ok: squareResponse.ok,
          squareStatus: squareResponse.status,

          locations:
            squareData.locations?.map(location => ({
              id: location.id,
              name: location.name,
              status: location.status
            })) ?? [],

          errors:
            squareData.errors ?? []
        });

      } catch (error) {
        return Response.json(
          {
            ok: false,
            error:
              'Unable to connect to Square Sandbox.'
          },
          {
            status: 500
          }
        );
      }
    }


        /* =========================================
       SQUARE WEBHOOK
    ========================================== */

    if (url.pathname === '/square-webhook') {

      if (request.method !== 'POST') {
        return Response.json(
          {
            ok: false,
            error: 'Method Not Allowed'
          },
          {
            status: 405
          }
        );
      }

      const squareSignature =
        request.headers.get(
          'x-square-hmacsha256-signature'
        );

      if (
        !squareSignature ||
        !env.SQUARE_WEBHOOK_SIGNATURE_KEY
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Webhook signature is missing.'
          },
          {
            status: 403
          }
        );
      }

      const rawBody =
        await request.text();

      try {

        /* =========================================
           VERIFY SQUARE SIGNATURE
        ========================================== */

        const encoder =
          new TextEncoder();

        const signingKey =
          await crypto.subtle.importKey(
            'raw',
            encoder.encode(
              env.SQUARE_WEBHOOK_SIGNATURE_KEY
            ),
            {
              name: 'HMAC',
              hash: 'SHA-256'
            },
            false,
            ['sign']
          );

        const signatureBuffer =
          await crypto.subtle.sign(
            'HMAC',
            signingKey,
            encoder.encode(
              SQUARE_WEBHOOK_URL +
              rawBody
            )
          );

        const expectedSignature =
          btoa(
            String.fromCharCode(
              ...new Uint8Array(
                signatureBuffer
              )
            )
          );

        const expectedBytes =
          encoder.encode(
            expectedSignature
          );

        const receivedBytes =
          encoder.encode(
            squareSignature
          );

        let signaturesMatch =
          expectedBytes.length ===
          receivedBytes.length;

        let difference =
          expectedBytes.length ^
          receivedBytes.length;

        const comparisonLength =
          Math.max(
            expectedBytes.length,
            receivedBytes.length
          );

        for (
          let i = 0;
          i < comparisonLength;
          i++
        ) {
          difference |=
            (expectedBytes[i] ?? 0) ^
            (receivedBytes[i] ?? 0);
        }

        signaturesMatch =
          signaturesMatch &&
          difference === 0;

        if (!signaturesMatch) {
          console.warn(
            'Rejected invalid Square webhook signature.'
          );

          return Response.json(
            {
              ok: false,
              error:
                'Invalid webhook signature.'
            },
            {
              status: 403
            }
          );
        }


        /* =========================================
           PARSE EVENT
        ========================================== */

        let event;

        try {
          event =
            JSON.parse(rawBody);
        } catch (error) {
          return Response.json(
            {
              ok: false,
              error:
                'Webhook body is not valid JSON.'
            },
            {
              status: 400
            }
          );
        }

        const eventId =
          typeof event.event_id === 'string'
            ? event.event_id
            : '';

        const eventType =
          typeof event.type === 'string'
            ? event.type
            : '';

        const payment =
          event.data?.object?.payment;

        const squarePaymentId =
          typeof payment?.id === 'string'
            ? payment.id
            : null;

        const squareOrderId =
          typeof payment?.order_id === 'string'
            ? payment.order_id
            : null;

        const paymentStatus =
          typeof payment?.status === 'string'
            ? payment.status
            : null;

        console.log(
          'Verified Square webhook received.',
          {
            eventId,
            type: eventType,
            paymentId:
              squarePaymentId,
            orderId:
              squareOrderId,
            paymentStatus
          }
        );


        /* =========================================
           IGNORE NON-PAYMENT EVENTS
        ========================================== */

        if (eventType !== 'payment.updated') {
          return Response.json(
            {
              ok: true,
              ignored: true
            },
            {
              status: 200
            }
          );
        }

        if (!eventId) {
          console.error(
            'Verified Square webhook is missing event_id.'
          );

          return Response.json(
            {
              ok: false,
              error:
                'Webhook event ID is missing.'
            },
            {
              status: 400
            }
          );
        }


        /* =========================================
           WEBHOOK EVENT IDEMPOTENCY
        ========================================== */

        const webhookInsert =
          await env.OBA_DB
            .prepare(`
              INSERT OR IGNORE INTO square_webhook_events (
                event_id,
                event_type,
                square_payment_id,
                square_order_id,
                payment_status,
                processing_status
              )
              VALUES (?, ?, ?, ?, ?, ?)
            `)
            .bind(
              eventId,
              eventType,
              squarePaymentId,
              squareOrderId,
              paymentStatus,
              'received'
            )
            .run();

        if (
          webhookInsert.meta?.changes === 0
        ) {
          const existingWebhookEvent =
            await env.OBA_DB
              .prepare(`
                SELECT processing_status
                FROM square_webhook_events
                WHERE event_id = ?
                LIMIT 1
              `)
              .bind(eventId)
              .first();

          if (
            existingWebhookEvent
              ?.processing_status ===
              'processed'
          ) {
            return Response.json(
              {
                ok: true,
                duplicate: true
              },
              {
                status: 200
              }
            );
          }
        }


        /* =========================================
           REQUIRE PAYMENT IDENTIFIERS
        ========================================== */

        if (
          !squarePaymentId ||
          !squareOrderId ||
          !paymentStatus
        ) {
          await env.OBA_DB
            .prepare(`
              UPDATE square_webhook_events
              SET
                processing_status = ?,
                processed_at = CURRENT_TIMESTAMP
              WHERE event_id = ?
            `)
            .bind(
              'ignored_incomplete',
              eventId
            )
            .run();

          return Response.json(
            {
              ok: true,
              ignored: true
            },
            {
              status: 200
            }
          );
        }


        /* =========================================
           UPDATE GENERAL CHECKOUT PAYMENT STATE
        ========================================== */

        const checkoutAttempt =
          await env.OBA_DB
            .prepare(`
              SELECT
                checkout_attempt_id,
                fulfillment_type,
                square_order_id,
                square_payment_id,
                payment_status,
                checkout_status

              FROM checkout_attempts

              WHERE
                square_order_id = ?

              LIMIT 1
            `)
            .bind(squareOrderId)
            .first();

        if (checkoutAttempt) {

          await env.OBA_DB
            .prepare(`
              UPDATE checkout_attempts

              SET
                square_payment_id =
                  COALESCE(
                    square_payment_id,
                    ?
                  ),

                payment_status = ?,

                checkout_status =
                  CASE
                    WHEN ? = 'COMPLETED'
                    THEN 'completed'
                    ELSE 'payment_updated'
                  END,

                updated_at =
                  CURRENT_TIMESTAMP

              WHERE
                checkout_attempt_id = ?
                AND square_order_id = ?
                AND (
                  square_payment_id IS NULL
                  OR square_payment_id = ?
                )
            `)
            .bind(
              squarePaymentId,
              paymentStatus,
              paymentStatus,
              checkoutAttempt.checkout_attempt_id,
              squareOrderId,
              squarePaymentId
            )
            .run();
        }


        /* =========================================
           GENERAL INVENTORY RECONCILIATION
        ========================================== */

        /*
         * Inventory reconciliation is intentionally
         * independent of delivery recovery.
         *
         * Pickup and delivery orders both use the
         * same cart reservation inventory system.
         *
         * Therefore a COMPLETED Square payment must
         * attempt to convert its linked reservation
         * before any delivery-specific processing.
         */
        if (paymentStatus === 'COMPLETED') {

          const paidReservation =
            await env.OBA_DB
              .prepare(`
                SELECT
                  reservation_id,
                  cart_id,
                  drop_id,
                  status,
                  checkout_attempt_id,
                  square_order_id

                FROM cart_reservations

                WHERE
                  square_order_id = ?

                LIMIT 1
              `)
              .bind(squareOrderId)
              .first();


          /*
           * No reservation means this payment does
           * not belong to the inventory reservation
           * system currently being reconciled.
           *
           * Do NOT fail here solely because there
           * is no reservation. Delivery recovery
           * may still have legitimate work to do.
           */
          if (paidReservation) {

            if (
              paidReservation.status !==
              'converted'
            ) {

              if (
                paidReservation.status !==
                'active'
              ) {
                console.error(
                  'CRITICAL: Completed Square payment is linked to a reservation in an unexpected state.',
                  {
                    eventId,
                    squareOrderId,
                    squarePaymentId,
                    reservationId:
                      paidReservation.reservation_id,
                    reservationStatus:
                      paidReservation.status
                  }
                );

                await env.OBA_DB
                  .prepare(`
                    UPDATE square_webhook_events
                    SET
                      processing_status = ?,
                      processed_at = CURRENT_TIMESTAMP
                    WHERE event_id = ?
                  `)
                  .bind(
                    'inventory_reconciliation_failed',
                    eventId
                  )
                  .run();

                return Response.json(
                  {
                    ok: false,
                    error:
                      'Completed payment inventory reconciliation failed.'
                  },
                  {
                    status: 500
                  }
                );
              }


              const paidItemsResult =
                await env.OBA_DB
                  .prepare(`
                    SELECT
                      ri.inventory_item_id,
                      ri.quantity

                    FROM cart_reservation_items AS ri

                    WHERE
                      ri.reservation_id = ?

                    ORDER BY
                      ri.inventory_item_id
                  `)
                  .bind(
                    paidReservation.reservation_id
                  )
                  .all();

              const paidItems =
                paidItemsResult.results ?? [];

              if (paidItems.length === 0) {
                console.error(
                  'CRITICAL: Completed Square payment reservation contains no inventory items.',
                  {
                    eventId,
                    squareOrderId,
                    squarePaymentId,
                    reservationId:
                      paidReservation.reservation_id
                  }
                );

                await env.OBA_DB
                  .prepare(`
                    UPDATE square_webhook_events
                    SET
                      processing_status = ?,
                      processed_at = CURRENT_TIMESTAMP
                    WHERE event_id = ?
                  `)
                  .bind(
                    'inventory_reconciliation_failed',
                    eventId
                  )
                  .run();

                return Response.json(
                  {
                    ok: false,
                    error:
                      'Completed payment inventory reconciliation failed.'
                  },
                  {
                    status: 500
                  }
                );
              }


              const conversionStatements = [];

              for (
                const paidItem of paidItems
              ) {

                const quantity =
                  Number(
                    paidItem.quantity
                  );

                const inventoryItemId =
                  Number(
                    paidItem
                      .inventory_item_id
                  );

                if (
                  !Number.isInteger(quantity) ||
                  quantity < 1 ||
                  !Number.isInteger(
                    inventoryItemId
                  )
                ) {
                  throw new Error(
                    'Webhook reservation contains invalid inventory data.'
                  );
                }

                conversionStatements.push(
                  env.OBA_DB
                    .prepare(`
                      UPDATE inventory_items

                      SET
                        quantity_sold =
                          quantity_sold + ?,

                        updated_at =
                          CURRENT_TIMESTAMP

                      WHERE
                        inventory_item_id = ?
                        AND drop_id = ?
                    `)
                    .bind(
                      quantity,
                      inventoryItemId,
                      paidReservation.drop_id
                    )
                );
              }


              /*
               * This final status transition is
               * protected by the database trigger:
               *
               * prevent_invalid_reservation_conversion
               *
               * quantity_sold is independently
               * protected by:
               *
               * prevent_inventory_overselling
               */
              conversionStatements.push(
                env.OBA_DB
                  .prepare(`
                    UPDATE cart_reservations

                    SET
                      status = 'converted',
                      updated_at =
                        CURRENT_TIMESTAMP

                    WHERE
                      reservation_id = ?
                      AND square_order_id = ?
                      AND status = 'active'
                  `)
                  .bind(
                    paidReservation.reservation_id,
                    squareOrderId
                  )
              );


              try {
                await env.OBA_DB.batch(
                  conversionStatements
                );
              } catch (conversionError) {

                console.error(
                  'CRITICAL: Square webhook could not convert paid reservation to sold inventory.',
                  {
                    eventId,
                    squareOrderId,
                    squarePaymentId,
                    reservationId:
                      paidReservation.reservation_id,

                    error:
                      conversionError instanceof Error
                        ? conversionError.message
                        : String(
                            conversionError
                          )
                  }
                );

                await env.OBA_DB
                  .prepare(`
                    UPDATE square_webhook_events
                    SET
                      processing_status = ?,
                      processed_at = CURRENT_TIMESTAMP
                    WHERE event_id = ?
                  `)
                  .bind(
                    'inventory_reconciliation_failed',
                    eventId
                  )
                  .run();

                return Response.json(
                  {
                    ok: false,
                    error:
                      'Completed payment inventory reconciliation failed.'
                  },
                  {
                    status: 500
                  }
                );
              }
            }


            /* =========================================
               VERIFY INVENTORY CONVERSION
            ========================================== */

            const convertedReservation =
              await env.OBA_DB
                .prepare(`
                  SELECT
                    reservation_id,
                    status,
                    checkout_attempt_id,
                    square_order_id

                  FROM cart_reservations

                  WHERE
                    reservation_id = ?
                    AND square_order_id = ?

                  LIMIT 1
                `)
                .bind(
                  paidReservation.reservation_id,
                  squareOrderId
                )
                .first();

            if (
              !convertedReservation ||
              convertedReservation.status !==
                'converted'
            ) {
              console.error(
                'CRITICAL: Square webhook inventory conversion could not be verified.',
                {
                  eventId,
                  squareOrderId,
                  squarePaymentId,
                  reservationId:
                    paidReservation.reservation_id
                }
              );

              await env.OBA_DB
                .prepare(`
                  UPDATE square_webhook_events
                  SET
                    processing_status = ?,
                    processed_at = CURRENT_TIMESTAMP
                  WHERE event_id = ?
                `)
                .bind(
                  'inventory_reconciliation_failed',
                  eventId
                )
                .run();

              return Response.json(
                {
                  ok: false,
                  error:
                    'Completed payment inventory reconciliation could not be verified.'
                },
                {
                  status: 500
                }
              );
            }
          }
        }


        /* =========================================
           DELIVERY-SPECIFIC RECONCILIATION
        ========================================== */

        /*
         * Inventory processing above applies to
         * BOTH pickup and delivery.
         *
         * Everything below this point is the
         * existing delivery recovery workflow.
         */
        const recoveryRecord =
          await env.OBA_DB
            .prepare(`
              SELECT *
              FROM delivery_checkout_recovery
              WHERE
                square_order_id = ?
                OR square_payment_id = ?
              LIMIT 1
            `)
            .bind(
              squareOrderId,
              squarePaymentId
            )
            .first();


        /*
         * A pickup order normally has no delivery
         * recovery record.
         *
         * That is no longer an error and must not
         * prevent inventory reconciliation.
         */
        if (!recoveryRecord) {

          await env.OBA_DB
            .prepare(`
              UPDATE square_webhook_events
              SET
                processing_status = ?,
                processed_at =
                  CURRENT_TIMESTAMP
              WHERE event_id = ?
            `)
            .bind(
              'processed',
              eventId
            )
            .run();

          return Response.json(
            {
              ok: true,
              inventoryReconciled:
                paymentStatus ===
                'COMPLETED'
            },
            {
              status: 200
            }
          );
        }


        await env.OBA_DB
          .prepare(`
            UPDATE delivery_checkout_recovery
            SET
              square_payment_id = ?,
              payment_status = ?,
              recovery_status = ?,
              updated_at =
                CURRENT_TIMESTAMP
            WHERE checkout_id = ?
          `)
          .bind(
            squarePaymentId,
            paymentStatus,
            paymentStatus === 'COMPLETED'
              ? 'payment_completed'
              : 'payment_updated',
            recoveryRecord.checkout_id
          )
          .run();


        if (paymentStatus === 'COMPLETED') {

          await env.OBA_DB
            .prepare(`
              INSERT OR IGNORE INTO delivery_orders (
                square_order_id,
                square_payment_id,
                recipient_first_name,
                recipient_last_name,
                email,
                phone,
                address,
                city,
                zip,
                delivery_date,
                delivery_window,
                delivery_notes,
                order_notes,
                delivery_fee_cents,
                distance_meters,
                distance_miles,
                route_duration,
                status
              )
              VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?
              )
            `)
            .bind(
              squareOrderId,
              squarePaymentId,
              recoveryRecord
                .recipient_first_name,
              recoveryRecord
                .recipient_last_name,
              recoveryRecord.email,
              recoveryRecord.phone,
              recoveryRecord.address,
              recoveryRecord.city,
              recoveryRecord.zip,
              recoveryRecord.delivery_date,
              recoveryRecord.delivery_window,
              recoveryRecord.delivery_notes,
              recoveryRecord.order_notes,
              recoveryRecord.delivery_fee_cents,
              recoveryRecord.distance_meters,
              recoveryRecord.distance_miles,
              recoveryRecord.route_duration,
              'pending'
            )
            .run();


          const operationalDeliveryOrder =
            await env.OBA_DB
              .prepare(`
                SELECT
                  square_order_id,
                  square_payment_id,
                  status

                FROM delivery_orders

                WHERE
                  square_order_id = ?

                LIMIT 1
              `)
              .bind(squareOrderId)
              .first();


          if (!operationalDeliveryOrder) {

            console.error(
              'CRITICAL: Completed Square payment could not be reconciled to an operational delivery order.',
              {
                eventId,
                checkoutId:
                  recoveryRecord.checkout_id,
                squareOrderId,
                squarePaymentId
              }
            );

            await env.OBA_DB
              .prepare(`
                UPDATE delivery_checkout_recovery
                SET
                  recovery_status = ?,
                  updated_at =
                    CURRENT_TIMESTAMP
                WHERE checkout_id = ?
              `)
              .bind(
                'reconciliation_failed',
                recoveryRecord.checkout_id
              )
              .run();

            await env.OBA_DB
              .prepare(`
                UPDATE square_webhook_events
                SET
                  processing_status = ?,
                  processed_at =
                    CURRENT_TIMESTAMP
                WHERE event_id = ?
              `)
              .bind(
                'reconciliation_failed',
                eventId
              )
              .run();

            return Response.json(
              {
                ok: false,
                error:
                  'Completed payment could not be reconciled to the delivery order.'
              },
              {
                status: 500
              }
            );
          }


          await env.OBA_DB
            .prepare(`
              UPDATE delivery_checkout_recovery
              SET
                recovery_status = ?,
                updated_at =
                  CURRENT_TIMESTAMP
              WHERE checkout_id = ?
            `)
            .bind(
              'reconciled',
              recoveryRecord.checkout_id
            )
            .run();
        }


        /* =========================================
           WEBHOOK COMPLETE
        ========================================== */

        await env.OBA_DB
          .prepare(`
            UPDATE square_webhook_events
            SET
              processing_status = ?,
              processed_at =
                CURRENT_TIMESTAMP
            WHERE event_id = ?
          `)
          .bind(
            'processed',
            eventId
          )
          .run();

        return Response.json(
          {
            ok: true
          },
          {
            status: 200
          }
        );


      } catch (error) {

        console.error(
          'Square webhook processing error:',
          error
        );

        return Response.json(
          {
            ok: false,
            error:
              'Unable to process webhook.'
          },
          {
            status: 500
          }
        );
      }
    }


    /* =========================================
       GOOGLE ROUTES CONNECTION TEST
    ========================================== */

    if (url.pathname === '/routes-test') {
      try {
        const routesResponse = await fetch(
          'https://routes.googleapis.com/directions/v2:computeRoutes',
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key':
                env.GOOGLE_MAPS_API_KEY,
              'X-Goog-FieldMask':
                'routes.distanceMeters,routes.duration'
            },

            body: JSON.stringify({
              origin: {
                address:
                  'La Mesa, CA 91942'
              },

              destination: {
                address:
                  'Grossmont Center, La Mesa, CA 91942'
              },

              travelMode: 'DRIVE',
              routingPreference:
                'TRAFFIC_UNAWARE'
            })
          }
        );

        const routesData =
          await routesResponse.json();

        return Response.json({
          ok: routesResponse.ok,
          googleStatus:
            routesResponse.status,

          distanceMeters:
            routesData.routes?.[0]
              ?.distanceMeters ?? null,

          duration:
            routesData.routes?.[0]
              ?.duration ?? null,

          error:
            routesData.error ?? null
        });

      } catch (error) {
        console.error(
          'Google Routes test error:',
          error
        );

        return Response.json(
          {
            ok: false,
            error:
              'Unable to connect to Google Routes API.'
          },
          {
            status: 500
          }
        );
      }
    }

/* =========================================
   CREW INVENTORY OVERVIEW
========================================= */

if (url.pathname === '/crew/inventory') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'GET') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     REQUIRE ACTIVE CREW SESSION
  ========================================== */

  const crewSession =
    await getCrewSession(
      request,
      env
    );

  if (!crewSession) {
    return Response.json(
      {
        ok: false,
        authenticated: false,
        error: 'Crew authentication required.'
      },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  try {

    /* =========================================
       EXPIRE STALE RESERVATIONS
    ========================================== */

    await env.OBA_DB
      .prepare(`
        UPDATE cart_reservations

        SET
          status = 'expired',
          updated_at = CURRENT_TIMESTAMP

        WHERE
          status = 'active'
          AND julianday(expires_at) <=
              julianday('now')
      `)
      .run();


    /* =========================================
       ACTIVE DROP
    ========================================== */

    const activeDrop =
      await env.OBA_DB
        .prepare(`
          SELECT
            drop_id,
            name,
            sales_start_at,
            sales_end_at,
            fulfillment_start_date,
            fulfillment_end_date,
            status

          FROM inventory_drops

          WHERE status = 'active'

          ORDER BY created_at DESC

          LIMIT 1
        `)
        .first();


    if (!activeDrop) {
      return Response.json(
        {
          ok: true,
          drop: null,
          locations: [],
          items: [],
          summary: {
            totalPhysical: 0,
            totalSold: 0,
            totalReserved: 0,
            totalOnlineAvailable: 0
          }
        },
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       ACTIVE INVENTORY LOCATIONS
    ========================================== */

    const locationsResult =
      await env.OBA_DB
        .prepare(`
          SELECT
            location_id,
            name,
            location_type,
            event_id,
            status

          FROM inventory_locations

          WHERE status = 'active'

          ORDER BY
            CASE location_type
              WHEN 'kitchen' THEN 1
              WHEN 'online' THEN 2
              WHEN 'bertha' THEN 3
              WHEN 'event' THEN 4
              ELSE 5
            END,
            name
        `)
        .all();

    const locations =
      (locationsResult.results ?? [])
        .map(location => ({
          locationId:
            location.location_id,

          name:
            location.name,

          locationType:
            location.location_type,

          eventId:
            location.event_id ?? null,

          status:
            location.status
        }));


    /* =========================================
       DROP INVENTORY + ALLOCATIONS
    ========================================== */

    const inventoryResult =
      await env.OBA_DB
        .prepare(`
          SELECT
            i.inventory_item_id,
            i.product_id,
            i.product_name,
            i.quantity_total,
            i.quantity_sold,
            i.status AS inventory_status,

            a.location_id,
            a.quantity_allocated,
            a.status AS allocation_status

          FROM inventory_items AS i

          LEFT JOIN inventory_allocations AS a
            ON a.inventory_item_id =
               i.inventory_item_id

          WHERE
            i.drop_id = ?

          ORDER BY
            i.inventory_item_id,
            a.location_id
        `)
        .bind(activeDrop.drop_id)
        .all();


    /* =========================================
       ACTIVE RESERVATIONS
    ========================================== */

    const reservationsResult =
      await env.OBA_DB
        .prepare(`
          SELECT
            ri.inventory_item_id,

            COALESCE(
              SUM(ri.quantity),
              0
            ) AS quantity_reserved,

            COUNT(
              DISTINCT r.reservation_id
            ) AS active_cart_count

          FROM cart_reservation_items AS ri

          INNER JOIN cart_reservations AS r
            ON r.reservation_id =
               ri.reservation_id

          WHERE
            r.drop_id = ?
            AND r.status = 'active'
            AND julianday(r.expires_at) >
                julianday('now')

          GROUP BY
            ri.inventory_item_id
        `)
        .bind(activeDrop.drop_id)
        .all();


    const reservationByItem =
      new Map(
        (reservationsResult.results ?? [])
          .map(row => [
            Number(row.inventory_item_id),
            {
              reserved:
                Number(
                  row.quantity_reserved
                ),

              activeCartCount:
                Number(
                  row.active_cart_count
                )
            }
          ])
      );


    /* =========================================
       BUILD INVENTORY ITEMS
    ========================================== */

    const itemMap = new Map();


    for (
      const row
      of (inventoryResult.results ?? [])
    ) {

      const inventoryItemId =
        Number(row.inventory_item_id);


      if (!itemMap.has(inventoryItemId)) {

        const reservation =
          reservationByItem.get(
            inventoryItemId
          ) ?? {
            reserved: 0,
            activeCartCount: 0
          };


        itemMap.set(
          inventoryItemId,
          {
            inventoryItemId,

            productId:
              row.product_id,

            productName:
              row.product_name,

            total:
              Number(
                row.quantity_total
              ),

            sold:
              Number(
                row.quantity_sold
              ),

            reserved:
              reservation.reserved,

            activeCartCount:
              reservation.activeCartCount,

            status:
              row.inventory_status,

            locations: {},

            physicalUnsold: 0,

            onlineAllocated: 0,

            onlineAvailable: 0,

            unaccounted: 0
          }
        );
      }


      const item =
        itemMap.get(
          inventoryItemId
        );


      if (row.location_id) {

        const allocated =
          Number(
            row.quantity_allocated
          );


        item.locations[
          row.location_id
        ] = {
          quantity:
            allocated,

          status:
            row.allocation_status
        };


        if (
          row.allocation_status ===
          'active'
        ) {
          item.physicalUnsold +=
            allocated;
        }


        if (
          row.location_id === 'online' &&
          row.allocation_status ===
            'active'
        ) {
          item.onlineAllocated =
            allocated;
        }
      }
    }


    /* =========================================
       FINALIZE AVAILABILITY
    ========================================== */

    const items =
      Array.from(
        itemMap.values()
      )
        .map(item => {

          /*
           * Reservations belong to the
           * Online Orders inventory pool.
           *
           * Staff sees exact numbers.
           */
          item.onlineAvailable =
            Math.max(
              0,
              item.onlineAllocated -
              item.reserved
            );


          /*
           * This should normally equal zero.
           *
           * It acts as a reconciliation signal:
           *
           * master unsold inventory
           * minus location allocations.
           */
          item.unaccounted =
            Math.max(
              0,
              (
                item.total -
                item.sold
              ) -
              item.physicalUnsold
            );


          return item;
        });


    /* =========================================
       CREW INVENTORY SUMMARY
    ========================================== */

    const summary =
      items.reduce(
        (totals, item) => {

          totals.totalPhysical +=
            item.physicalUnsold;

          totals.totalSold +=
            item.sold;

          totals.totalReserved +=
            item.reserved;

          totals.totalOnlineAvailable +=
            item.onlineAvailable;

          return totals;
        },
        {
          totalPhysical: 0,
          totalSold: 0,
          totalReserved: 0,
          totalOnlineAvailable: 0
        }
      );


    /* =========================================
       RESPONSE
    ========================================== */

    return Response.json(
      {
        ok: true,

        drop: {
          dropId:
            activeDrop.drop_id,

          name:
            activeDrop.name,

          salesStartAt:
            activeDrop.sales_start_at,

          salesEndAt:
            activeDrop.sales_end_at,

          fulfillmentStartDate:
            activeDrop
              .fulfillment_start_date,

          fulfillmentEndDate:
            activeDrop
              .fulfillment_end_date,

          status:
            activeDrop.status
        },

        locations,

        items,

        summary
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );


  } catch (error) {

    console.error(
      'Crew inventory overview error:',
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          'Unable to load crew inventory.'
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

/* =========================================
   ADD BAKED INVENTORY
========================================== */

if (url.pathname === '/inventory/baked') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     REQUIRE ACTIVE CREW SESSION
  ========================================== */

  const crewSession =
    await getCrewSession(
      request,
      env
    );

  if (!crewSession) {
    return Response.json(
      {
        ok: false,
        authenticated: false,
        error: 'Crew authentication required.'
      },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  let body;

  try {
    body = await request.json();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          'Request body must be valid JSON.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  /* =========================================
     BAKED INVENTORY VALIDATION
  ========================================== */

  const inventoryItemId =
    Number(body.inventoryItemId);

  const locationId =
    typeof body.locationId === 'string'
      ? body.locationId.trim()
      : '';

  const quantity =
    Number(body.quantity);

  const reason =
    typeof body.reason === 'string'
      ? body.reason.trim().slice(0, 500)
      : null;


  if (
    !Number.isInteger(inventoryItemId) ||
    inventoryItemId < 1
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Invalid inventory item ID.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  if (!locationId) {
    return Response.json(
      {
        ok: false,
        error:
          'An inventory location is required.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Baked quantity must be a positive whole number.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  try {

    /* =========================================
       LOAD INVENTORY ITEM
    ========================================== */

    const inventoryItem =
      await env.OBA_DB
        .prepare(`
          SELECT
            inventory_item_id,
            drop_id,
            product_id,
            product_name,
            quantity_total,
            quantity_sold,
            status

          FROM inventory_items

          WHERE
            inventory_item_id = ?

          LIMIT 1
        `)
        .bind(inventoryItemId)
        .first();


    if (!inventoryItem) {
      return Response.json(
        {
          ok: false,
          error:
            'Inventory item was not found.'
        },
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }


    if (inventoryItem.status !== 'active') {
      return Response.json(
        {
          ok: false,
          error:
            'Baked inventory can only be added to an active inventory item.'
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       LOAD DESTINATION LOCATION
    ========================================== */

    const location =
      await env.OBA_DB
        .prepare(`
          SELECT
            location_id,
            name,
            location_type,
            status

          FROM inventory_locations

          WHERE
            location_id = ?

          LIMIT 1
        `)
        .bind(locationId)
        .first();


    if (!location) {
      return Response.json(
        {
          ok: false,
          error:
            'Inventory location was not found.'
        },
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }


    if (location.status !== 'active') {
      return Response.json(
        {
          ok: false,
          error:
            'Baked inventory can only be added to an active location.'
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       ATOMIC BAKED INVENTORY ADDITION
    ========================================== */

    const bakedStatements = [];


    /*
     * 1. Increase the master physical inventory.
     *
     * quantity_total represents:
     *
     * current physical inventory
     * + inventory already sold.
     *
     * Newly baked cookies therefore increase
     * quantity_total.
     */
    bakedStatements.push(
      env.OBA_DB
        .prepare(`
          UPDATE inventory_items

          SET
            quantity_total =
              quantity_total + ?,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            inventory_item_id = ?
            AND status = 'active'
        `)
        .bind(
          quantity,
          inventoryItemId
        )
    );


    /*
     * 2. Add the newly baked physical cookies
     *    to the selected location.
     *
     * If this cookie has never had inventory
     * at the location, create the allocation.
     */
    bakedStatements.push(
      env.OBA_DB
        .prepare(`
          INSERT INTO inventory_allocations (
            inventory_item_id,
            location_id,
            quantity_allocated,
            status
          )

          VALUES (?, ?, ?, 'active')

          ON CONFLICT (
            inventory_item_id,
            location_id
          )

          DO UPDATE SET
            quantity_allocated =
              quantity_allocated +
              excluded.quantity_allocated,

            status = 'active',

            updated_at =
              CURRENT_TIMESTAMP
        `)
        .bind(
          inventoryItemId,
          locationId,
          quantity
        )
    );


    /*
     * 3. Record the production event in the
     *    permanent inventory movement ledger.
     *
     * Newly baked inventory enters the system:
     *
     * Outside -> Location
     */
    bakedStatements.push(
      env.OBA_DB
        .prepare(`
          INSERT INTO inventory_movements (
            inventory_item_id,
            movement_type,
            from_location_id,
            to_location_id,
            quantity,
            reason,
            reference_type,
            reference_id,
            created_by
          )

          VALUES (
            ?,
            'baked',
            NULL,
            ?,
            ?,
            ?,
            'crew_inventory_baked',
            NULL,
            NULL
          )
        `)
        .bind(
          inventoryItemId,
          locationId,
          quantity,
          reason || null
        )
    );


    try {
      await env.OBA_DB.batch(
        bakedStatements
      );
    } catch (bakedError) {

      console.warn(
        'Baked inventory could not be added.',
        {
          inventoryItemId,
          locationId,
          quantity,

          error:
            bakedError instanceof Error
              ? bakedError.message
              : String(bakedError)
        }
      );

      return Response.json(
        {
          ok: false,
          error:
            'Baked inventory could not be added.'
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       VERIFY BAKED INVENTORY
    ========================================== */

    const updatedInventory =
      await env.OBA_DB
        .prepare(`
          SELECT
            i.inventory_item_id,
            i.product_id,
            i.product_name,
            i.quantity_total,
            i.quantity_sold,

            a.location_id,
            a.quantity_allocated

          FROM inventory_items AS i

          INNER JOIN inventory_allocations AS a
            ON a.inventory_item_id =
               i.inventory_item_id

          WHERE
            i.inventory_item_id = ?
            AND a.location_id = ?

          LIMIT 1
        `)
        .bind(
          inventoryItemId,
          locationId
        )
        .first();


    if (!updatedInventory) {
      console.error(
        'CRITICAL: Baked inventory addition completed but verification failed.',
        {
          inventoryItemId,
          locationId,
          quantity
        }
      );

      return Response.json(
        {
          ok: false,
          error:
            'Baked inventory was added but could not be verified.'
        },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }


    return Response.json(
      {
        ok: true,

        baked: {
          inventoryItemId,

          productId:
            updatedInventory.product_id,

          productName:
            updatedInventory.product_name,

          quantity,

          location: {
            locationId:
              location.location_id,

            name:
              location.name
          },

          reason:
            reason || null
        },

        inventory: {
          total:
            Number(
              updatedInventory.quantity_total
            ),

          sold:
            Number(
              updatedInventory.quantity_sold
            ),

          locationQuantity:
            Number(
              updatedInventory.quantity_allocated
            )
        }
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );


  } catch (error) {

    console.error(
      'Add baked inventory error:',
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          'Unable to add baked inventory.'
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

/* =========================================
   INVENTORY ADJUSTMENT
========================================== */

if (url.pathname === '/inventory/adjust') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     REQUIRE ACTIVE CREW SESSION
  ========================================== */

  const crewSession =
    await getCrewSession(
      request,
      env
    );

  if (!crewSession) {
    return Response.json(
      {
        ok: false,
        authenticated: false,
        error: 'Crew authentication required.'
      },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  let body;

  try {
    body = await request.json();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          'Request body must be valid JSON.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  /* =========================================
     ADJUSTMENT VALIDATION
  ========================================== */

  const inventoryItemId =
    Number(body.inventoryItemId);

  const locationId =
    typeof body.locationId === 'string'
      ? body.locationId.trim()
      : '';

  const adjustmentType =
    typeof body.adjustmentType === 'string'
      ? body.adjustmentType.trim()
      : '';

  const quantity =
    Number(body.quantity);

  const reason =
    typeof body.reason === 'string'
      ? body.reason.trim().slice(0, 500)
      : '';


  if (
    !Number.isInteger(inventoryItemId) ||
    inventoryItemId < 1
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Invalid inventory item ID.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  if (!locationId) {
    return Response.json(
      {
        ok: false,
        error:
          'An inventory location is required.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  if (
    adjustmentType !== 'waste' &&
    adjustmentType !== 'correction_add' &&
    adjustmentType !== 'correction_remove'
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Adjustment type must be waste, correction_add, or correction_remove.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Adjustment quantity must be a positive whole number.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  if (!reason) {
    return Response.json(
      {
        ok: false,
        error:
          'A reason is required for inventory adjustments.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  try {

    /* =========================================
       LOAD INVENTORY ITEM
    ========================================== */

    const inventoryItem =
      await env.OBA_DB
        .prepare(`
          SELECT
            inventory_item_id,
            drop_id,
            product_id,
            product_name,
            quantity_total,
            quantity_sold,
            status

          FROM inventory_items

          WHERE
            inventory_item_id = ?

          LIMIT 1
        `)
        .bind(inventoryItemId)
        .first();


    if (!inventoryItem) {
      return Response.json(
        {
          ok: false,
          error:
            'Inventory item was not found.'
        },
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }


    if (inventoryItem.status !== 'active') {
      return Response.json(
        {
          ok: false,
          error:
            'Inventory adjustments can only be made to an active inventory item.'
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       LOAD INVENTORY LOCATION
    ========================================== */

    const location =
      await env.OBA_DB
        .prepare(`
          SELECT
            location_id,
            name,
            location_type,
            status

          FROM inventory_locations

          WHERE
            location_id = ?

          LIMIT 1
        `)
        .bind(locationId)
        .first();


    if (!location) {
      return Response.json(
        {
          ok: false,
          error:
            'Inventory location was not found.'
        },
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }


    if (location.status !== 'active') {
      return Response.json(
        {
          ok: false,
          error:
            'Inventory can only be adjusted at an active location.'
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       LOAD CURRENT LOCATION INVENTORY
    ========================================== */

    const allocation =
      await env.OBA_DB
        .prepare(`
          SELECT
            allocation_id,
            quantity_allocated,
            status

          FROM inventory_allocations

          WHERE
            inventory_item_id = ?
            AND location_id = ?

          LIMIT 1
        `)
        .bind(
          inventoryItemId,
          locationId
        )
        .first();


    const currentLocationQuantity =
      allocation &&
      allocation.status === 'active'
        ? Number(allocation.quantity_allocated)
        : 0;


    /*
     * Waste and correction_remove both remove
     * physical cookies from a location.
     *
     * They cannot remove more cookies than are
     * physically recorded there.
     */
    if (
      (
        adjustmentType === 'waste' ||
        adjustmentType === 'correction_remove'
      ) &&
      currentLocationQuantity < quantity
    ) {
      return Response.json(
        {
          ok: false,
          error:
            'The selected location does not have enough inventory for this adjustment.',
          available:
            Math.max(
              0,
              currentLocationQuantity
            )
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       PREPARE ATOMIC ADJUSTMENT
    ========================================== */

    const adjustmentStatements = [];

    const removesInventory =
      adjustmentType === 'waste' ||
      adjustmentType === 'correction_remove';

    const addsInventory =
      adjustmentType === 'correction_add';


    /*
     * REMOVAL
     *
     * Waste and negative corrections remove a
     * physical cookie from the system.
     *
     * Therefore:
     *
     * location allocation decreases
     * AND
     * master quantity_total decreases.
     *
     * IMPORTANT:
     * allocation must decrease FIRST so the
     * master reconciliation trigger remains valid.
     */
    if (removesInventory) {

      adjustmentStatements.push(
        env.OBA_DB
          .prepare(`
            UPDATE inventory_allocations

            SET
              quantity_allocated =
                quantity_allocated - ?,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              inventory_item_id = ?
              AND location_id = ?
              AND status = 'active'
              AND quantity_allocated >= ?
          `)
          .bind(
            quantity,
            inventoryItemId,
            locationId,
            quantity
          )
      );


      adjustmentStatements.push(
        env.OBA_DB
          .prepare(`
            UPDATE inventory_items

            SET
              quantity_total =
                quantity_total - ?,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              inventory_item_id = ?
              AND status = 'active'
              AND quantity_total - quantity_sold >= ?
          `)
          .bind(
            quantity,
            inventoryItemId,
            quantity
          )
      );
    }


    /*
     * POSITIVE CORRECTION
     *
     * A positive count correction means physical
     * inventory exists that was not represented
     * in the system.
     *
     * Therefore:
     *
     * master quantity_total increases FIRST
     * AND
     * location allocation increases second.
     *
     * This order is required by the allocation
     * reconciliation trigger.
     */
    if (addsInventory) {

      adjustmentStatements.push(
        env.OBA_DB
          .prepare(`
            UPDATE inventory_items

            SET
              quantity_total =
                quantity_total + ?,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              inventory_item_id = ?
              AND status = 'active'
          `)
          .bind(
            quantity,
            inventoryItemId
          )
      );


      adjustmentStatements.push(
        env.OBA_DB
          .prepare(`
            INSERT INTO inventory_allocations (
              inventory_item_id,
              location_id,
              quantity_allocated,
              status
            )

            VALUES (?, ?, ?, 'active')

            ON CONFLICT (
              inventory_item_id,
              location_id
            )

            DO UPDATE SET
              quantity_allocated =
                quantity_allocated +
                excluded.quantity_allocated,

              status = 'active',

              updated_at =
                CURRENT_TIMESTAMP
          `)
          .bind(
            inventoryItemId,
            locationId,
            quantity
          )
      );
    }


    /* =========================================
       RECORD MOVEMENT
    ========================================== */

    /*
     * Waste:
     * Location -> Outside
     *
     * Positive correction:
     * Outside -> Location
     *
     * Negative correction:
     * Location -> Outside
     */

    const movementType =
      adjustmentType === 'waste'
        ? 'waste'
        : 'correction';

    const fromLocationId =
      removesInventory
        ? locationId
        : null;

    const toLocationId =
      addsInventory
        ? locationId
        : null;


    adjustmentStatements.push(
      env.OBA_DB
        .prepare(`
          INSERT INTO inventory_movements (
            inventory_item_id,
            movement_type,
            from_location_id,
            to_location_id,
            quantity,
            reason,
            reference_type,
            reference_id,
            created_by
          )

          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'crew_inventory_adjustment',
            NULL,
            NULL
          )
        `)
        .bind(
          inventoryItemId,
          movementType,
          fromLocationId,
          toLocationId,
          quantity,
          reason
        )
    );


    /* =========================================
       EXECUTE ATOMIC ADJUSTMENT
    ========================================== */

    try {
      await env.OBA_DB.batch(
        adjustmentStatements
      );
    } catch (adjustmentError) {

      console.warn(
        'Inventory adjustment could not be completed.',
        {
          inventoryItemId,
          locationId,
          adjustmentType,
          quantity,

          error:
            adjustmentError instanceof Error
              ? adjustmentError.message
              : String(adjustmentError)
        }
      );

      return Response.json(
        {
          ok: false,
          error:
            'Inventory adjustment could not be completed.'
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       VERIFY ADJUSTMENT
    ========================================== */

    const updatedInventory =
      await env.OBA_DB
        .prepare(`
          SELECT
            i.inventory_item_id,
            i.product_id,
            i.product_name,
            i.quantity_total,
            i.quantity_sold,

            COALESCE(
              a.quantity_allocated,
              0
            ) AS location_quantity

          FROM inventory_items AS i

          LEFT JOIN inventory_allocations AS a
            ON a.inventory_item_id =
               i.inventory_item_id
            AND a.location_id = ?

          WHERE
            i.inventory_item_id = ?

          LIMIT 1
        `)
        .bind(
          locationId,
          inventoryItemId
        )
        .first();


    if (!updatedInventory) {
      console.error(
        'CRITICAL: Inventory adjustment completed but verification failed.',
        {
          inventoryItemId,
          locationId,
          adjustmentType,
          quantity
        }
      );

      return Response.json(
        {
          ok: false,
          error:
            'Inventory adjustment completed but could not be verified.'
        },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }


    return Response.json(
      {
        ok: true,

        adjustment: {
          inventoryItemId,

          productId:
            updatedInventory.product_id,

          productName:
            updatedInventory.product_name,

          adjustmentType,

          quantity,

          location: {
            locationId:
              location.location_id,

            name:
              location.name
          },

          reason
        },

        inventory: {
          total:
            Number(
              updatedInventory.quantity_total
            ),

          sold:
            Number(
              updatedInventory.quantity_sold
            ),

          locationQuantity:
            Number(
              updatedInventory.location_quantity
            )
        }
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );


  } catch (error) {

    console.error(
      'Inventory adjustment error:',
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          'Unable to adjust inventory.'
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

/* =========================================
   INVENTORY LOCATION
========================================== */

if (url.pathname === '/inventory/location') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  /* =========================================
     REQUIRE ACTIVE CREW SESSION
  ========================================== */

  const crewSession =
    await getCrewSession(
      request,
      env
    );

  if (!crewSession) {
    return Response.json(
      {
        ok: false,
        authenticated: false,
        error: 'Crew authentication required.'
      },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }


  let body;

  try {
    body = await request.json();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          'Request body must be valid JSON.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  /* =========================================
     LOCATION VALIDATION
  ========================================== */

  const name =
    typeof body.name === 'string'
      ? body.name.trim().slice(0, 150)
      : '';

  const eventId =
    typeof body.eventId === 'string'
      ? body.eventId.trim().slice(0, 150)
      : '';


  if (!name) {
    return Response.json(
      {
        ok: false,
        error:
          'Event location name is required.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  if (!eventId) {
    return Response.json(
      {
        ok: false,
        error:
          'Event ID is required.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  /*
   * Generate the inventory location ID from
   * the event ID.
   *
   * Example:
   *
   * eventId:
   * hillcrest-market-2026-10-02
   *
   * locationId:
   * event-hillcrest-market-2026-10-02
   */
  const normalizedEventId =
    eventId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');


  if (!normalizedEventId) {
    return Response.json(
      {
        ok: false,
        error:
          'Event ID must contain letters or numbers.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  const locationId =
    `event-${normalizedEventId}`;


  try {

    /* =========================================
       PREVENT DUPLICATE EVENT LOCATIONS
    ========================================== */

    const existingLocation =
      await env.OBA_DB
        .prepare(`
          SELECT
            location_id,
            name,
            location_type,
            event_id,
            status

          FROM inventory_locations

          WHERE
            location_id = ?
            OR event_id = ?

          LIMIT 1
        `)
        .bind(
          locationId,
          eventId
        )
        .first();


    if (existingLocation) {
      return Response.json(
        {
          ok: false,
          error:
            'An inventory location already exists for this event.',

          existingLocation: {
            locationId:
              existingLocation.location_id,

            name:
              existingLocation.name,

            locationType:
              existingLocation.location_type,

            eventId:
              existingLocation.event_id,

            status:
              existingLocation.status
          }
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       CREATE EVENT LOCATION
    ========================================== */

    await env.OBA_DB
      .prepare(`
        INSERT INTO inventory_locations (
          location_id,
          name,
          location_type,
          status,
          event_id
        )

        VALUES (
          ?,
          ?,
          'event',
          'active',
          ?
        )
      `)
      .bind(
        locationId,
        name,
        eventId
      )
      .run();


    /* =========================================
       VERIFY EVENT LOCATION
    ========================================== */

    const createdLocation =
      await env.OBA_DB
        .prepare(`
          SELECT
            location_id,
            name,
            location_type,
            event_id,
            status,
            created_at,
            updated_at

          FROM inventory_locations

          WHERE
            location_id = ?

          LIMIT 1
        `)
        .bind(locationId)
        .first();


    if (!createdLocation) {
      console.error(
        'CRITICAL: Event inventory location was inserted but could not be verified.',
        {
          locationId,
          eventId,
          name
        }
      );

      return Response.json(
        {
          ok: false,
          error:
            'Event inventory location was created but could not be verified.'
        },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }


    return Response.json(
      {
        ok: true,

        location: {
          locationId:
            createdLocation.location_id,

          name:
            createdLocation.name,

          locationType:
            createdLocation.location_type,

          eventId:
            createdLocation.event_id,

          status:
            createdLocation.status,

          createdAt:
            createdLocation.created_at,

          updatedAt:
            createdLocation.updated_at
        }
      },
      {
        status: 201,
        headers: corsHeaders
      }
    );


  } catch (error) {

    console.error(
      'Inventory location creation error:',
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          'Unable to create event inventory location.'
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

/* =========================================
   INVENTORY TRANSFER
========================================== */

if (url.pathname === '/inventory/transfer') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          'Request body must be valid JSON.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  /* =========================================
     TRANSFER VALIDATION
  ========================================== */

  const inventoryItemId =
    Number(body.inventoryItemId);

  const fromLocationId =
    typeof body.fromLocationId === 'string'
      ? body.fromLocationId.trim()
      : '';

  const toLocationId =
    typeof body.toLocationId === 'string'
      ? body.toLocationId.trim()
      : '';

  const quantity =
    Number(body.quantity);

  const reason =
    typeof body.reason === 'string'
      ? body.reason.trim().slice(0, 500)
      : null;


  if (
    !Number.isInteger(inventoryItemId) ||
    inventoryItemId < 1
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Invalid inventory item ID.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  if (
    !fromLocationId ||
    !toLocationId
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Both inventory locations are required.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  if (fromLocationId === toLocationId) {
    return Response.json(
      {
        ok: false,
        error:
          'Inventory must be transferred to a different location.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Transfer quantity must be a positive whole number.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  try {

    /* =========================================
       LOAD INVENTORY ITEM
    ========================================== */

    const inventoryItem =
      await env.OBA_DB
        .prepare(`
          SELECT
            inventory_item_id,
            drop_id,
            product_id,
            product_name,
            status

          FROM inventory_items

          WHERE
            inventory_item_id = ?

          LIMIT 1
        `)
        .bind(inventoryItemId)
        .first();


    if (!inventoryItem) {
      return Response.json(
        {
          ok: false,
          error:
            'Inventory item was not found.'
        },
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       LOAD SOURCE + DESTINATION LOCATIONS
    ========================================== */

    const locationsResult =
      await env.OBA_DB
        .prepare(`
          SELECT
            location_id,
            name,
            location_type,
            status

          FROM inventory_locations

          WHERE
            location_id IN (?, ?)
        `)
        .bind(
          fromLocationId,
          toLocationId
        )
        .all();

    const locations =
      locationsResult.results ?? [];

    const fromLocation =
      locations.find(
        location =>
          location.location_id ===
          fromLocationId
      );

    const toLocation =
      locations.find(
        location =>
          location.location_id ===
          toLocationId
      );


    if (
      !fromLocation ||
      !toLocation
    ) {
      return Response.json(
        {
          ok: false,
          error:
            'One or more inventory locations were not found.'
        },
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }


    if (
      fromLocation.status !== 'active' ||
      toLocation.status !== 'active'
    ) {
      return Response.json(
        {
          ok: false,
          error:
            'Inventory can only be transferred between active locations.'
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       LOAD SOURCE ALLOCATION
    ========================================== */

    const sourceAllocation =
      await env.OBA_DB
        .prepare(`
          SELECT
            allocation_id,
            inventory_item_id,
            location_id,
            quantity_allocated,
            status

          FROM inventory_allocations

          WHERE
            inventory_item_id = ?
            AND location_id = ?

          LIMIT 1
        `)
        .bind(
          inventoryItemId,
          fromLocationId
        )
        .first();


    if (
      !sourceAllocation ||
      sourceAllocation.status !== 'active'
    ) {
      return Response.json(
        {
          ok: false,
          error:
            'The source location does not have active inventory for this cookie.'
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    const sourceQuantity =
      Number(
        sourceAllocation.quantity_allocated
      );


    if (
      !Number.isInteger(sourceQuantity) ||
      sourceQuantity < quantity
    ) {
      return Response.json(
        {
          ok: false,
          error:
            'The source location does not have enough inventory for this transfer.',
          available:
            Number.isInteger(sourceQuantity)
              ? Math.max(0, sourceQuantity)
              : 0
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       ATOMIC INVENTORY TRANSFER
    ========================================== */

    const transferStatements = [];


    /*
     * 1. Remove physical inventory from
     *    the source location.
     */
    transferStatements.push(
      env.OBA_DB
        .prepare(`
          UPDATE inventory_allocations

          SET
            quantity_allocated =
              quantity_allocated - ?,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            inventory_item_id = ?
            AND location_id = ?
            AND status = 'active'
            AND quantity_allocated >= ?
        `)
        .bind(
          quantity,
          inventoryItemId,
          fromLocationId,
          quantity
        )
    );


    /*
     * 2. Add the same physical inventory
     *    to the destination location.
     *
     *    If this cookie has never been assigned
     *    there before, create its allocation row.
     */
    transferStatements.push(
      env.OBA_DB
        .prepare(`
          INSERT INTO inventory_allocations (
            inventory_item_id,
            location_id,
            quantity_allocated,
            status
          )

          VALUES (?, ?, ?, 'active')

          ON CONFLICT (
            inventory_item_id,
            location_id
          )

          DO UPDATE SET
            quantity_allocated =
              quantity_allocated +
              excluded.quantity_allocated,

            status = 'active',

            updated_at =
              CURRENT_TIMESTAMP
        `)
        .bind(
          inventoryItemId,
          toLocationId,
          quantity
        )
    );


    /*
     * 3. Record the physical movement in
     *    the permanent inventory ledger.
     */
    transferStatements.push(
      env.OBA_DB
        .prepare(`
          INSERT INTO inventory_movements (
            inventory_item_id,
            movement_type,
            from_location_id,
            to_location_id,
            quantity,
            reason,
            reference_type,
            reference_id,
            created_by
          )

          VALUES (
            ?,
            'transfer',
            ?,
            ?,
            ?,
            ?,
            'crew_inventory_transfer',
            NULL,
            NULL
          )
        `)
        .bind(
          inventoryItemId,
          fromLocationId,
          toLocationId,
          quantity,
          reason || null
        )
    );


    try {
      await env.OBA_DB.batch(
        transferStatements
      );
    } catch (transferError) {

      console.warn(
        'Inventory transfer could not be completed.',
        {
          inventoryItemId,
          fromLocationId,
          toLocationId,
          quantity,

          error:
            transferError instanceof Error
              ? transferError.message
              : String(transferError)
        }
      );

      return Response.json(
        {
          ok: false,
          error:
            'Inventory transfer could not be completed.'
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       VERIFY TRANSFER
    ========================================== */

    const allocationsResult =
      await env.OBA_DB
        .prepare(`
          SELECT
            a.location_id,
            l.name AS location_name,
            a.quantity_allocated

          FROM inventory_allocations AS a

          INNER JOIN inventory_locations AS l
            ON l.location_id =
              a.location_id

          WHERE
            a.inventory_item_id = ?
            AND a.location_id IN (?, ?)

          ORDER BY
            a.location_id
        `)
        .bind(
          inventoryItemId,
          fromLocationId,
          toLocationId
        )
        .all();


    return Response.json(
      {
        ok: true,

        transfer: {
          inventoryItemId,

          productId:
            inventoryItem.product_id,

          productName:
            inventoryItem.product_name,

          quantity,

          fromLocation: {
            locationId:
              fromLocation.location_id,

            name:
              fromLocation.name
          },

          toLocation: {
            locationId:
              toLocation.location_id,

            name:
              toLocation.name
          },

          reason:
            reason || null
        },

        allocations:
          (allocationsResult.results ?? [])
            .map(allocation => ({
              locationId:
                allocation.location_id,

              locationName:
                allocation.location_name,

              quantityAllocated:
                Number(
                  allocation.quantity_allocated
                )
            }))
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );


  } catch (error) {

    console.error(
      'Inventory transfer error:',
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          'Unable to transfer inventory.'
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}
    
/* =========================================
   INVENTORY
========================================== */

if (url.pathname === '/inventory') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'GET') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  try {

    /*
     * Expire old reservations before calculating
     * currently held inventory.
     */
    await env.OBA_DB
      .prepare(`
        UPDATE cart_reservations
        SET
          status = 'expired',
          updated_at = CURRENT_TIMESTAMP
        WHERE
          status = 'active'
          AND julianday(expires_at) <= julianday('now')
      `)
      .run();


    /*
     * Find the currently active inventory drop.
     */
    const activeDrop =
      await env.OBA_DB
        .prepare(`
          SELECT
            drop_id,
            name,
            sales_start_at,
            sales_end_at,
            fulfillment_start_date,
            fulfillment_end_date,
            status
          FROM inventory_drops
          WHERE status = 'active'
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .first();

    if (!activeDrop) {
      return Response.json(
        {
          ok: true,
          drop: null,
          items: []
        },
        {
          headers: corsHeaders
        }
      );
    }


    /*
     * Calculate authoritative availability.
     *
     * available =
     * total
     * - sold
     * - units in active, unexpired reservations
     *
     * active_cart_count counts reservations/carts,
     * NOT individual cookie units.
     */
    const inventoryResult =
      await env.OBA_DB
        .prepare(`
          SELECT
            i.inventory_item_id,
            i.product_id,
            i.product_name,
            i.quantity_total,
            i.quantity_sold,
            i.status,

            COALESCE(
              SUM(
                CASE
                  WHEN
                    r.status = 'active'
                    AND julianday(r.expires_at) > julianday('now')
                  THEN ri.quantity
                  ELSE 0
                END
              ),
              0
            ) AS quantity_reserved,

            COUNT(
              DISTINCT CASE
                WHEN
                  r.status = 'active'
                  AND julianday(r.expires_at) > julianday('now')
                THEN r.reservation_id
                ELSE NULL
              END
            ) AS active_cart_count

          FROM inventory_items AS i

          LEFT JOIN cart_reservation_items AS ri
            ON ri.inventory_item_id =
              i.inventory_item_id

          LEFT JOIN cart_reservations AS r
            ON r.reservation_id =
              ri.reservation_id

          WHERE
            i.drop_id = ?

          GROUP BY
            i.inventory_item_id,
            i.product_id,
            i.product_name,
            i.quantity_total,
            i.quantity_sold,
            i.status

          ORDER BY
            i.inventory_item_id
        `)
        .bind(activeDrop.drop_id)
        .all();


    const items =
      (inventoryResult.results ?? [])
        .map(item => {

          const total =
            Number(item.quantity_total);

          const sold =
            Number(item.quantity_sold);

          const reserved =
            Number(item.quantity_reserved);

          const available =
            Math.max(
              0,
              total -
              sold -
              reserved
            );

          return {
            inventoryItemId:
              item.inventory_item_id,

            productId:
              item.product_id,

            productName:
              item.product_name,

            total,

            sold,

            reserved,

            available,

            activeCartCount:
              Number(
                item.active_cart_count
              ),

            status:
              item.status
          };
        });


    return Response.json(
      {
        ok: true,

        drop: {
          dropId:
            activeDrop.drop_id,

          name:
            activeDrop.name,

          salesStartAt:
            activeDrop.sales_start_at,

          salesEndAt:
            activeDrop.sales_end_at,

          fulfillmentStartDate:
            activeDrop.fulfillment_start_date,

          fulfillmentEndDate:
            activeDrop.fulfillment_end_date,

          status:
            activeDrop.status
        },

        items
      },
      {
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error(
      'Inventory lookup error:',
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          'Unable to load current inventory.'
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

/* =========================================
   CART RESERVATION
========================================== */

if (url.pathname === '/cart-reservation') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          'Request body must be valid JSON.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  /* =========================================
     CART ID VALIDATION
  ========================================== */

  const cartId =
    typeof body.cartId === 'string'
      ? body.cartId.trim()
      : '';

  const cartIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    !cartId ||
    !cartIdPattern.test(cartId)
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Invalid cart ID.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  /* =========================================
     CART ITEM VALIDATION
  ========================================== */

  if (
    !Array.isArray(body.items) ||
    body.items.length === 0
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Your cart is empty.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }

  const requestedItems = [];
  const seenProductIds = new Set();

  for (const item of body.items) {

    const productId =
      typeof item?.id === 'string'
        ? item.id.trim()
        : '';

    const product =
      COOKIE_CATALOG[productId];

    if (!product) {
      return Response.json(
        {
          ok: false,
          error:
            `Unknown product: ${productId}`
        },
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    if (seenProductIds.has(productId)) {
      return Response.json(
        {
          ok: false,
          error:
            `Duplicate cart item: ${product.name}`
        },
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 24
    ) {
      return Response.json(
        {
          ok: false,
          error:
            `Invalid quantity for ${product.name}.`
        },
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    seenProductIds.add(productId);

    requestedItems.push({
      productId,
      productName:
        product.name,
      quantity:
        item.quantity
    });
  }


  try {

    /* =========================================
       EXPIRE OLD RESERVATIONS
    ========================================== */

    await env.OBA_DB
      .prepare(`
        UPDATE cart_reservations
        SET
          status = 'expired',
          updated_at = CURRENT_TIMESTAMP
        WHERE
          status = 'active'
          AND julianday(expires_at) <= julianday('now')
      `)
      .run();


    /* =========================================
       ACTIVE DROP
    ========================================== */

    const activeDrop =
      await env.OBA_DB
        .prepare(`
          SELECT
            drop_id,
            name
          FROM inventory_drops
          WHERE status = 'active'
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .first();

    if (!activeDrop) {
      return Response.json(
        {
          ok: false,
          error:
            'There is no active cookie drop.'
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       EXISTING RESERVATION
    ========================================== */

    const existingReservation =
      await env.OBA_DB
        .prepare(`
          SELECT
            reservation_id,
            status,
            expires_at,
            extension_count
          FROM cart_reservations
          WHERE
            cart_id = ?
            AND drop_id = ?
            AND status = 'active'
            AND julianday(expires_at) > julianday('now')
          LIMIT 1
        `)
        .bind(
          cartId,
          activeDrop.drop_id
        )
        .first();

    /* =========================================
      UPDATE EXISTING ACTIVE RESERVATION
    ========================================== */

    if (
      existingReservation &&
      existingReservation.status === 'active'
    ) {

      /*
      * Load the inventory records for this drop.
      *
      * We need the database inventory_item_id for
      * each requested product before constructing
      * the atomic update batch.
      */
      const existingInventoryResult =
        await env.OBA_DB
          .prepare(`
            SELECT
              inventory_item_id,
              product_id,
              product_name,
              quantity_total,
              quantity_sold,
              status
            FROM inventory_items
            WHERE drop_id = ?
            ORDER BY inventory_item_id
          `)
          .bind(activeDrop.drop_id)
          .all();

      const existingInventoryByProduct =
        new Map(
          (existingInventoryResult.results ?? [])
            .map(item => [
              item.product_id,
              item
            ])
        );


      /*
      * Every requested product must still exist
      * and remain active.
      */
      for (const requestedItem of requestedItems) {

        const inventoryItem =
          existingInventoryByProduct.get(
            requestedItem.productId
          );

        if (
          !inventoryItem ||
          inventoryItem.status !== 'active'
        ) {
          return Response.json(
            {
              ok: false,
              error:
                `${requestedItem.productName} is not currently available.`,
              inventoryChanged: true,
            },
            {
              status: 409,
              headers: corsHeaders
            }
          );
        }
      }

       /*
        * Revalidate the ENTIRE requested cart before
        * updating an existing reservation.
        *
        * This is required even when a requested
        * quantity did not change.
        *
        * The database UPDATE/INSERT triggers protect
        * quantities that are actually mutated, but an
        * unchanged reservation item does not execute
        * either trigger.
        *
        * excludeReservationId prevents this cart's
        * current hold from being counted against
        * itself while determining whether its desired
        * quantities can still be supported.
        */
        const unavailableExistingItems =
          await getUnavailableReservationItems(
            env,
            activeDrop.drop_id,
            requestedItems,
            existingReservation.reservation_id
          );

        if (unavailableExistingItems.length > 0) {
          return Response.json(
            {
              ok: false,

              error:
                'One or more cookies are no longer available in the requested quantity.',

              inventoryChanged: true,

              unavailableItems:
                unavailableExistingItems
            },
            {
              status: 409,
              headers: corsHeaders
            }
          );
        }

      /*
      * Load the cart's currently reserved items.
      */
      const currentReservationItemsResult =
        await env.OBA_DB
          .prepare(`
            SELECT
              ri.reservation_item_id,
              ri.inventory_item_id,
              ri.quantity,
              i.product_id,
              i.product_name

            FROM cart_reservation_items AS ri

            INNER JOIN inventory_items AS i
              ON i.inventory_item_id =
                ri.inventory_item_id

            WHERE
              ri.reservation_id = ?

            ORDER BY
              ri.reservation_item_id
          `)
          .bind(
            existingReservation.reservation_id
          )
          .all();

      const currentReservationItems =
        currentReservationItemsResult.results ?? [];

      const currentByProduct =
        new Map(
          currentReservationItems.map(item => [
            item.product_id,
            item
          ])
        );

      const requestedByProduct =
        new Map(
          requestedItems.map(item => [
            item.productId,
            item
          ])
        );


      /* =========================================
        PREPARE ATOMIC CART UPDATE
      ========================================== */

      const updateStatements = [];


      /*
      * 1. Update quantities for products already
      *    present in this reservation.
      *
      * The UPDATE inventory trigger excludes the
      * row's OLD quantity while calculating
      * remaining inventory, so changing:
      *
      * Campfire ×2 → Campfire ×3
      *
      * is evaluated against inventory without
      * double-counting this cart's existing hold.
      */
      for (
        const currentItem of
        currentReservationItems
      ) {

        const requestedItem =
          requestedByProduct.get(
            currentItem.product_id
          );

        if (
          requestedItem &&
          Number(currentItem.quantity) !==
            requestedItem.quantity
        ) {
          updateStatements.push(
            env.OBA_DB
              .prepare(`
                UPDATE cart_reservation_items
                SET
                  quantity = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE
                  reservation_item_id = ?
                  AND reservation_id = ?
              `)
              .bind(
                requestedItem.quantity,
                currentItem.reservation_item_id,
                existingReservation.reservation_id
              )
          );
        }
      }


      /*
      * 2. Insert products newly added to the cart.
      *
      * The INSERT inventory trigger protects these
      * additions against overreservation.
      */
      for (const requestedItem of requestedItems) {

        if (
          !currentByProduct.has(
            requestedItem.productId
          )
        ) {
          const inventoryItem =
            existingInventoryByProduct.get(
              requestedItem.productId
            );

          updateStatements.push(
            env.OBA_DB
              .prepare(`
                INSERT INTO cart_reservation_items (
                  reservation_id,
                  inventory_item_id,
                  quantity
                )
                VALUES (?, ?, ?)
              `)
              .bind(
                existingReservation.reservation_id,
                inventoryItem.inventory_item_id,
                requestedItem.quantity
              )
          );
        }
      }


      /*
      * 3. Remove products no longer present in the
      *    browser cart.
      */
      for (
        const currentItem of
        currentReservationItems
      ) {

        if (
          !requestedByProduct.has(
            currentItem.product_id
          )
        ) {
          updateStatements.push(
            env.OBA_DB
              .prepare(`
                DELETE FROM cart_reservation_items
                WHERE
                  reservation_item_id = ?
                  AND reservation_id = ?
              `)
              .bind(
                currentItem.reservation_item_id,
                existingReservation.reservation_id
              )
          );
        }
      }


      /*
      * Touch the reservation itself without changing:
      *
      * reservation_id
      * expires_at
      * extension_count
      *
      * A normal cart edit therefore does NOT renew
      * the customer's 15-minute inventory hold.
      */
      updateStatements.push(
        env.OBA_DB
          .prepare(`
            UPDATE cart_reservations
            SET
              updated_at = CURRENT_TIMESTAMP
            WHERE
              reservation_id = ?
              AND cart_id = ?
              AND drop_id = ?
              AND status = 'active'
              AND julianday(expires_at) > julianday('now')
          `)
          .bind(
            existingReservation.reservation_id,
            cartId,
            activeDrop.drop_id
          )
      );


      /* =========================================
        EXECUTE ATOMIC CART UPDATE
      ========================================== */

      try {
        await env.OBA_DB.batch(
          updateStatements
        );

      } catch (reservationUpdateError) {

        console.warn(
          'Cart reservation could not be updated.',
          {
            cartId,
            reservationId:
              existingReservation.reservation_id,
            dropId:
              activeDrop.drop_id,

            error:
              reservationUpdateError instanceof Error
                ? reservationUpdateError.message
                : String(
                    reservationUpdateError
                  )
          }
        );

        const unavailableItems =
          await getUnavailableReservationItems(
            env,
            activeDrop.drop_id,
            requestedItems,
            existingReservation.reservation_id
          );

        return Response.json(
          {
            ok: false,
            error:
              'One or more cookies are no longer available in the requested quantity.',
            inventoryChanged: true,
           unavailableItems
          },
          {
            status: 409,
            headers: corsHeaders
          }
        );
      }


      /* =========================================
        VERIFY UPDATED RESERVATION
      ========================================== */

      const updatedReservation =
        await env.OBA_DB
          .prepare(`
            SELECT
              reservation_id,
              cart_id,
              drop_id,
              status,
              expires_at,
              extension_count
            FROM cart_reservations
            WHERE
              reservation_id = ?
              AND status = 'active'
              AND julianday(expires_at) > julianday('now')
            LIMIT 1
          `)
          .bind(
            existingReservation.reservation_id
          )
          .first();

      const updatedItemsResult =
        await env.OBA_DB
          .prepare(`
            SELECT
              i.product_id,
              i.product_name,
              ri.quantity

            FROM cart_reservation_items AS ri

            INNER JOIN inventory_items AS i
              ON i.inventory_item_id =
                ri.inventory_item_id

            WHERE
              ri.reservation_id = ?

            ORDER BY
              i.inventory_item_id
          `)
          .bind(
            existingReservation.reservation_id
          )
          .all();

      const updatedItems =
        updatedItemsResult.results ?? [];


      /*
      * Verify that the database now represents
      * exactly the requested browser cart.
      */
      let updateVerified =
        Boolean(updatedReservation) &&
        updatedItems.length ===
          requestedItems.length;

      if (updateVerified) {

        const updatedByProduct =
          new Map(
            updatedItems.map(item => [
              item.product_id,
              Number(item.quantity)
            ])
          );

        for (
          const requestedItem of requestedItems
        ) {
          if (
            updatedByProduct.get(
              requestedItem.productId
            ) !== requestedItem.quantity
          ) {
            updateVerified = false;
            break;
          }
        }
      }


      /*
      * The reservation's hold deadline must not
      * change during an ordinary cart edit.
      */
      if (
        updateVerified &&
        updatedReservation.expires_at !==
          existingReservation.expires_at
      ) {
        updateVerified = false;
      }


      if (!updateVerified) {

        console.error(
          'CRITICAL: Cart reservation update completed but verification failed.',
          {
            cartId,
            reservationId:
              existingReservation.reservation_id
          }
        );

        return Response.json(
          {
            ok: false,
            error:
              'The updated cookie reservation could not be verified.'
          },
          {
            status: 500,
            headers: corsHeaders
          }
        );
      }


      return Response.json(
        {
          ok: true,

          reservationUpdated: true,

          reservation: {
            reservationId:
              updatedReservation.reservation_id,

            cartId:
              updatedReservation.cart_id,

            dropId:
              updatedReservation.drop_id,

            status:
              updatedReservation.status,

            expiresAt:
              updatedReservation.expires_at,

            extensionCount:
              Number(
                updatedReservation.extension_count
              ),

            items:
              updatedItems.map(item => ({
                productId:
                  item.product_id,

                productName:
                  item.product_name,

                quantity:
                  Number(item.quantity)
              }))
          }
        },
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }

   /*
    * Every new hold receives its own reservation ID.
    * Expired/released reservations remain as history.
    */
    const reservationId =
      crypto.randomUUID();

   /*
    * Initial reservation timing:
    *
    * 15 minutes of normal shopping time
    * + 30 seconds of protected renewal grace.
    *
    * The frontend will eventually show the
    * "Still hungry?" prompt 30 seconds before
    * this authoritative hard expiration.
    */
    const expiresAt =
      new Date(
        Date.now() +
        (15 * 60 * 1000) +
        (30 * 1000)
      ).toISOString();


    /* =========================================
       LOAD INVENTORY RECORDS
    ========================================== */

    const inventoryResult =
      await env.OBA_DB
        .prepare(`
          SELECT
            inventory_item_id,
            product_id,
            product_name,
            quantity_total,
            quantity_sold,
            status
          FROM inventory_items
          WHERE drop_id = ?
          ORDER BY inventory_item_id
        `)
        .bind(activeDrop.drop_id)
        .all();

    const inventoryByProduct =
      new Map(
        (inventoryResult.results ?? [])
          .map(item => [
            item.product_id,
            item
          ])
      );

    for (const requestedItem of requestedItems) {

      const inventoryItem =
        inventoryByProduct.get(
          requestedItem.productId
        );

      if (
        !inventoryItem ||
        inventoryItem.status !== 'active'
      ) {
        return Response.json(
          {
            ok: false,
            error:
              `${requestedItem.productName} is not currently available.`
          },
          {
            status: 409,
            headers: corsHeaders
          }
        );
      }
    }


    /* =========================================
       PREPARE ATOMIC RESERVATION BATCH
    ========================================== */

    const statements = [];

    statements.push(
  env.OBA_DB
    .prepare(`
      INSERT INTO cart_reservations (
        reservation_id,
        cart_id,
        drop_id,
        status,
        expires_at,
        extension_count
      )
      VALUES (?, ?, ?, 'active', ?, 0)
    `)
    .bind(
      reservationId,
      cartId,
      activeDrop.drop_id,
      expiresAt
    )
);

/*
 * Insert every requested item directly.
 *
 * The D1 trigger:
 * prevent_inventory_overreservation
 *
 * is the database-level inventory guard.
 *
 * If any requested quantity exceeds the remaining
 * sellable inventory, the trigger raises
 * "insufficient_inventory".
 *
 * Because these statements execute inside the same
 * D1 batch as the reservation INSERT, that database
 * error causes the entire batch to roll back,
 * including the cart_reservations row.
 */
for (const requestedItem of requestedItems) {

  const inventoryItem =
    inventoryByProduct.get(
      requestedItem.productId
    );

  statements.push(
    env.OBA_DB
      .prepare(`
        INSERT INTO cart_reservation_items (
          reservation_id,
          inventory_item_id,
          quantity
        )
        VALUES (?, ?, ?)
      `)
      .bind(
        reservationId,
        inventoryItem.inventory_item_id,
        requestedItem.quantity
      )
  );
}


    let batchResults;

    try {
      batchResults =
        await env.OBA_DB.batch(
          statements
        );
    } catch (reservationError) {

      console.warn(
        'Cart reservation could not be created.',
        {
          cartId,
          dropId:
            activeDrop.drop_id,
          error:
            reservationError instanceof Error
              ? reservationError.message
              : String(reservationError)
        }
      );

      const unavailableItems =
        await getUnavailableReservationItems(
          env,
          activeDrop.drop_id,
          requestedItems
        );

      return Response.json(
        {
          ok: false,
          error:
            'One or more cookies are no longer available in the requested quantity.',
          inventoryChanged: true,
          unavailableItems
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       VERIFY RESERVATION
    ========================================== */

    const savedReservation =
      await env.OBA_DB
        .prepare(`
          SELECT
            reservation_id,
            cart_id,
            drop_id,
            status,
            expires_at,
            extension_count
          FROM cart_reservations
          WHERE reservation_id = ?
          LIMIT 1
        `)
        .bind(reservationId)
        .first();

    const savedItems =
      await env.OBA_DB
        .prepare(`
          SELECT
            i.product_id,
            i.product_name,
            ri.quantity

          FROM cart_reservation_items AS ri

          INNER JOIN inventory_items AS i
            ON i.inventory_item_id =
              ri.inventory_item_id

          WHERE
            ri.reservation_id = ?

          ORDER BY
            i.inventory_item_id
        `)
        .bind(reservationId)
        .all();

    if (
      !savedReservation ||
      savedReservation.status !== 'active' ||
      (savedItems.results ?? []).length !==
        requestedItems.length
    ) {
      console.error(
        'CRITICAL: Reservation batch completed but verification failed.',
        {
          cartId,
          reservationId
        }
      );

      return Response.json(
        {
          ok: false,
          error:
            'The cookie reservation could not be verified.'
        },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }


    return Response.json(
      {
        ok: true,

        reservation: {
          reservationId:
            savedReservation.reservation_id,

          cartId:
            savedReservation.cart_id,

          dropId:
            savedReservation.drop_id,

          status:
            savedReservation.status,

          expiresAt:
            savedReservation.expires_at,

          extensionCount:
            Number(
              savedReservation.extension_count
            ),

          items:
            (savedItems.results ?? [])
              .map(item => ({
                productId:
                  item.product_id,

                productName:
                  item.product_name,

                quantity:
                  Number(item.quantity)
              }))
        }
      },
      {
        status: 201,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error(
      'Cart reservation error:',
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          'Unable to reserve your cookies.'
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

/* =========================================
   CART CHECKOUT PROTECTION
========================================== */

if (
  url.pathname ===
  '/cart-reservation/checkout-protection'
) {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          'Request body must be valid JSON.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  /* =========================================
     CART ID VALIDATION
  ========================================== */

  const cartId =
    typeof body.cartId === 'string'
      ? body.cartId.trim()
      : '';

  const cartIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    !cartId ||
    !cartIdPattern.test(cartId)
  ) {
    return Response.json(
      {
        ok: false,
        error: 'Invalid cart ID.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  try {

    /* =========================================
       FIND ACTIVE RESERVATION
    ========================================== */

    /*
     * Do not revive an expired reservation.
     *
     * Checkout protection is available only
     * while the customer's inventory hold is
     * still active and authoritative.
     */
    const activeReservation =
      await env.OBA_DB
        .prepare(`
          SELECT
            reservation_id,
            cart_id,
            drop_id,
            status,
            expires_at,
            extension_count,
            checkout_protection_used

          FROM cart_reservations

          WHERE
            cart_id = ?
            AND status = 'active'
            AND julianday(expires_at) > julianday('now')

          ORDER BY created_at DESC
          LIMIT 1
        `)
        .bind(cartId)
        .first();


    if (!activeReservation) {

      /*
       * Keep stale historical rows accurate.
       */
      await env.OBA_DB
        .prepare(`
          UPDATE cart_reservations
          SET
            status = 'expired',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            cart_id = ?
            AND status = 'active'
            AND julianday(expires_at) <= julianday('now')
        `)
        .bind(cartId)
        .run();

      return Response.json(
        {
          ok: false,

          error:
            'Your cookie hold has expired.',

          reservationExpired: true
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       ALREADY USED
    ========================================== */

    /*
     * Checkout protection is one-time.
     *
     * A duplicate frontend request must never
     * award another five-minute floor.
     */
    if (
      Number(
        activeReservation
          .checkout_protection_used
      ) === 1
    ) {
      return Response.json(
        {
          ok: true,

          checkoutProtectionApplied: false,
          checkoutProtectionAlreadyUsed: true,

          reservation: {
            reservationId:
              activeReservation.reservation_id,

            cartId:
              activeReservation.cart_id,

            dropId:
              activeReservation.drop_id,

            status:
              activeReservation.status,

            expiresAt:
              activeReservation.expires_at,

            extensionCount:
              Number(
                activeReservation.extension_count
              ),

            checkoutProtectionUsed: true
          }
        },
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       APPLY ONE-TIME CHECKOUT PROTECTION
    ========================================== */

    /*
     * The first qualifying checkout interaction
     * consumes checkout protection.
     *
     * If fewer than five minutes remain:
     *   expires_at = now + 5 minutes
     *
     * If five minutes or more remain:
     *   preserve the existing expires_at
     *
     * Either way, mark the protection as used.
     *
     * This is deliberately independent of
     * extension_count / "Keep My Cookies".
     */
    const protectionResult =
      await env.OBA_DB
        .prepare(`
          UPDATE cart_reservations

          SET
            expires_at =
              CASE
                WHEN
                  julianday(expires_at) <
                  julianday(
                    'now',
                    '+5 minutes'
                  )
                THEN
                  datetime(
                    'now',
                    '+5 minutes'
                  )
                ELSE
                  expires_at
              END,

            checkout_protection_used = 1,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            reservation_id = ?
            AND cart_id = ?
            AND status = 'active'
            AND julianday(expires_at) > julianday('now')
            AND checkout_protection_used = 0
        `)
        .bind(
          activeReservation.reservation_id,
          cartId
        )
        .run();


    /* =========================================
       VERIFY / HANDLE REQUEST RACE
    ========================================== */

    const protectedReservation =
      await env.OBA_DB
        .prepare(`
          SELECT
            reservation_id,
            cart_id,
            drop_id,
            status,
            expires_at,
            extension_count,
            checkout_protection_used

          FROM cart_reservations

          WHERE
            reservation_id = ?
            AND cart_id = ?

          LIMIT 1
        `)
        .bind(
          activeReservation.reservation_id,
          cartId
        )
        .first();


    if (
      protectedReservation &&
      protectedReservation.status === 'active' &&
      Number(
        protectedReservation
          .checkout_protection_used
      ) === 1 &&
      Date.parse(
        protectedReservation.expires_at
      ) > Date.now()
    ) {

      /*
       * meta.changes === 1 means this request
       * consumed the protection.
       *
       * meta.changes === 0 with the flag now at
       * 1 means another simultaneous request won
       * the race. Treat that as an idempotent
       * success, but do not grant more time.
       */
      const appliedByThisRequest =
        protectionResult.meta?.changes === 1;

      return Response.json(
        {
          ok: true,

          checkoutProtectionApplied:
            appliedByThisRequest,

          checkoutProtectionAlreadyUsed:
            !appliedByThisRequest,

          reservation: {
            reservationId:
              protectedReservation.reservation_id,

            cartId:
              protectedReservation.cart_id,

            dropId:
              protectedReservation.drop_id,

            status:
              protectedReservation.status,

            expiresAt:
              protectedReservation.expires_at,

            extensionCount:
              Number(
                protectedReservation.extension_count
              ),

            checkoutProtectionUsed: true
          }
        },
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }


    /*
     * If the reservation expired during the
     * request, clean up its historical state.
     * Never revive it here.
     */
    await env.OBA_DB
      .prepare(`
        UPDATE cart_reservations
        SET
          status = 'expired',
          updated_at = CURRENT_TIMESTAMP
        WHERE
          reservation_id = ?
          AND status = 'active'
          AND julianday(expires_at) <= julianday('now')
      `)
      .bind(
        activeReservation.reservation_id
      )
      .run();


    return Response.json(
      {
        ok: false,

        error:
          'Your cookie hold could not be protected for checkout.',

        reservationExpired: true
      },
      {
        status: 409,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error(
      'Cart checkout protection error:',
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          'Unable to protect your cookie reservation for checkout.'
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

/* =========================================
   CART RESERVATION RENEWAL
========================================== */

if (url.pathname === '/cart-reservation/renew') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          'Request body must be valid JSON.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  /* =========================================
     CART ID VALIDATION
  ========================================== */

  const cartId =
    typeof body.cartId === 'string'
      ? body.cartId.trim()
      : '';

  const cartIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    !cartId ||
    !cartIdPattern.test(cartId)
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Invalid cart ID.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  try {

    /*
     * IMPORTANT:
     *
     * Do NOT expire reservations before looking
     * for this cart.
     *
     * A renewal is allowed only while the
     * reservation is still active and before its
     * authoritative expires_at deadline.
     *
     * Once expires_at has passed, this endpoint
     * must never revive the old hold.
     */


    /* =========================================
       FIND ACTIVE RESERVATION
    ========================================== */

    const activeReservation =
      await env.OBA_DB
        .prepare(`
          SELECT
            reservation_id,
            cart_id,
            drop_id,
            status,
            expires_at,
            extension_count,

            CAST(
              (
                julianday(expires_at) -
                julianday('now')
              ) * 86400
              AS INTEGER
            ) AS seconds_remaining

          FROM cart_reservations

          WHERE
            cart_id = ?
            AND status = 'active'
            AND julianday(expires_at) > julianday('now')

          ORDER BY created_at DESC
          LIMIT 1
        `)
        .bind(cartId)
        .first();


    /*
     * The hold has already expired, was released,
     * or otherwise no longer exists.
     *
     * We deliberately do NOT revive it here.
     * The frontend will later use a fresh
     * availability check/reservation instead.
     */
    if (!activeReservation) {

      /*
       * Clean up any stale active row so its
       * historical status accurately reflects
       * expiration.
       */
      await env.OBA_DB
        .prepare(`
          UPDATE cart_reservations
          SET
            status = 'expired',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            cart_id = ?
            AND status = 'active'
            AND julianday(expires_at) <= julianday('now')
        `)
        .bind(cartId)
        .run();

      return Response.json(
        {
          ok: false,

          error:
            'Your cookie hold has expired.',

          reservationExpired: true
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    const secondsRemaining =
      Number(
        activeReservation.seconds_remaining
      );


    /* =========================================
       RENEWAL LIMIT
    ========================================== */

    /*
     * OBA currently allows one renewal.
     *
     * Initial hold:
     * 15 minutes + 30-second protected grace
     *
     * Renewal:
     * one additional 15 minutes
     *
     * extension_count:
     * 0 = never renewed
     * 1 = renewal already used
     */
    if (
      Number(
        activeReservation.extension_count
      ) >= 1
    ) {
      return Response.json(
        {
          ok: false,

          error:
            'This cookie hold has already been extended.',

          renewalLimitReached: true,

          reservation: {
            reservationId:
              activeReservation.reservation_id,

            expiresAt:
              activeReservation.expires_at,

            extensionCount:
              Number(
                activeReservation.extension_count
              )
          }
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       RENEWAL WINDOW
    ========================================== */

    /*
     * Renewal is intentionally available only
     * during the final protected 30 seconds.
     *
     * This prevents ordinary browsing or an early
     * button press from turning the reservation
     * into an indefinite hold.
     *
     * Because the initial reservation lasts
     * 15 minutes + 30 seconds, the frontend can
     * show "Still hungry?" after 15 minutes and
     * the customer has the remaining 30 seconds
     * to explicitly keep the cookies.
     */
    if (
      !Number.isFinite(secondsRemaining) ||
      secondsRemaining > 30
    ) {
      return Response.json(
        {
          ok: false,

          error:
            'This cookie hold is not ready for renewal yet.',

          renewalNotAvailableYet: true,

          secondsRemaining:
            Number.isFinite(
              secondsRemaining
            )
              ? Math.max(
                  0,
                  secondsRemaining
                )
              : null,

          reservation: {
            reservationId:
              activeReservation.reservation_id,

            expiresAt:
              activeReservation.expires_at,

            extensionCount:
              Number(
                activeReservation.extension_count
              )
          }
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       ATOMIC RENEWAL
    ========================================== */

    /*
     * Extend from the CURRENT authoritative
     * expiration, not from browser time.
     *
     * The conditional UPDATE protects against:
     *
     * - duplicate renewal requests
     * - renewal after expiration
     * - renewal outside the 30-second window
     * - a released reservation
     * - a second extension
     *
     * The database therefore remains authoritative
     * even if multiple browser requests race.
     */
    const renewalResult =
      await env.OBA_DB
        .prepare(`
          UPDATE cart_reservations

          SET
            expires_at =
              datetime(
                expires_at,
                '+15 minutes'
              ),

            extension_count =
              extension_count + 1,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            reservation_id = ?
            AND cart_id = ?
            AND status = 'active'
            AND julianday(expires_at) > julianday('now')
            AND extension_count = 0
            AND (
              julianday(expires_at) -
              julianday('now')
            ) * 86400 <= 30
        `)
        .bind(
          activeReservation.reservation_id,
          cartId
        )
        .run();


    /* =========================================
       HANDLE LOST RENEWAL RACE
    ========================================== */

    if (
      renewalResult.meta?.changes !== 1
    ) {
      const currentReservation =
        await env.OBA_DB
          .prepare(`
            SELECT
              reservation_id,
              cart_id,
              drop_id,
              status,
              expires_at,
              extension_count

            FROM cart_reservations

            WHERE
              reservation_id = ?
              AND cart_id = ?

            LIMIT 1
          `)
          .bind(
            activeReservation.reservation_id,
            cartId
          )
          .first();


      /*
       * A duplicate request may arrive just after
       * the first renewal succeeds.
       *
       * Do not perform another extension.
       */
      if (
        currentReservation &&
        currentReservation.status === 'active' &&
        Number(
          currentReservation.extension_count
        ) === 1
      ) {
        return Response.json(
          {
            ok: true,

            reservationRenewed: false,
            alreadyRenewed: true,

            reservation: {
              reservationId:
                currentReservation.reservation_id,

              cartId:
                currentReservation.cart_id,

              dropId:
                currentReservation.drop_id,

              status:
                currentReservation.status,

              expiresAt:
                currentReservation.expires_at,

              extensionCount:
                Number(
                  currentReservation.extension_count
                )
            }
          },
          {
            status: 200,
            headers: corsHeaders
          }
        );
      }


      /*
       * If it expired while the request was being
       * processed, mark the stale active row as
       * expired. Never revive it.
       */
      await env.OBA_DB
        .prepare(`
          UPDATE cart_reservations
          SET
            status = 'expired',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            reservation_id = ?
            AND status = 'active'
            AND julianday(expires_at) <= julianday('now')
        `)
        .bind(
          activeReservation.reservation_id
        )
        .run();


      return Response.json(
        {
          ok: false,

          error:
            'Your cookie hold could not be renewed.',

          reservationExpired: true
        },
        {
          status: 409,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       VERIFY RENEWAL
    ========================================== */

    const renewedReservation =
      await env.OBA_DB
        .prepare(`
          SELECT
            reservation_id,
            cart_id,
            drop_id,
            status,
            expires_at,
            extension_count

          FROM cart_reservations

          WHERE
            reservation_id = ?
            AND cart_id = ?
            AND status = 'active'
            AND julianday(expires_at) > julianday('now')

          LIMIT 1
        `)
        .bind(
          activeReservation.reservation_id,
          cartId
        )
        .first();


    if (
      !renewedReservation ||
      Number(
        renewedReservation.extension_count
      ) !== 1
    ) {
      console.error(
        'CRITICAL: Cart reservation renewal could not be verified.',
        {
          cartId,
          reservationId:
            activeReservation.reservation_id
        }
      );

      return Response.json(
        {
          ok: false,
          error:
            'The cookie reservation renewal could not be verified.'
        },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }


    return Response.json(
      {
        ok: true,

        reservationRenewed: true,
        alreadyRenewed: false,

        reservation: {
          reservationId:
            renewedReservation.reservation_id,

          cartId:
            renewedReservation.cart_id,

          dropId:
            renewedReservation.drop_id,

          status:
            renewedReservation.status,

          expiresAt:
            renewedReservation.expires_at,

          extensionCount:
            Number(
              renewedReservation.extension_count
            )
        }
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error(
      'Cart reservation renewal error:',
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          'Unable to renew your cookie reservation.'
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

/* =========================================
   CART RESERVATION RELEASE
========================================== */

if (url.pathname === '/cart-reservation/release') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      {
        ok: false,
        error: 'Method Not Allowed'
      },
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          'Request body must be valid JSON.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  /* =========================================
     CART ID VALIDATION
  ========================================== */

  const cartId =
    typeof body.cartId === 'string'
      ? body.cartId.trim()
      : '';

  const cartIdPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    !cartId ||
    !cartIdPattern.test(cartId)
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'Invalid cart ID.'
      },
      {
        status: 400,
        headers: corsHeaders
      }
    );
  }


  try {

    /* =========================================
       EXPIRE OLD RESERVATIONS
    ========================================== */

    await env.OBA_DB
      .prepare(`
        UPDATE cart_reservations
        SET
          status = 'expired',
          updated_at = CURRENT_TIMESTAMP
        WHERE
          status = 'active'
          AND julianday(expires_at) <= julianday('now')
      `)
      .run();


    /* =========================================
       FIND ACTIVE RESERVATION
    ========================================== */

    const activeReservation =
      await env.OBA_DB
        .prepare(`
          SELECT
            reservation_id,
            cart_id,
            drop_id,
            status,
            expires_at,
            extension_count
          FROM cart_reservations
          WHERE
            cart_id = ?
            AND status = 'active'
            AND julianday(expires_at) > julianday('now')
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .bind(cartId)
        .first();


    /*
     * Releasing an already expired/released cart
     * is intentionally safe and idempotent.
     *
     * There is nothing left for the server to
     * release, so return success rather than an
     * error.
     */
    if (!activeReservation) {
      return Response.json(
        {
          ok: true,
          reservationReleased: false,
          alreadyReleased: true
        },
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       RELEASE RESERVATION
    ========================================== */

    const releaseResult =
      await env.OBA_DB
        .prepare(`
          UPDATE cart_reservations
          SET
            status = 'released',
            updated_at = CURRENT_TIMESTAMP
          WHERE
            reservation_id = ?
            AND cart_id = ?
            AND status = 'active'
            AND julianday(expires_at) > julianday('now')
        `)
        .bind(
          activeReservation.reservation_id,
          cartId
        )
        .run();


    /*
     * If another request changed the reservation
     * between our SELECT and UPDATE, do not claim
     * that this request performed the release.
     *
     * The desired end state is still satisfied:
     * this cart no longer has that active hold.
     */
    if (releaseResult.meta?.changes !== 1) {

      const stillActive =
        await env.OBA_DB
          .prepare(`
            SELECT reservation_id
            FROM cart_reservations
            WHERE
              reservation_id = ?
              AND cart_id = ?
              AND status = 'active'
              AND julianday(expires_at) > julianday('now')
            LIMIT 1
          `)
          .bind(
            activeReservation.reservation_id,
            cartId
          )
          .first();

      if (stillActive) {
        console.error(
          'Cart reservation release did not complete.',
          {
            cartId,
            reservationId:
              activeReservation.reservation_id
          }
        );

        return Response.json(
          {
            ok: false,
            error:
              'The cookie reservation could not be released.'
          },
          {
            status: 500,
            headers: corsHeaders
          }
        );
      }

      return Response.json(
        {
          ok: true,
          reservationReleased: false,
          alreadyReleased: true
        },
        {
          status: 200,
          headers: corsHeaders
        }
      );
    }


    /* =========================================
       VERIFY RELEASE
    ========================================== */

    const releasedReservation =
      await env.OBA_DB
        .prepare(`
          SELECT
            reservation_id,
            cart_id,
            drop_id,
            status,
            expires_at,
            extension_count
          FROM cart_reservations
          WHERE reservation_id = ?
          LIMIT 1
        `)
        .bind(
          activeReservation.reservation_id
        )
        .first();

    if (
      !releasedReservation ||
      releasedReservation.status !== 'released'
    ) {
      console.error(
        'CRITICAL: Cart reservation release could not be verified.',
        {
          cartId,
          reservationId:
            activeReservation.reservation_id
        }
      );

      return Response.json(
        {
          ok: false,
          error:
            'The cookie reservation release could not be verified.'
        },
        {
          status: 500,
          headers: corsHeaders
        }
      );
    }


    return Response.json(
      {
        ok: true,

        reservationReleased: true,
        alreadyReleased: false,

        reservation: {
          reservationId:
            releasedReservation.reservation_id,

          cartId:
            releasedReservation.cart_id,

          dropId:
            releasedReservation.drop_id,

          status:
            releasedReservation.status,

          expiresAt:
            releasedReservation.expires_at,

          extensionCount:
            Number(
              releasedReservation.extension_count
            )
        }
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error) {
    console.error(
      'Cart reservation release error:',
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          'Unable to release your cookie reservation.'
      },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

    /* =========================================
       DELIVERY QUOTE
    ========================================== */

    if (url.pathname === '/delivery-quote') {

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }

      if (request.method !== 'POST') {
        return Response.json(
          {
            ok: false,
            error: 'Method Not Allowed'
          },
          {
            status: 405,
            headers: corsHeaders
          }
        );
      }

      let body;

      try {
        body = await request.json();
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error:
              'Request body must be valid JSON.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const address =
        typeof body.address === 'string'
          ? body.address.trim()
          : '';

      const city =
        typeof body.city === 'string'
          ? body.city.trim()
          : '';

      const zip =
        typeof body.zip === 'string'
          ? body.zip.trim()
          : '';

      if (
        address.length < 3 ||
        address.length > 200
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Please enter a valid delivery address.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      if (
        city.length < 2 ||
        city.length > 100
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Please enter a valid delivery city.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      if (!/^\d{5}$/.test(zip)) {
        return Response.json(
          {
            ok: false,
            error:
              'Please enter a valid 5-digit ZIP code.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const destination =
        `${address}, ${city}, CA ${zip}`;

      try {
        const routesResponse = await fetch(
          'https://routes.googleapis.com/directions/v2:computeRoutes',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',

              'X-Goog-Api-Key':
                env.GOOGLE_MAPS_API_KEY,

              'X-Goog-FieldMask':
                'routes.distanceMeters,routes.duration'
            },

            body: JSON.stringify({
              origin: {
                address: DELIVERY_ORIGIN
              },

              destination: {
                address: destination
              },

              travelMode: 'DRIVE',

              routingPreference:
                'TRAFFIC_UNAWARE'
            })
          }
        );

        const routesData =
          await routesResponse.json();

        if (!routesResponse.ok) {
          console.error(
            'Google Routes quote error:',
            routesData
          );

          return Response.json(
            {
              ok: false,
              error:
                'Unable to calculate delivery distance.'
            },
            {
              status: 502,
              headers: corsHeaders
            }
          );
        }

        const distanceMeters =
          routesData.routes?.[0]
            ?.distanceMeters;

        const duration =
          routesData.routes?.[0]
            ?.duration ?? null;

        if (
          !Number.isFinite(distanceMeters) ||
          distanceMeters < 0
        ) {
          return Response.json(
            {
              ok: false,
              error:
                'We could not find a driving route to that address.'
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        const distanceMiles =
          distanceMeters /
          METERS_PER_MILE;

        if (
          distanceMiles >
          MAX_DELIVERY_MILES
        ) {
          return Response.json(
            {
              ok: true,
              available: false,

              distanceMiles:
                Number(
                  distanceMiles.toFixed(2)
                ),

              maxDeliveryMiles:
                MAX_DELIVERY_MILES,

              deliveryFeeCents: null,

              message:
                `Local delivery is currently available within ${MAX_DELIVERY_MILES} driving miles.`
            },
            {
              headers: corsHeaders
            }
          );
        }

        let deliveryFeeCents =
          DELIVERY_BASE_FEE_CENTS;

        if (
          distanceMiles >
          DELIVERY_BASE_MILES
        ) {
          const additionalMiles =
            distanceMiles -
            DELIVERY_BASE_MILES;

          deliveryFeeCents +=
            Math.round(
              additionalMiles *
              DELIVERY_PER_MILE_CENTS
            );
        }

        return Response.json(
          {
            ok: true,
            available: true,

            distanceMiles:
              Number(
                distanceMiles.toFixed(2)
              ),

            distanceMeters,

            duration,

            deliveryFeeCents,

            deliveryFee:
              (
                deliveryFeeCents / 100
              ).toFixed(2),

            maxDeliveryMiles:
              MAX_DELIVERY_MILES
          },
          {
            headers: corsHeaders
          }
        );

      } catch (error) {
        console.error(
          'Delivery quote error:',
          error
        );

        return Response.json(
          {
            ok: false,
            error:
              'Unable to calculate delivery quote.'
          },
          {
            status: 502,
            headers: corsHeaders
          }
        );
      }
    }


    /* =========================================
       CHECKOUT
    ========================================== */

    if (url.pathname === '/checkout') {

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }

      if (request.method !== 'POST') {
        return Response.json(
          {
            ok: false,
            error: 'Method Not Allowed'
          },
          {
            status: 405,
            headers: corsHeaders
          }
        );
      }

      let body;

      try {
        body = await request.json();
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error:
              'Request body must be valid JSON.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

/* =========================================
   CART ID VALIDATION
========================================== */

const cartId =
  typeof body.cartId === 'string'
    ? body.cartId.trim()
    : '';

const cartIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (
  !cartId ||
  !cartIdPattern.test(cartId)
) {
  return Response.json(
    {
      ok: false,
      error:
        'Invalid cart ID. Please refresh the page and try again.'
    },
    {
      status: 400,
      headers: corsHeaders
    }
  );
}

      /* =========================================
         CHECKOUT ATTEMPT ID VALIDATION
      ========================================== */

      const checkoutAttemptId =
        typeof body.checkoutAttemptId === 'string'
          ? body.checkoutAttemptId.trim()
          : '';

      const checkoutAttemptIdPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (
        !checkoutAttemptId ||
        !checkoutAttemptIdPattern.test(
          checkoutAttemptId
        )
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Invalid checkout attempt ID. Please refresh the page and try again.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }


      /* =========================================
         SQUARE PAYMENT SOURCE VALIDATION
      ========================================== */

      if (
        typeof body.sourceId !== 'string' ||
        body.sourceId.trim() === ''
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Missing Square payment source.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }


      /* =========================================
         CUSTOMER VALIDATION
      ========================================== */

      if (
        !body.customer ||
        typeof body.customer !== 'object' ||
        Array.isArray(body.customer)
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Customer information is required.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const firstName =
        typeof body.customer.firstName === 'string'
          ? body.customer.firstName.trim()
          : '';

      const lastName =
        typeof body.customer.lastName === 'string'
          ? body.customer.lastName.trim()
          : '';

      const email =
        typeof body.customer.email === 'string'
          ? body.customer.email
              .trim()
              .toLowerCase()
          : '';

      const phone =
        typeof body.customer.phone === 'string'
          ? body.customer.phone.trim()
          : '';

      if (
        firstName.length < 1 ||
        firstName.length > 80
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Please enter a valid first name.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      if (
        lastName.length < 1 ||
        lastName.length > 80
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Please enter a valid last name.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        email.length > 254 ||
        !emailPattern.test(email)
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Please enter a valid email address.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const phoneDigits =
        phone.replace(/\D/g, '');

      if (
        phoneDigits.length < 10 ||
        phoneDigits.length > 15
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Please enter a valid phone number.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const squarePhone =
        phoneDigits.length === 10
          ? `+1${phoneDigits}`
          : `+${phoneDigits}`;

      const validatedCustomer = {
        firstName,
        lastName,
        email,
        phone: squarePhone
      };


      /* =========================================
         FULFILLMENT VALIDATION
      ========================================== */

      if (
        !body.fulfillment ||
        typeof body.fulfillment !== 'object' ||
        Array.isArray(body.fulfillment)
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Fulfillment information is required.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const fulfillmentType =
        typeof body.fulfillment.type === 'string'
          ? body.fulfillment.type
              .trim()
              .toLowerCase()
          : '';

      if (
        fulfillmentType !== 'pickup' &&
        fulfillmentType !== 'delivery'
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Please choose pickup or delivery.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const orderNotes =
        typeof body.orderNotes === 'string'
          ? body.orderNotes.trim()
          : '';

      if (orderNotes.length > 1000) {
        return Response.json(
          {
            ok: false,
            error:
              'Order notes are too long.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const allowedFulfillmentDates =
        new Set([
          '2026-09-18',
          '2026-09-19'
        ]);

      const allowedPickupTimes =
        new Set([
          '12:00',
          '12:30',
          '13:00',
          '13:30',
          '14:00',
          '14:30',
          '15:00',
          '15:30',
          '16:00',
          '16:30',
          '17:00'
        ]);

      const allowedDeliveryWindows =
        new Set([
          '12-14',
          '14-16',
          '16-18'
        ]);

      let validatedFulfillment;

      if (fulfillmentType === 'pickup') {
        const pickupDate =
          typeof body.fulfillment.date === 'string'
            ? body.fulfillment.date
                .trim()
                .toLowerCase()
            : '';

        const pickupTime =
          typeof body.fulfillment.time === 'string'
            ? body.fulfillment.time.trim()
            : '';

        if (!allowedFulfillmentDates.has(pickupDate)) {
          return Response.json(
            {
              ok: false,
              error:
                'Please choose a valid pickup date.'
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        if (!allowedPickupTimes.has(pickupTime)) {
          return Response.json(
            {
              ok: false,
              error:
                'Please choose a valid pickup time.'
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        validatedFulfillment = {
          type: 'pickup',
          date: pickupDate,
          time: pickupTime
        };
      }

      if (fulfillmentType === 'delivery') {
        const deliveryAddress =
          typeof body.fulfillment.address === 'string'
            ? body.fulfillment.address.trim()
            : '';

        const deliveryCity =
          typeof body.fulfillment.city === 'string'
            ? body.fulfillment.city.trim()
            : '';

        const deliveryZip =
          typeof body.fulfillment.zip === 'string'
            ? body.fulfillment.zip.trim()
            : '';

        const deliveryDate =
          typeof body.fulfillment.date === 'string'
            ? body.fulfillment.date
                .trim()
                .toLowerCase()
            : '';

        const deliveryWindow =
          typeof body.fulfillment.window === 'string'
            ? body.fulfillment.window.trim()
            : '';

        const deliveryNotes =
          typeof body.fulfillment.notes === 'string'
            ? body.fulfillment.notes.trim()
            : '';

        if (
          deliveryAddress.length < 3 ||
          deliveryAddress.length > 200
        ) {
          return Response.json(
            {
              ok: false,
              error:
                'Please enter a valid delivery address.'
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        if (
          deliveryCity.length < 2 ||
          deliveryCity.length > 100
        ) {
          return Response.json(
            {
              ok: false,
              error:
                'Please enter a valid delivery city.'
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        if (!/^\d{5}$/.test(deliveryZip)) {
          return Response.json(
            {
              ok: false,
              error:
                'Please enter a valid 5-digit ZIP code.'
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        if (!allowedFulfillmentDates.has(deliveryDate)) {
          return Response.json(
            {
              ok: false,
              error:
                'Please choose a valid delivery date.'
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        if (!allowedDeliveryWindows.has(deliveryWindow)) {
          return Response.json(
            {
              ok: false,
              error:
                'Please choose a valid delivery window.'
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        if (deliveryNotes.length > 1000) {
          return Response.json(
            {
              ok: false,
              error:
                'Delivery notes are too long.'
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        validatedFulfillment = {
          type: 'delivery',
          address: deliveryAddress,
          city: deliveryCity,
          zip: deliveryZip,
          date: deliveryDate,
          window: deliveryWindow,
          notes: deliveryNotes
        };
      }


      /* =========================================
         CART VALIDATION
      ========================================== */

      if (
        !Array.isArray(body.items) ||
        body.items.length === 0
      ) {
        return Response.json(
          {
            ok: false,
            error: 'Your cart is empty.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }

      const validatedItems = [];

      let subtotalCents = 0;

      for (const item of body.items) {
        const product =
          COOKIE_CATALOG[item.id];

        if (!product) {
          return Response.json(
            {
              ok: false,
              error:
                `Unknown product: ${item.id}`
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        if (
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 24
        ) {
          return Response.json(
            {
              ok: false,
              error:
                `Invalid quantity for ${product.name}.`
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        const lineTotalCents =
          product.priceCents *
          item.quantity;

        subtotalCents +=
          lineTotalCents;

        validatedItems.push({
          id: item.id,
          name: product.name,
          quantity: item.quantity,
          unitPriceCents:
            product.priceCents,
          lineTotalCents
        });
      }

/* =========================================
   AUTHORITATIVE CART RESERVATION
========================================== */

/*
 * Checkout must be backed by an active,
 * unexpired server-side inventory reservation.
 *
 * The browser cart is not authoritative.
 * cartId only identifies which reservation
 * this checkout is claiming.
 */
let checkoutReservation;

try {

  /*
   * First expire any stale active reservation
   * belonging to this cart.
   */
  await env.OBA_DB
    .prepare(`
      UPDATE cart_reservations
      SET
        status = 'expired',
        updated_at = CURRENT_TIMESTAMP
      WHERE
        cart_id = ?
        AND status = 'active'
        AND julianday(expires_at) <= julianday('now')
    `)
    .bind(cartId)
    .run();


  /*
   * Now require a currently active,
   * unexpired reservation for this cart.
   */
  checkoutReservation =
    await env.OBA_DB
      .prepare(`
        SELECT
          reservation_id,
          cart_id,
          drop_id,
          status,
          expires_at,
          extension_count,
          checkout_protection_used

        FROM cart_reservations

        WHERE
          cart_id = ?
          AND status = 'active'
          AND julianday(expires_at) > julianday('now')

        ORDER BY created_at DESC
        LIMIT 1
      `)
      .bind(cartId)
      .first();

} catch (databaseError) {

  console.error(
    'Checkout reservation lookup failed.',
    {
      cartId,

      error:
        databaseError instanceof Error
          ? databaseError.message
          : String(databaseError)
    }
  );

  return Response.json(
    {
      ok: false,
      error:
        'We could not verify your cookie reservation. Your card has not been charged. Please try again.'
    },
    {
      status: 503,
      headers: corsHeaders
    }
  );
}


if (!checkoutReservation) {

  console.warn(
    'Checkout rejected without an active reservation.',
    {
      cartId
    }
  );

  return Response.json(
    {
      ok: false,

      error:
        'Your cookie hold has expired. Please check availability before paying.',

      reservationExpired: true
    },
    {
      status: 409,
      headers: corsHeaders
    }
  );
}

/* =========================================
   VERIFY RESERVED ITEMS MATCH CHECKOUT
========================================== */

/*
 * An active reservation is not enough.
 *
 * The exact products and quantities being
 * purchased must match the authoritative
 * reservation in D1.
 *
 * This prevents a browser/client from holding
 * one cart and submitting a different cart
 * directly to /checkout.
 */
let reservedItems;

try {

  const reservedItemsResult =
    await env.OBA_DB
      .prepare(`
        SELECT
          i.product_id,
          i.product_name,
          ri.quantity

        FROM cart_reservation_items AS ri

        INNER JOIN inventory_items AS i
          ON i.inventory_item_id =
            ri.inventory_item_id

        WHERE
          ri.reservation_id = ?

        ORDER BY
          i.product_id
      `)
      .bind(
        checkoutReservation.reservation_id
      )
      .all();

  reservedItems =
    reservedItemsResult.results ?? [];

} catch (databaseError) {

  console.error(
    'Checkout reservation items could not be loaded.',
    {
      cartId,
      reservationId:
        checkoutReservation.reservation_id,

      error:
        databaseError instanceof Error
          ? databaseError.message
          : String(databaseError)
    }
  );

  return Response.json(
    {
      ok: false,
      error:
        'We could not verify the cookies in your reservation. Your card has not been charged. Please try again.'
    },
    {
      status: 503,
      headers: corsHeaders
    }
  );
}


/*
 * Convert both representations into:
 *
 * product_id -> quantity
 *
 * and require an exact match.
 */
const reservedQuantityByProduct =
  new Map(
    reservedItems.map(item => [
      item.product_id,
      Number(item.quantity)
    ])
  );

const checkoutQuantityByProduct =
  new Map();

for (const item of validatedItems) {

  /*
   * Multiple checkout lines for the same product
   * are combined here before comparison.
   */
  checkoutQuantityByProduct.set(
    item.id,
    (
      checkoutQuantityByProduct.get(item.id) ?? 0
    ) + item.quantity
  );
}


let reservationMatchesCheckout =
  reservedQuantityByProduct.size ===
  checkoutQuantityByProduct.size;

if (reservationMatchesCheckout) {

  for (
    const [productId, checkoutQuantity]
    of checkoutQuantityByProduct
  ) {

    if (
      reservedQuantityByProduct.get(productId) !==
      checkoutQuantity
    ) {
      reservationMatchesCheckout = false;
      break;
    }
  }
}


if (!reservationMatchesCheckout) {

  console.warn(
    'Checkout cart does not match authoritative reservation.',
    {
      cartId,
      reservationId:
        checkoutReservation.reservation_id
    }
  );

  return Response.json(
    {
      ok: false,

      error:
        'Your cart changed after your cookies were reserved. Please check availability again before paying.',

      reservationMismatch: true
    },
    {
      status: 409,
      headers: corsHeaders
    }
  );
}

      /* =========================================
         DELIVERY MINIMUM
      ========================================== */

      const totalCookieQuantity =
        validatedItems.reduce(
          (total, item) =>
            total + item.quantity,
          0
        );

      if (
        validatedFulfillment.type === 'delivery' &&
        totalCookieQuantity < 6
      ) {
        return Response.json(
          {
            ok: false,
            error:
              'Local delivery requires a minimum of 6 cookies.'
          },
          {
            status: 400,
            headers: corsHeaders
          }
        );
      }


      /* =========================================
         AUTHORITATIVE DELIVERY QUOTE
      ========================================== */

      let deliveryFeeCents = 0;
      let deliveryDistanceMiles = null;
      let deliveryDistanceMeters = null;
      let deliveryDuration = null;

      if (validatedFulfillment.type === 'delivery') {
        const destination =
          `${validatedFulfillment.address}, ` +
          `${validatedFulfillment.city}, CA ` +
          `${validatedFulfillment.zip}`;

        const routesResponse =
          await fetch(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                'X-Goog-Api-Key':
                  env.GOOGLE_MAPS_API_KEY,

                'X-Goog-FieldMask':
                  'routes.distanceMeters,routes.duration'
              },

              body: JSON.stringify({
                origin: {
                  address:
                    DELIVERY_ORIGIN
                },

                destination: {
                  address:
                    destination
                },

                travelMode:
                  'DRIVE',

                routingPreference:
                  'TRAFFIC_UNAWARE'
              })
            }
          );

        const routesData =
          await routesResponse.json();

        if (!routesResponse.ok) {
          console.error(
            'Google Routes checkout error:',
            routesData
          );

          return Response.json(
            {
              ok: false,
              error:
                'We could not verify this delivery address. Please try again.'
            },
            {
              status: 502,
              headers: corsHeaders
            }
          );
        }

        const route =
          routesData.routes?.[0];

        if (
          !route ||
          !Number.isFinite(
            route.distanceMeters
          ) ||
          route.distanceMeters < 0
        ) {
          return Response.json(
            {
              ok: false,
              error:
                'We could not find a driving route to this delivery address.'
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        deliveryDistanceMeters =
          route.distanceMeters;

        deliveryDuration =
          route.duration ?? null;

        deliveryDistanceMiles =
          deliveryDistanceMeters /
          METERS_PER_MILE;

        if (
          deliveryDistanceMiles >
          MAX_DELIVERY_MILES
        ) {
          return Response.json(
            {
              ok: false,

              error:
                `Local delivery is currently available within ${MAX_DELIVERY_MILES} driving miles.`
            },
            {
              status: 400,
              headers: corsHeaders
            }
          );
        }

        deliveryFeeCents =
          DELIVERY_BASE_FEE_CENTS;

        if (
          deliveryDistanceMiles >
          DELIVERY_BASE_MILES
        ) {
          const additionalMiles =
            deliveryDistanceMiles -
            DELIVERY_BASE_MILES;

          deliveryFeeCents +=
            Math.round(
              additionalMiles *
              DELIVERY_PER_MILE_CENTS
            );
        }
      }


      /* =========================================
         CHECKOUT REQUEST FINGERPRINT
      ========================================== */

      const fingerprintPayload = {
        customer: {
          firstName:
            validatedCustomer.firstName,
          lastName:
            validatedCustomer.lastName,
          email:
            validatedCustomer.email,
          phone:
            validatedCustomer.phone
        },

        fulfillment:
          validatedFulfillment,

        items:
          validatedItems
            .map(item => ({
              id: item.id,
              quantity: item.quantity
            }))
            .sort(
              (a, b) =>
                a.id.localeCompare(b.id)
            ),

        orderNotes,

        subtotalCents
      };

      const fingerprintInput =
        JSON.stringify(fingerprintPayload);

      const fingerprintBuffer =
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(
            fingerprintInput
          )
        );

      const requestFingerprint =
        Array.from(
          new Uint8Array(fingerprintBuffer)
        )
          .map(
            byte =>
              byte
                .toString(16)
                .padStart(2, '0')
          )
          .join('');


      /* =========================================
         GENERAL CHECKOUT ATTEMPT RECORD
      ========================================== */

      let existingCheckoutAttempt = null;

      try {
        const checkoutAttemptInsert =
          await env.OBA_DB
            .prepare(`
              INSERT OR IGNORE INTO checkout_attempts (
                checkout_attempt_id,
                fulfillment_type,
                payment_status,
                checkout_status,
                subtotal_cents,
                request_fingerprint
              )
              VALUES (?, ?, ?, ?, ?, ?)
            `)
            .bind(
              checkoutAttemptId,
              validatedFulfillment.type,
              'pending',
              'awaiting_order',
              subtotalCents,
              requestFingerprint
            )
            .run();

        if (
          checkoutAttemptInsert.meta?.changes === 0
        ) {
          existingCheckoutAttempt =
            await env.OBA_DB
              .prepare(`
                SELECT
                  checkout_attempt_id,
                  fulfillment_type,
                  square_order_id,
                  square_payment_id,
                  payment_status,
                  checkout_status,
                  subtotal_cents,
                  total_cents,
                  request_fingerprint
                FROM checkout_attempts
                WHERE checkout_attempt_id = ?
                LIMIT 1
              `)
              .bind(checkoutAttemptId)
              .first();

          if (!existingCheckoutAttempt) {
            throw new Error(
              'Checkout attempt was not created or found.'
            );
          }

          if (
            !existingCheckoutAttempt.request_fingerprint ||
            existingCheckoutAttempt.request_fingerprint !==
              requestFingerprint
          ) {
            console.warn(
              'Rejected changed checkout using existing attempt ID.',
              {
                checkoutAttemptId:
                  existingCheckoutAttempt.checkout_attempt_id,
                fulfillmentType:
                  existingCheckoutAttempt.fulfillment_type
              }
            );

            return Response.json(
              {
                ok: false,
                error:
                  'Your checkout details changed. Please start a new checkout attempt.',
                checkoutChanged: true
              },
              {
                status: 409,
                headers: corsHeaders
              }
            );
          }

          if (
            !Number.isInteger(
              existingCheckoutAttempt.subtotal_cents
            ) ||
            existingCheckoutAttempt.subtotal_cents !==
              subtotalCents
          ) {
            console.warn(
              'Rejected checkout with mismatched stored subtotal.',
              {
                checkoutAttemptId:
                  existingCheckoutAttempt.checkout_attempt_id,
                fulfillmentType:
                  existingCheckoutAttempt.fulfillment_type
              }
            );

            return Response.json(
              {
                ok: false,
                error:
                  'Your checkout total changed. Please start a new checkout attempt.',
                checkoutChanged: true
              },
              {
                status: 409,
                headers: corsHeaders
              }
            );
          }

          console.log(
            'Existing checkout attempt found.',
            {
              checkoutAttemptId:
                existingCheckoutAttempt.checkout_attempt_id,
              fulfillmentType:
                existingCheckoutAttempt.fulfillment_type,
              squareOrderId:
                existingCheckoutAttempt.square_order_id,
              squarePaymentId:
                existingCheckoutAttempt.square_payment_id,
              paymentStatus:
                existingCheckoutAttempt.payment_status,
              checkoutStatus:
                existingCheckoutAttempt.checkout_status
            }
          );
        }

      } catch (databaseError) {
        console.error(
          'Checkout attempt could not be prepared before Square.',
          {
            checkoutAttemptId,

            error:
              databaseError instanceof Error
                ? databaseError.message
                : String(databaseError)
          }
        );

        return Response.json(
          {
            ok: false,
            error:
              'We could not safely prepare your checkout. Your card has not been charged. Please try again.'
          },
          {
            status: 503,
            headers: corsHeaders
          }
        );
      }


      /* =========================================
         UNIFIED CHECKOUT RETRY GUARDS
      ========================================== */

      if (
        existingCheckoutAttempt &&
        existingCheckoutAttempt.payment_status ===
          'COMPLETED' &&
        existingCheckoutAttempt.square_order_id &&
        existingCheckoutAttempt.square_payment_id
      ) {
        console.log(
          'Returning existing completed checkout.',
          {
            checkoutAttemptId:
              existingCheckoutAttempt.checkout_attempt_id,
            fulfillmentType:
              existingCheckoutAttempt.fulfillment_type,
            squareOrderId:
              existingCheckoutAttempt.square_order_id,
            squarePaymentId:
              existingCheckoutAttempt.square_payment_id
          }
        );

        return Response.json(
          {
            ok: true,
            message:
              'This checkout was already completed.',
            items:
              validatedItems,
            subtotalCents,
            orderId:
              existingCheckoutAttempt.square_order_id,
            squareTotalCents:
              existingCheckoutAttempt.total_cents,
            paymentProcessed: true,
            paymentId:
              existingCheckoutAttempt.square_payment_id,
            paymentStatus:
              'COMPLETED',
            receiptUrl: null,
            recoveredCheckout: true
          },
          {
            headers: corsHeaders
          }
        );
      }

      if (
        existingCheckoutAttempt &&
        existingCheckoutAttempt.checkout_status ===
          'order_created' &&
        existingCheckoutAttempt.square_order_id &&
        !existingCheckoutAttempt.square_payment_id &&
        existingCheckoutAttempt.payment_status ===
          'pending'
      ) {
        console.warn(
          'Blocked retry for checkout with existing Square order.',
          {
            checkoutAttemptId:
              existingCheckoutAttempt.checkout_attempt_id,
            fulfillmentType:
              existingCheckoutAttempt.fulfillment_type,
            squareOrderId:
              existingCheckoutAttempt.square_order_id
          }
        );

        return Response.json(
          {
            ok: false,
            error:
              'Your order was started but the payment was not completed. Please wait a moment before trying again.',
            paymentPending: true,
            orderId:
              existingCheckoutAttempt.square_order_id
          },
          {
            status: 409,
            headers: corsHeaders
          }
        );
      }

      if (
        existingCheckoutAttempt &&
        (
          existingCheckoutAttempt.square_payment_id ||
          existingCheckoutAttempt.payment_status !==
            'pending' ||
          existingCheckoutAttempt.checkout_status ===
            'payment_updated'
        )
      ) {
        console.warn(
          'Blocked ambiguous checkout payment retry.',
          {
            checkoutAttemptId:
              existingCheckoutAttempt.checkout_attempt_id,
            fulfillmentType:
              existingCheckoutAttempt.fulfillment_type,
            squareOrderId:
              existingCheckoutAttempt.square_order_id,
            squarePaymentId:
              existingCheckoutAttempt.square_payment_id,
            paymentStatus:
              existingCheckoutAttempt.payment_status,
            checkoutStatus:
              existingCheckoutAttempt.checkout_status
          }
        );

        return Response.json(
          {
            ok: false,
            error:
              'This payment is still being confirmed. Please do not submit another payment yet.',
            paymentPending: true,
            orderId:
              existingCheckoutAttempt.square_order_id ??
              null
          },
          {
            status: 409,
            headers: corsHeaders
          }
        );
      }

/* =========================================
   BIND RESERVATION TO CHECKOUT ATTEMPT
========================================== */

/*
 * The authoritative inventory reservation must
 * now belong to this exact checkout attempt.
 *
 * Allowed states:
 *
 * 1. reservation has never been attached:
 *      checkout_attempt_id IS NULL
 *
 * 2. reservation is already attached to this
 *    same checkout attempt:
 *      checkout_attempt_id = checkoutAttemptId
 *
 * A reservation attached to a DIFFERENT checkout
 * attempt must never be reassigned here.
 */
try {

  const reservationCheckoutBind =
    await env.OBA_DB
      .prepare(`
        UPDATE cart_reservations

        SET
          checkout_attempt_id = ?,
          updated_at = CURRENT_TIMESTAMP

        WHERE
          reservation_id = ?
          AND cart_id = ?
          AND status = 'active'
          AND julianday(expires_at) > julianday('now')
          AND (
            checkout_attempt_id IS NULL
            OR checkout_attempt_id = ?
          )
      `)
      .bind(
        checkoutAttemptId,
        checkoutReservation.reservation_id,
        cartId,
        checkoutAttemptId
      )
      .run();


  /*
   * Do not rely solely on meta.changes.
   *
   * An idempotent retry may already have the
   * correct checkout_attempt_id stored.
   *
   * Read the authoritative row back and verify
   * the relationship explicitly.
   */
  const boundReservation =
    await env.OBA_DB
      .prepare(`
        SELECT
          reservation_id,
          cart_id,
          drop_id,
          status,
          expires_at,
          checkout_attempt_id,
          square_order_id

        FROM cart_reservations

        WHERE
          reservation_id = ?
          AND cart_id = ?

        LIMIT 1
      `)
      .bind(
        checkoutReservation.reservation_id,
        cartId
      )
      .first();


  if (
    !boundReservation ||
    boundReservation.status !== 'active' ||
    !boundReservation.expires_at ||
    Date.parse(
      boundReservation.expires_at
    ) <= Date.now() ||
    boundReservation.checkout_attempt_id !==
      checkoutAttemptId
  ) {

    console.warn(
      'Checkout reservation could not be bound to checkout attempt.',
      {
        cartId,

        reservationId:
          checkoutReservation.reservation_id,

        checkoutAttemptId,

        storedCheckoutAttemptId:
          boundReservation
            ?.checkout_attempt_id ??
          null
      }
    );

    return Response.json(
      {
        ok: false,

        error:
          'Your cookie reservation could not be secured for this checkout. Please check availability and try again.',

        reservationCheckoutConflict: true
      },
      {
        status: 409,
        headers: corsHeaders
      }
    );
  }


  /*
   * Keep the verified authoritative row available
   * for the later Square-order linkage step.
   */
  checkoutReservation =
    boundReservation;


} catch (databaseError) {

  console.error(
    'Checkout reservation could not be linked to checkout attempt.',
    {
      cartId,

      reservationId:
        checkoutReservation.reservation_id,

      checkoutAttemptId,

      error:
        databaseError instanceof Error
          ? databaseError.message
          : String(databaseError)
    }
  );

  return Response.json(
    {
      ok: false,

      error:
        'We could not safely secure your cookie reservation for checkout. Your card has not been charged. Please try again.'
    },
    {
      status: 503,
      headers: corsHeaders
    }
  );
}

      /* =========================================
         ATOMIC CHECKOUT OWNERSHIP
      ========================================== */

      try {
        const checkoutClaim =
          await env.OBA_DB
            .prepare(`
              UPDATE checkout_attempts
              SET
                checkout_status = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE
                checkout_attempt_id = ?
                AND checkout_status = ?
                AND payment_status = ?
                AND square_order_id IS NULL
                AND square_payment_id IS NULL
                AND request_fingerprint = ?
            `)
            .bind(
              'creating_order',
              checkoutAttemptId,
              'awaiting_order',
              'pending',
              requestFingerprint
            )
            .run();

        if (checkoutClaim.meta?.changes !== 1) {
          console.warn(
            'Checkout attempt is already being processed.',
            {
              checkoutAttemptId,
              fulfillmentType:
                validatedFulfillment.type
            }
          );

          return Response.json(
            {
              ok: false,
              error:
                'Your checkout is already being processed. Please wait a moment.',
              paymentPending: true
            },
            {
              status: 409,
              headers: corsHeaders
            }
          );
        }

      } catch (databaseError) {
        console.error(
          'Checkout attempt could not be claimed before Square.',
          {
            checkoutAttemptId,

            error:
              databaseError instanceof Error
                ? databaseError.message
                : String(databaseError)
          }
        );

        return Response.json(
          {
            ok: false,
            error:
              'We could not safely start your checkout. Your card has not been charged. Please try again.'
          },
          {
            status: 503,
            headers: corsHeaders
          }
        );
      }


      /* =========================================
         DELIVERY CHECKOUT RECOVERY RECORD
      ========================================== */

      let deliveryCheckoutId = null;
      let existingDeliveryRecovery = null;

      if (validatedFulfillment.type === 'delivery') {
        deliveryCheckoutId =
          checkoutAttemptId;

        try {
          const recoveryInsert =
            await env.OBA_DB
              .prepare(`
                INSERT OR IGNORE INTO delivery_checkout_recovery (
                  checkout_id,
                  recipient_first_name,
                  recipient_last_name,
                  email,
                  phone,
                  address,
                  city,
                  zip,
                  delivery_date,
                  delivery_window,
                  delivery_notes,
                  order_notes,
                  delivery_fee_cents,
                  distance_meters,
                  distance_miles,
                  route_duration,
                  payment_status,
                  recovery_status
                )
                VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
              `)
              .bind(
                deliveryCheckoutId,
                validatedCustomer.firstName,
                validatedCustomer.lastName,
                validatedCustomer.email,
                validatedCustomer.phone,
                validatedFulfillment.address,
                validatedFulfillment.city,
                validatedFulfillment.zip,
                validatedFulfillment.date,
                validatedFulfillment.window,
                validatedFulfillment.notes,
                orderNotes,
                deliveryFeeCents,
                deliveryDistanceMeters,
                Number(
                  deliveryDistanceMiles.toFixed(2)
                ),
                deliveryDuration,
                'pending',
                'awaiting_payment'
              )
              .run();

          if (recoveryInsert.meta?.changes === 0) {
            existingDeliveryRecovery =
              await env.OBA_DB
                .prepare(`
                  SELECT
                    checkout_id,
                    square_order_id,
                    square_payment_id,
                    payment_status,
                    recovery_status,
                    delivery_fee_cents,
                    distance_meters,
                    distance_miles,
                    route_duration
                  FROM delivery_checkout_recovery
                  WHERE checkout_id = ?
                  LIMIT 1
                `)
                .bind(deliveryCheckoutId)
                .first();

            if (!existingDeliveryRecovery) {
              throw new Error(
                'Recovery record was not created or found.'
              );
            }

            if (
              !Number.isInteger(
                existingDeliveryRecovery.delivery_fee_cents
              ) ||
              existingDeliveryRecovery.delivery_fee_cents < 0 ||
              !Number.isFinite(
                existingDeliveryRecovery.distance_meters
              ) ||
              existingDeliveryRecovery.distance_meters < 0 ||
              !Number.isFinite(
                existingDeliveryRecovery.distance_miles
              ) ||
              existingDeliveryRecovery.distance_miles < 0
            ) {
              throw new Error(
                'Existing delivery recovery snapshot is invalid.'
              );
            }

            deliveryFeeCents =
              existingDeliveryRecovery.delivery_fee_cents;

            deliveryDistanceMeters =
              existingDeliveryRecovery.distance_meters;

            deliveryDistanceMiles =
              existingDeliveryRecovery.distance_miles;

            deliveryDuration =
              existingDeliveryRecovery.route_duration;

            console.log(
              'Existing delivery checkout recovery record found.',
              {
                checkoutId:
                  existingDeliveryRecovery.checkout_id,
                squareOrderId:
                  existingDeliveryRecovery.square_order_id,
                squarePaymentId:
                  existingDeliveryRecovery.square_payment_id,
                paymentStatus:
                  existingDeliveryRecovery.payment_status,
                recoveryStatus:
                  existingDeliveryRecovery.recovery_status
              }
            );
          }

        } catch (databaseError) {
          try {
            await env.OBA_DB
              .prepare(`
                UPDATE checkout_attempts
                SET
                  checkout_status = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE
                  checkout_attempt_id = ?
                  AND checkout_status = ?
                  AND square_order_id IS NULL
                  AND square_payment_id IS NULL
              `)
              .bind(
                'awaiting_order',
                checkoutAttemptId,
                'creating_order'
              )
              .run();

          } catch (releaseError) {
            console.error(
              'Checkout ownership could not be released after delivery preparation failure.',
              {
                checkoutAttemptId,

                error:
                  releaseError instanceof Error
                    ? releaseError.message
                    : String(releaseError)
              }
            );
          }

          console.error(
            'Delivery recovery record could not be created before payment.',
            {
              checkoutId:
                deliveryCheckoutId,

              error:
                databaseError instanceof Error
                  ? databaseError.message
                  : String(databaseError)
            }
          );

          return Response.json(
            {
              ok: false,
              error:
                'We could not safely prepare this delivery order. Your card has not been charged. Please try again.'
            },
            {
              status: 503,
              headers: corsHeaders
            }
          );
        }
      }


      /* =========================================
         SQUARE PICKUP FULFILLMENT
      ========================================== */

      let squareFulfillments = [];

      if (validatedFulfillment.type === 'pickup') {
        const squarePickupAt =
          `${validatedFulfillment.date}T${validatedFulfillment.time}:00-07:00`;

        squareFulfillments = [
          {
            type: 'PICKUP',
            state: 'PROPOSED',

            pickup_details: {
              schedule_type:
                'SCHEDULED',

              pickup_at:
                squarePickupAt,

              recipient: {
                display_name:
                  `${validatedCustomer.firstName} ${validatedCustomer.lastName}`,

                email_address:
                  validatedCustomer.email,

                phone_number:
                  validatedCustomer.phone
              }
            }
          }
        ];
      }


      /* =========================================
         SQUARE ORDER + PAYMENT
      ========================================== */

      let squareCheckoutPhase =
        'creating_order_request';

      let activeSquareOrderId = null;

      try {

        const squareOrderResponse =
          await fetch(
            'https://connect.squareupsandbox.com/v2/orders',
            {
              method: 'POST',

              headers: {
                'Square-Version':
                  '2026-01-22',

                'Authorization':
                  `Bearer ${env.SQUARE_ACCESS_TOKEN}`,

                'Content-Type':
                  'application/json'
              },

              body: JSON.stringify({
                idempotency_key:
                  `order-${checkoutAttemptId}`,

                order: {
                  location_id:
                    env.SQUARE_LOCATION_ID,

                  line_items:
                    validatedItems.map(item => ({
                      name: item.name,

                      quantity:
                        String(item.quantity),

                      base_price_money: {
                        amount:
                          item.unitPriceCents,

                        currency: 'USD'
                      }
                    })),

                  ...(validatedFulfillment.type === 'delivery'
                    ? {
                        service_charges: [
                          {
                            name:
                              'Local Delivery',

                            scope:
                              'ORDER',

                            amount_money: {
                              amount:
                                deliveryFeeCents,

                              currency:
                                'USD'
                            },

                            calculation_phase:
                              'TOTAL_PHASE',

                            taxable:
                              false
                          }
                        ]
                      }
                    : {}),

                  ...(squareFulfillments.length > 0
                    ? {
                        fulfillments:
                          squareFulfillments
                      }
                    : {})
                }
              })
            }
          );

        const squareOrderData =
          await squareOrderResponse.json();

        if (!squareOrderResponse.ok) {
          try {
            await env.OBA_DB
              .prepare(`
                UPDATE checkout_attempts
                SET
                  checkout_status = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE
                  checkout_attempt_id = ?
                  AND checkout_status = ?
                  AND square_order_id IS NULL
                  AND square_payment_id IS NULL
              `)
              .bind(
                'awaiting_order',
                checkoutAttemptId,
                'creating_order'
              )
              .run();

          } catch (releaseError) {
            console.error(
              'Checkout ownership could not be released after Square order rejection.',
              {
                checkoutAttemptId,

                error:
                  releaseError instanceof Error
                    ? releaseError.message
                    : String(releaseError)
              }
            );
          }

          return Response.json(
            {
              ok: false,
              error:
                'Square could not create the order.',

              squareStatus:
                squareOrderResponse.status,

              squareErrors:
                squareOrderData.errors ?? []
            },
            {
              status: 502,
              headers: corsHeaders
            }
          );
        }

        const squareOrderId =
          squareOrderData.order?.id;

        const squareTotalCents =
          squareOrderData.order
            ?.total_money?.amount;

        if (
          !squareOrderId ||
          !Number.isInteger(
            squareTotalCents
          )
        ) {
          try {
            await env.OBA_DB
              .prepare(`
                UPDATE checkout_attempts
                SET
                  checkout_status = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE
                  checkout_attempt_id = ?
                  AND checkout_status = ?
                  AND square_payment_id IS NULL
              `)
              .bind(
                'order_response_ambiguous',
                checkoutAttemptId,
                'creating_order'
              )
              .run();

          } catch (databaseError) {
            console.error(
              'Checkout attempt could not be marked ambiguous after incomplete Square order response.',
              {
                checkoutAttemptId,

                error:
                  databaseError instanceof Error
                    ? databaseError.message
                    : String(databaseError)
              }
            );
          }

          return Response.json(
            {
              ok: false,
              error:
                'Square created the order but returned incomplete order data.'
            },
            {
              status: 502,
              headers: corsHeaders
            }
          );
        }

        activeSquareOrderId =
          squareOrderId;

        squareCheckoutPhase =
          'linking_order';


        /* =========================================
           ATTACH SQUARE ORDER TO CHECKOUT ATTEMPT
        ========================================== */

        try {
          const checkoutOrderUpdate =
            await env.OBA_DB
              .prepare(`
                UPDATE checkout_attempts
                SET
                  square_order_id = ?,
                  total_cents = ?,
                  checkout_status = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE
                  checkout_attempt_id = ?
                  AND checkout_status = ?
                  AND payment_status = ?
                  AND square_order_id IS NULL
                  AND square_payment_id IS NULL
                  AND request_fingerprint = ?
              `)
              .bind(
                squareOrderId,
                squareTotalCents,
                'order_created',
                checkoutAttemptId,
                'creating_order',
                'pending',
                requestFingerprint
              )
              .run();

          if (
            checkoutOrderUpdate.meta?.changes !== 1
          ) {
            throw new Error(
              'Checkout attempt order link was not updated.'
            );
          }

        } catch (databaseError) {
          console.error(
            'Square order was created but checkout attempt could not be linked before payment.',
            {
              checkoutAttemptId,
              squareOrderId,

              error:
                databaseError instanceof Error
                  ? databaseError.message
                  : String(databaseError)
            }
          );

          return Response.json(
            {
              ok: false,
              error:
                'We could not safely prepare your payment. Your card has not been charged. Please try again.',
              orderId:
                squareOrderId
            },
            {
              status: 503,
              headers: corsHeaders
            }
          );
        }

/* =========================================
   ATTACH SQUARE ORDER TO CART RESERVATION
========================================== */

/*
 * The reservation is already bound to this
 * checkoutAttemptId.
 *
 * Now permanently associate the same reservation
 * with the Square order that was created for
 * this checkout.
 *
 * This linkage is required before payment so a
 * confirmed Square payment can later convert the
 * exact reservation into sold inventory.
 */
try {

  await env.OBA_DB
    .prepare(`
      UPDATE cart_reservations

      SET
        square_order_id = ?,
        updated_at = CURRENT_TIMESTAMP

      WHERE
        reservation_id = ?
        AND cart_id = ?
        AND status = 'active'
        AND checkout_attempt_id = ?
        AND (
          square_order_id IS NULL
          OR square_order_id = ?
        )
    `)
    .bind(
      squareOrderId,
      checkoutReservation.reservation_id,
      cartId,
      checkoutAttemptId,
      squareOrderId
    )
    .run();


  /*
   * Read the reservation back rather than relying
   * only on meta.changes.
   *
   * This makes the operation idempotent if the
   * correct Square order was already attached.
   */
  const orderLinkedReservation =
    await env.OBA_DB
      .prepare(`
        SELECT
          reservation_id,
          cart_id,
          drop_id,
          status,
          checkout_attempt_id,
          square_order_id

        FROM cart_reservations

        WHERE
          reservation_id = ?
          AND cart_id = ?

        LIMIT 1
      `)
      .bind(
        checkoutReservation.reservation_id,
        cartId
      )
      .first();


  if (
    !orderLinkedReservation ||
    orderLinkedReservation.status !== 'active' ||
    orderLinkedReservation.checkout_attempt_id !==
      checkoutAttemptId ||
    orderLinkedReservation.square_order_id !==
      squareOrderId
  ) {
    throw new Error(
      'Cart reservation Square order link could not be verified.'
    );
  }


  /*
   * Keep the newest authoritative reservation
   * state available for the payment/conversion
   * stages that follow.
   */
  checkoutReservation =
    orderLinkedReservation;


} catch (databaseError) {

  console.error(
    'Square order was created but cart reservation could not be linked before payment.',
    {
      cartId,

      reservationId:
        checkoutReservation.reservation_id,

      checkoutAttemptId,

      squareOrderId,

      error:
        databaseError instanceof Error
          ? databaseError.message
          : String(databaseError)
    }
  );

  return Response.json(
    {
      ok: false,

      error:
        'We could not safely link your cookie reservation to the order. Your card has not been charged. Please try again.',

      orderId:
        squareOrderId
    },
    {
      status: 503,
      headers: corsHeaders
    }
  );
}

        /* =========================================
           ATTACH SQUARE ORDER TO RECOVERY RECORD
        ========================================== */

        if (
          validatedFulfillment.type === 'delivery' &&
          deliveryCheckoutId
        ) {
          try {
            const recoveryOrderUpdate =
              await env.OBA_DB
                .prepare(`
                  UPDATE delivery_checkout_recovery

                  SET
                    square_order_id = ?,
                    recovery_status = ?,
                    updated_at = CURRENT_TIMESTAMP

                  WHERE
                    checkout_id = ?
                    AND square_order_id IS NULL
                    AND square_payment_id IS NULL
                    AND payment_status = ?
                `)
                .bind(
                  squareOrderId,
                  'order_created',
                  deliveryCheckoutId,
                  'pending'
                )
                .run();

            if (
              recoveryOrderUpdate.meta?.changes !== 1
            ) {
              throw new Error(
                'Delivery recovery order link was not updated.'
              );
            }

          } catch (databaseError) {
            console.error(
              'Square order was created but recovery record could not be linked before payment.',
              {
                checkoutId:
                  deliveryCheckoutId,

                squareOrderId,

                error:
                  databaseError instanceof Error
                    ? databaseError.message
                    : String(databaseError)
              }
            );

            return Response.json(
              {
                ok: false,

                error:
                  'We could not safely prepare this delivery payment. Your card has not been charged. Please try again.',

                orderId:
                  squareOrderId
              },
              {
                status: 503,
                headers: corsHeaders
              }
            );
          }
        }


        /* =========================================
           CREATE SQUARE PAYMENT
        ========================================== */

        squareCheckoutPhase =
          'creating_payment_request';

        const squarePaymentResponse =
          await fetch(
            'https://connect.squareupsandbox.com/v2/payments',
            {
              method: 'POST',

              headers: {
                'Square-Version':
                  '2026-01-22',

                'Authorization':
                  `Bearer ${env.SQUARE_ACCESS_TOKEN}`,

                'Content-Type':
                  'application/json'
              },

              body: JSON.stringify({
                source_id:
                  body.sourceId.trim(),

                idempotency_key:
                  checkoutAttemptId,

                amount_money: {
                  amount:
                    squareTotalCents,

                  currency: 'USD'
                },

                order_id:
                  squareOrderId,

                location_id:
                  env.SQUARE_LOCATION_ID,

                buyer_email_address:
                  validatedCustomer.email,

                buyer_phone_number:
                  validatedCustomer.phone,

                autocomplete: true
              })
            }
          );

        const squarePaymentData =
          await squarePaymentResponse.json();

        if (!squarePaymentResponse.ok) {
          try {
            await env.OBA_DB
              .prepare(`
                UPDATE checkout_attempts
                SET
                  checkout_status = ?,
                  payment_status = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE
                  checkout_attempt_id = ?
                  AND checkout_status = ?
                  AND payment_status = ?
                  AND square_order_id = ?
                  AND square_payment_id IS NULL
                  AND request_fingerprint = ?
              `)
              .bind(
                'payment_rejected',
                'FAILED',
                checkoutAttemptId,
                'order_created',
                'pending',
                squareOrderId,
                requestFingerprint
              )
              .run();

          } catch (databaseError) {
            console.error(
              'Checkout attempt could not be marked after Square payment rejection.',
              {
                checkoutAttemptId,
                squareOrderId,

                error:
                  databaseError instanceof Error
                    ? databaseError.message
                    : String(databaseError)
              }
            );
          }

          return Response.json(
            {
              ok: false,

              error:
                'Square could not process the payment.',

              paymentStatus:
                'FAILED',

              retryableWithNewAttempt:
                true,

              orderId:
                squareOrderId,

              squareStatus:
                squarePaymentResponse.status,

              squareErrors:
                squarePaymentData.errors ?? []
            },
            {
              status: 502,
              headers: corsHeaders
            }
          );
        }


        /* =========================================
           ATTACH SQUARE PAYMENT TO CHECKOUT ATTEMPT
        ========================================== */

        const squarePaymentId =
          squarePaymentData.payment?.id ?? null;

        const squarePaymentStatus =
          squarePaymentData.payment?.status ?? null;

        if (
          !squarePaymentId ||
          !squarePaymentStatus
        ) {
          try {
            await env.OBA_DB
              .prepare(`
                UPDATE checkout_attempts
                SET
                  checkout_status = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE
                  checkout_attempt_id = ?
                  AND checkout_status = ?
                  AND payment_status = ?
                  AND square_order_id = ?
                  AND square_payment_id IS NULL
                  AND request_fingerprint = ?
              `)
              .bind(
                'payment_response_ambiguous',
                checkoutAttemptId,
                'order_created',
                'pending',
                squareOrderId,
                requestFingerprint
              )
              .run();

          } catch (databaseError) {
            console.error(
              'Checkout attempt could not be marked ambiguous after incomplete Square payment response.',
              {
                checkoutAttemptId,
                squareOrderId,

                error:
                  databaseError instanceof Error
                    ? databaseError.message
                    : String(databaseError)
              }
            );
          }

          return Response.json(
            {
              ok: false,
              error:
                'Your payment was submitted but its final status could not be confirmed. Please do not submit another payment yet.',
              paymentPending: true,
              orderId:
                squareOrderId
            },
            {
              status: 409,
              headers: corsHeaders
            }
          );
        }

        squareCheckoutPhase =
          'payment_received';

        try {
          const checkoutPaymentUpdate =
            await env.OBA_DB
              .prepare(`
                UPDATE checkout_attempts
                SET
                  square_payment_id = ?,
                  payment_status = ?,
                  checkout_status = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE
                  checkout_attempt_id = ?
                  AND checkout_status = ?
                  AND payment_status = ?
                  AND square_order_id = ?
                  AND square_payment_id IS NULL
                  AND request_fingerprint = ?
              `)
              .bind(
                squarePaymentId,
                squarePaymentStatus,
                squarePaymentStatus === 'COMPLETED'
                  ? 'completed'
                  : 'payment_updated',
                checkoutAttemptId,
                'order_created',
                'pending',
                squareOrderId,
                requestFingerprint
              )
              .run();

          if (
            checkoutPaymentUpdate.meta?.changes !== 1
          ) {
            throw new Error(
              'Checkout attempt payment state was not updated.'
            );
          }

        } catch (databaseError) {
          console.error(
            'CRITICAL: Square payment succeeded but checkout attempt could not be updated.',
            {
              checkoutAttemptId,
              squareOrderId,
              squarePaymentId,
              paymentStatus:
                squarePaymentStatus,

              error:
                databaseError instanceof Error
                  ? databaseError.message
                  : String(databaseError)
            }
          );
        }

/* =========================================
   CONVERT PAID RESERVATION TO SOLD INVENTORY
========================================== */

/*
 * Inventory becomes permanently sold ONLY after
 * Square has confirmed the payment COMPLETED.
 *
 * The reservation itself is the idempotency guard:
 *
 * active    -> inventory has not been committed
 * converted -> inventory was already committed
 *
 * The inventory increments and reservation status
 * change execute in one D1 batch.
 */
if (squarePaymentStatus === 'COMPLETED') {

  try {

    /*
     * Read the exact reservation linked to this
     * checkout attempt and Square order.
     */
    const paidReservation =
      await env.OBA_DB
        .prepare(`
          SELECT
            reservation_id,
            cart_id,
            drop_id,
            status,
            checkout_attempt_id,
            square_order_id

          FROM cart_reservations

          WHERE
            reservation_id = ?
            AND cart_id = ?
            AND checkout_attempt_id = ?
            AND square_order_id = ?

          LIMIT 1
        `)
        .bind(
          checkoutReservation.reservation_id,
          cartId,
          checkoutAttemptId,
          squareOrderId
        )
        .first();


    if (!paidReservation) {
      throw new Error(
        'Paid checkout reservation could not be found.'
      );
    }


    /*
     * Idempotency:
     *
     * If this exact reservation was already
     * converted, do not increment quantity_sold
     * again.
     */
    if (paidReservation.status !== 'converted') {

      if (paidReservation.status !== 'active') {
        throw new Error(
          `Paid reservation has unexpected status: ${paidReservation.status}`
        );
      }


      /*
       * Load the authoritative quantities that
       * were held by this reservation.
       */
      const paidItemsResult =
        await env.OBA_DB
          .prepare(`
            SELECT
              ri.inventory_item_id,
              ri.quantity

            FROM cart_reservation_items AS ri

            WHERE
              ri.reservation_id = ?

            ORDER BY
              ri.inventory_item_id
          `)
          .bind(
            paidReservation.reservation_id
          )
          .all();

      const paidItems =
        paidItemsResult.results ?? [];

      if (paidItems.length === 0) {
        throw new Error(
          'Paid reservation contains no inventory items.'
        );
      }


            /*
       * Build one atomic D1 batch:
       *
       * 1. Increment quantity_sold for every
       *    reserved inventory item.
       *
       * 2. Convert the reservation from active
       *    to converted.
       *
       * If any statement fails, the batch rolls
       * back rather than leaving a partial sale.
       */
      const conversionStatements = [];

      for (const paidItem of paidItems) {

        const quantity =
          Number(paidItem.quantity);

        const inventoryItemId =
          Number(
            paidItem.inventory_item_id
          );

        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          !Number.isInteger(inventoryItemId)
        ) {
          throw new Error(
            'Paid reservation contains invalid inventory data.'
          );
        }

        conversionStatements.push(
          env.OBA_DB
            .prepare(`
              UPDATE inventory_items

              SET
                quantity_sold =
                  quantity_sold + ?,

                updated_at =
                  CURRENT_TIMESTAMP

              WHERE
                inventory_item_id = ?
                AND drop_id = ?
            `)
            .bind(
              quantity,
              inventoryItemId,
              paidReservation.drop_id
            )
        );
      }


      /*
       * The final statement changes the
       * reservation state.
       *
       * status = 'active' is the one-way
       * conversion guard.
       */
      conversionStatements.push(
        env.OBA_DB
          .prepare(`
            UPDATE cart_reservations

            SET
              status = 'converted',
              updated_at = CURRENT_TIMESTAMP

            WHERE
              reservation_id = ?
              AND cart_id = ?
              AND checkout_attempt_id = ?
              AND square_order_id = ?
              AND status = 'active'
          `)
          .bind(
            paidReservation.reservation_id,
            cartId,
            checkoutAttemptId,
            squareOrderId
          )
      );


            await env.OBA_DB.batch(
        conversionStatements
      );
    }


    /*
     * Verify the authoritative end state.
     *
     * This also makes a repeated execution safe:
     * a previously converted reservation reaches
     * this same verified state without adding sold
     * inventory again.
     */
    const convertedReservation =
      await env.OBA_DB
        .prepare(`
          SELECT
            reservation_id,
            status,
            checkout_attempt_id,
            square_order_id

          FROM cart_reservations

          WHERE
            reservation_id = ?
            AND cart_id = ?
            AND checkout_attempt_id = ?
            AND square_order_id = ?

          LIMIT 1
        `)
        .bind(
          checkoutReservation.reservation_id,
          cartId,
          checkoutAttemptId,
          squareOrderId
        )
        .first();


    if (
      !convertedReservation ||
      convertedReservation.status !== 'converted'
    ) {
      throw new Error(
        'Paid reservation conversion could not be verified.'
      );
    }


    checkoutReservation =
      convertedReservation;


  } catch (databaseError) {

    /*
     * IMPORTANT:
     *
     * Square has already confirmed payment.
     * We therefore must NOT tell the customer
     * that their payment failed or encourage
     * another payment.
     *
     * Record this as a critical reconciliation
     * problem instead.
     */
    console.error(
      'CRITICAL: Square payment completed but inventory reservation could not be converted.',
      {
        cartId,

        reservationId:
          checkoutReservation.reservation_id,

        checkoutAttemptId,

        squareOrderId,

        squarePaymentId,

        error:
          databaseError instanceof Error
            ? databaseError.message
            : String(databaseError)
      }
    );
  }
}

        /* =========================================
           ATTACH SQUARE PAYMENT TO RECOVERY RECORD
        ========================================== */

        if (
          validatedFulfillment.type === 'delivery' &&
          deliveryCheckoutId
        ) {
          try {
            const recoveryPaymentUpdate =
              await env.OBA_DB
                .prepare(`
                  UPDATE delivery_checkout_recovery

                  SET
                    square_payment_id = ?,
                    payment_status = ?,
                    recovery_status = ?,
                    updated_at = CURRENT_TIMESTAMP

                  WHERE
                    checkout_id = ?
                    AND square_order_id = ?
                    AND square_payment_id IS NULL
                    AND payment_status = ?
                    AND recovery_status = ?
                `)
                .bind(
                  squarePaymentId,
                  squarePaymentStatus,
                  squarePaymentStatus === 'COMPLETED'
                    ? 'payment_completed'
                    : 'payment_updated',
                  deliveryCheckoutId,
                  squareOrderId,
                  'pending',
                  'order_created'
                )
                .run();

            if (
              recoveryPaymentUpdate.meta?.changes !== 1
            ) {
              throw new Error(
                'Delivery recovery payment link was not updated.'
              );
            }

          } catch (databaseError) {
            console.error(
              'CRITICAL: Square payment succeeded but recovery record could not be updated with payment data.',
              {
                checkoutId:
                  deliveryCheckoutId,

                squareOrderId,

                squarePaymentId,

                paymentStatus:
                  squarePaymentStatus,

                error:
                  databaseError instanceof Error
                    ? databaseError.message
                    : String(databaseError)
              }
            );
          }
        }


        /* =========================================
           SAVE DELIVERY ORDER TO OBA DATABASE
        ========================================== */

        if (validatedFulfillment.type === 'delivery') {
          try {
            await env.OBA_DB
              .prepare(`
                INSERT OR IGNORE INTO delivery_orders (
                  square_order_id,
                  square_payment_id,
                  recipient_first_name,
                  recipient_last_name,
                  email,
                  phone,
                  address,
                  city,
                  zip,
                  delivery_date,
                  delivery_window,
                  delivery_notes,
                  order_notes,
                  delivery_fee_cents,
                  distance_meters,
                  distance_miles,
                  route_duration,
                  status
                )
                VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
              `)
              .bind(
                squareOrderId,
                squarePaymentId,
                validatedCustomer.firstName,
                validatedCustomer.lastName,
                validatedCustomer.email,
                validatedCustomer.phone,
                validatedFulfillment.address,
                validatedFulfillment.city,
                validatedFulfillment.zip,
                validatedFulfillment.date,
                validatedFulfillment.window,
                validatedFulfillment.notes,
                orderNotes,
                deliveryFeeCents,
                deliveryDistanceMeters,
                Number(
                  deliveryDistanceMiles.toFixed(2)
                ),
                deliveryDuration,
                'pending'
              )
              .run();

          } catch (databaseError) {
            console.error(
              'CRITICAL: Square payment succeeded but delivery order could not be saved to D1.',
              {
                squareOrderId,
                squarePaymentId,
                error:
                  databaseError instanceof Error
                    ? databaseError.message
                    : String(databaseError)
              }
            );
          }
        }


        /* =========================================
           SUCCESS
        ========================================== */

        return Response.json(
          {
            ok: true,

            message:
              'Square Sandbox payment completed.',

            items:
              validatedItems,

            subtotalCents,

            orderId:
              squareOrderId,

            squareTotalCents,

            paymentProcessed: true,

            paymentId:
              squarePaymentId,

            paymentStatus:
              squarePaymentStatus,

            receiptUrl:
              squarePaymentData.payment
                ?.receipt_url ??
              null
          },
          {
            headers: corsHeaders
          }
        );

      } catch (error) {
        console.error(
          'Square checkout error:',
          {
            checkoutAttemptId,
            squareCheckoutPhase,
            squareOrderId:
              activeSquareOrderId,
            error:
              error instanceof Error
                ? error.message
                : String(error)
          }
        );

        try {
          if (
            squareCheckoutPhase ===
              'creating_order_request'
          ) {
            await env.OBA_DB
              .prepare(`
                UPDATE checkout_attempts
                SET
                  checkout_status = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE
                  checkout_attempt_id = ?
                  AND checkout_status = ?
                  AND payment_status = ?
                  AND square_order_id IS NULL
                  AND square_payment_id IS NULL
                  AND request_fingerprint = ?
              `)
              .bind(
                'order_request_ambiguous',
                checkoutAttemptId,
                'creating_order',
                'pending',
                requestFingerprint
              )
              .run();

          } else if (
            squareCheckoutPhase ===
              'creating_payment_request' &&
            activeSquareOrderId
          ) {
            await env.OBA_DB
              .prepare(`
                UPDATE checkout_attempts
                SET
                  checkout_status = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE
                  checkout_attempt_id = ?
                  AND checkout_status = ?
                  AND payment_status = ?
                  AND square_order_id = ?
                  AND square_payment_id IS NULL
                  AND request_fingerprint = ?
              `)
              .bind(
                'payment_request_ambiguous',
                checkoutAttemptId,
                'order_created',
                'pending',
                activeSquareOrderId,
                requestFingerprint
              )
              .run();
          }

        } catch (databaseError) {
          console.error(
            'Checkout attempt could not be marked ambiguous after Square exception.',
            {
              checkoutAttemptId,
              squareCheckoutPhase,
              squareOrderId:
                activeSquareOrderId,
              error:
                databaseError instanceof Error
                  ? databaseError.message
                  : String(databaseError)
            }
          );
        }

        const paymentMayBePending =
          squareCheckoutPhase ===
            'creating_payment_request' ||
          squareCheckoutPhase ===
            'payment_received';

        return Response.json(
          {
            ok: false,
            error:
              paymentMayBePending
                ? 'Your payment may still be processing. Please do not submit another payment yet.'
                : 'We could not confirm the Square order result. Please do not submit this checkout again yet.',
            paymentPending:
              paymentMayBePending,
            orderId:
              activeSquareOrderId
          },
          {
            status: 409,
            headers: corsHeaders
          }
        );
      }
    }


    /* =========================================
       NOT FOUND
    ========================================== */

    return Response.json(
      {
        ok: false,
        error: 'Not Found'
      },
      {
        status: 404
      }
    );
  }
};
