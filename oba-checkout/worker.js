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

const CREW_PASSWORD_RESET_RATE_WINDOW_MINUTES = 30;
const CREW_PASSWORD_RESET_MAX_EMAIL_REQUESTS = 3;
const CREW_PASSWORD_RESET_MAX_IP_REQUESTS = 10;
const CREW_PASSWORD_RESET_ATTEMPT_RETENTION_DAYS = 7;
const CREW_PASSWORD_RESET_RECORD_RETENTION_DAYS = 7;

const CREW_RECOVERY_CODE_COUNT = 8;
const CREW_RECOVERY_CODE_BYTES = 16;
const CREW_RECOVERY_RATE_WINDOW_MINUTES = 30;
const CREW_RECOVERY_MAX_EMAIL_ATTEMPTS = 5;
const CREW_RECOVERY_MAX_IP_ATTEMPTS = 12;
const CREW_RECOVERY_ATTEMPT_RETENTION_DAYS = 7;

const CREW_ALLOWED_ORIGIN =
  'https://ollysbakedassortments.com';

const CREW_ORIGIN_PROTECTED_PATHS =
  new Set([
    '/inventory/baked',
    '/inventory/adjust',
    '/inventory/location',
    '/inventory/transfer',
    '/crew/reviews/import',
    '/crew/reviews/save',
    '/crew/reviews/access',
    '/crew/reviews/action',
    '/crew/reviews/permanent-delete'
  ]);

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
const CREW_INVITATION_TTL_DAYS = 7;

const CREW_RECOVERY_EMAIL_VERIFICATION_BYTES = 32;
const CREW_RECOVERY_EMAIL_VERIFICATION_TTL_MINUTES = 30;

function createCrewRecoveryEmailVerificationToken() {
  const tokenBytes =
    crypto.getRandomValues(
      new Uint8Array(
        CREW_RECOVERY_EMAIL_VERIFICATION_BYTES
      )
    );

  return bytesToBase64Url(tokenBytes);
}

async function hashCrewRecoveryEmailVerificationToken(token) {
  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(token)
    );

  return bytesToBase64Url(
    new Uint8Array(digest)
  );
}

function getCrewRecoveryEmailVerificationExpiry() {
  return new Date(
    Date.now() +
      CREW_RECOVERY_EMAIL_VERIFICATION_TTL_MINUTES *
        60 *
        1000
  ).toISOString();
}

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
   CREW RECOVERY CODE HELPERS
========================================= */

const CREW_RECOVERY_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createCrewRecoveryCode() {
  const randomBytes =
    crypto.getRandomValues(
      new Uint8Array(CREW_RECOVERY_CODE_BYTES)
    );

  let code = '';

  for (let index = 0; index < 16; index += 1) {
    code +=
      CREW_RECOVERY_ALPHABET[
        randomBytes[index % randomBytes.length] %
          CREW_RECOVERY_ALPHABET.length
      ];
  }

  return `OBA-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
}

function normalizeCrewRecoveryCode(value) {
  const compact =
    String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

  if (compact.startsWith('OBA')) {
    return compact.slice(3);
  }

  return compact;
}

async function hashCrewRecoveryCode(value) {
  const normalized =
    normalizeCrewRecoveryCode(value);

  if (!normalized) {
    return null;
  }

  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(normalized)
    );

  return bytesToBase64Url(
    new Uint8Array(digest)
  );
}

/* =========================================
   OBA EMAIL SERVICE — GMAIL API
========================================= */

function sanitizeEmailHeader(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function encodeBase64UrlUtf8(value) {
  const bytes =
    new TextEncoder().encode(value);

  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function getOBAGmailAccessToken(env) {
  const clientId = env.OBA_GMAIL_CLIENT_ID;
  const clientSecret = env.OBA_GMAIL_CLIENT_SECRET;
  const refreshToken = env.OBA_GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail API credentials are not configured.');
  }

  const tokenResponse = await fetch(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    }
  );

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || typeof tokenData?.access_token !== 'string') {
    console.error('Gmail OAuth token exchange failed.', {
      status: tokenResponse.status,
      code: tokenData?.error ?? null
    });
    throw new Error('Unable to authenticate with Gmail.');
  }

  return tokenData.access_token;
}

function encodeMimeHeaderUtf8(value) {
  const text = sanitizeEmailHeader(value);
  if (!/[^\x20-\x7E]/.test(text)) return text;
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function buildOBAEmailMessage({
  fromEmail,
  fromName,
  to,
  subject,
  text,
  html,
  replyTo
}) {
  const safeFromEmail = sanitizeEmailHeader(fromEmail);
  const safeFromName = sanitizeEmailHeader(fromName);
  const safeTo = sanitizeEmailHeader(to);
  const safeSubject = encodeMimeHeaderUtf8(subject);
  const safeReplyTo = sanitizeEmailHeader(replyTo);
  const boundary = `oba_${crypto.randomUUID()}`;

  const headers = [
    `From: ${safeFromName} <${safeFromEmail}>`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0'
  ];

  if (safeReplyTo) {
    headers.push(`Reply-To: ${safeReplyTo}`);
  }

  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  return [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    ''
  ].join('\r\n');
}

async function sendOBAGmailEmail(env, messageOptions) {
  const accessToken = await getOBAGmailAccessToken(env);
  const message = buildOBAEmailMessage(messageOptions);

  const gmailResponse = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: encodeBase64UrlUtf8(message)
      })
    }
  );

  const gmailData = await gmailResponse.json();

  if (!gmailResponse.ok) {
    console.error('OBA Gmail provider send failed.', {
      status: gmailResponse.status,
      code: gmailData?.error?.code ?? null
    });
    throw new Error('Unable to send OBA email.');
  }

  return {
    provider: 'gmail',
    messageId: gmailData?.id ?? null,
    threadId: gmailData?.threadId ?? null
  };
}

async function sendOBAEmail(
  env,
  {
    to,
    subject,
    text,
    html,
    replyTo = null
  }
) {
  const provider = String(env.OBA_MAIL_PROVIDER || 'gmail')
    .trim()
    .toLowerCase();
  const fromEmail = sanitizeEmailHeader(env.OBA_EMAIL_FROM);
  const fromName = sanitizeEmailHeader(env.OBA_EMAIL_FROM_NAME || 'OBA Cookies');
  const safeTo = sanitizeEmailHeader(to);
  const configuredReplyTo = sanitizeEmailHeader(
    replyTo || env.OBA_EMAIL_REPLY_TO || fromEmail
  );

  if (!fromEmail) {
    throw new Error('OBA email sender is not configured.');
  }

  if (!safeTo) {
    throw new Error('OBA email recipient is not configured.');
  }

  const messageOptions = {
    fromEmail,
    fromName,
    to: safeTo,
    subject,
    text,
    html,
    replyTo: configuredReplyTo
  };

  switch (provider) {
    case 'gmail':
      return sendOBAGmailEmail(env, messageOptions);

    default:
      console.error('Unsupported OBA mail provider.', { provider });
      throw new Error('OBA mail provider is not configured.');
  }
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


async function hashCrewSecurityValue(value) {
  const normalized =
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : '';

  if (!normalized) {
    return null;
  }

  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(normalized)
    );

  return bytesToBase64Url(
    new Uint8Array(digest)
  );
}


function requiresStrictCrewOrigin(
  pathname,
  method
) {
  if (method !== 'POST') {
    return false;
  }

  return (
    pathname.startsWith('/crew/') ||
    CREW_ORIGIN_PROTECTED_PATHS.has(pathname)
  );
}


function hasAllowedCrewOrigin(request) {
  return (
    request.headers.get('Origin') ===
    CREW_ALLOWED_ORIGIN
  );
}


async function recordCrewSecurityEvent(
  env,
  {
    eventType,
    crewUserId = null,
    resetId = null,
    ipHash = null,
    details = null
  }
) {
  try {
    await env.OBA_DB
      .prepare(`
        INSERT INTO crew_security_events (
          event_id,
          event_type,
          crew_user_id,
          reset_id,
          ip_hash,
          details_json
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        eventType,
        crewUserId,
        resetId,
        ipHash,
        details
          ? JSON.stringify(details)
          : null
      )
      .run();
  } catch (error) {
    console.error(
      'Crew security audit write failed:',
      {
        eventType,
        message:
          error instanceof Error
            ? error.message
            : 'Unknown audit error'
      }
    );
  }
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


/* =========================================
   CREW PERMISSION HELPERS
========================================= */

async function hasCrewPermission(
  env,
  crewSession,
  permissionKey
) {
  if (
    !crewSession ||
    !Number.isInteger(
      Number(crewSession.crewUserId)
    ) ||
    typeof permissionKey !== 'string' ||
    !permissionKey.trim()
  ) {
    return false;
  }

  const crewUserId =
    Number(crewSession.crewUserId);

  const role =
    String(crewSession.role || '')
      .trim()
      .toLowerCase();

  const normalizedPermissionKey =
    permissionKey.trim();


  /* =========================================
     OWNER HAS FULL CREW ACCESS
  ========================================== */

  if (role === 'owner') {
    return true;
  }


  /* =========================================
     REQUIRE SUPPORTED STAFF ROLE
  ========================================== */

  if (
    role !== 'crew' &&
    role !== 'manager'
  ) {
    return false;
  }


  /* =========================================
     USER-SPECIFIC OVERRIDE
  ========================================== */

  const permissionOverride =
    await env.OBA_DB
      .prepare(`
        SELECT
          override_value

        FROM crew_permission_overrides

        WHERE
          crew_user_id = ?
          AND permission_key = ?

        LIMIT 1
      `)
      .bind(
        crewUserId,
        normalizedPermissionKey
      )
      .first();

  if (permissionOverride) {
    return (
      permissionOverride.override_value ===
      'allow'
    );
  }


  /* =========================================
     ROLE DEFAULT
  ========================================== */

  const rolePermission =
    await env.OBA_DB
      .prepare(`
        SELECT
          allowed

        FROM crew_role_permissions

        WHERE
          role = ?
          AND permission_key = ?

        LIMIT 1
      `)
      .bind(
        role,
        normalizedPermissionKey
      )
      .first();

  return (
    rolePermission !== null &&
    Number(rolePermission.allowed) === 1
  );
}


async function requireCrewPermission(
  env,
  crewSession,
  permissionKey
) {
  const allowed =
    await hasCrewPermission(
      env,
      crewSession,
      permissionKey
    );

  if (allowed) {
    return null;
  }

  return Response.json(
    {
      ok: false,
      authorized: false,
      error:
        'You do not have permission to perform this action.'
    },
    {
      status: 403,
      headers: {
        'Access-Control-Allow-Origin':
          CREW_ALLOWED_ORIGIN,

        'Access-Control-Allow-Credentials':
          'true',

        'Cache-Control':
          'no-store'
      }
    }
  );
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


/* =========================================
   PUBLIC CONTACT FORM
========================================= */

const OBA_CONTACT_TYPES = new Set([
  'Order Help',
  'Custom Feast / Custom Order',
  'Market, Pop-Up or Event Request',
  'Collaboration / Business Inquiry',
  'General Question'
]);

function cleanContactText(value, maxLength = 500) {
  return typeof value === 'string'
    ? value.replace(/\u0000/g, '').trim().slice(0, maxLength)
    : '';
}

function escapeContactHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validateContactEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

/* =========================================
   CREW RBAC REGISTRY + SHARED HELPERS
========================================= */

const CREW_PERMISSION_KEYS = [
  'dashboard.view','schedule.view',
  'inventory.view','inventory.add_baked','inventory.transfer','inventory.adjust','inventory.locations',
  'pickups.view','pickups.fulfill','pickups.modify',
  'drops.view','drops.edit','drops.publish',
  'reviews.view','reviews.import','reviews.finalize','reviews.edit_any_rough','reviews.edit_final','reviews.verify','reviews.edit_verified','reviews.publish','reviews.unpublish','reviews.edit_published','reviews.trash_view','reviews.trash_restore','reviews.permanent_delete','reviews.view_audit',
  'longnecks.view','bulletin.view','bulletin.draft','bulletin.send','polls.view','polls.manage',
  'analytics.view','products.view','products.manage','settings.view','settings.manage',
  'crew_access.view','crew.invite','crew.invite_manager','crew.recover','crew.roles','crew.permissions','crew.disable'
];
const CREW_PERMISSION_KEY_SET = new Set(CREW_PERMISSION_KEYS);

async function getCrewEffectivePermissions(env, crewUser) {
  const role = String(crewUser?.role || '').toLowerCase();
  if (role === 'owner') {
    return Object.fromEntries(CREW_PERMISSION_KEYS.map(key => [key, true]));
  }
  if (!['crew','manager'].includes(role)) {
    return Object.fromEntries(CREW_PERMISSION_KEYS.map(key => [key, false]));
  }
  const [roleRows, overrideRows] = await Promise.all([
    env.OBA_DB.prepare(`SELECT permission_key, allowed FROM crew_role_permissions WHERE role = ?`).bind(role).all(),
    env.OBA_DB.prepare(`SELECT permission_key, override_value FROM crew_permission_overrides WHERE crew_user_id = ?`).bind(Number(crewUser.crewUserId ?? crewUser.crew_user_id)).all()
  ]);
  const permissions = Object.fromEntries(CREW_PERMISSION_KEYS.map(key => [key, false]));
  for (const row of roleRows.results || []) {
    if (CREW_PERMISSION_KEY_SET.has(row.permission_key)) permissions[row.permission_key] = Number(row.allowed) === 1;
  }
  for (const row of overrideRows.results || []) {
    if (CREW_PERMISSION_KEY_SET.has(row.permission_key)) permissions[row.permission_key] = row.override_value === 'allow';
  }
  return permissions;
}

async function requireCrewAccessPermission(env, crewSession, permissionKey, corsHeaders) {
  const denial = await requireCrewPermission(env, crewSession, permissionKey);
  if (!denial) return null;
  return Response.json({ ok:false, authorized:false, error:'You do not have permission to perform this action.' }, { status:403, headers:{...corsHeaders,'Cache-Control':'no-store'} });
}

async function loadCrewTarget(env, crewUserId) {
  return env.OBA_DB.prepare(`SELECT crew_user_id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at FROM crew_users WHERE crew_user_id = ? LIMIT 1`).bind(crewUserId).first();
}

function canAdministerCrewTarget(actor, target) {
  const actorRole = String(actor?.role || '').toLowerCase();
  const targetRole = String(target?.role || '').toLowerCase();
  if (!target || Number(actor?.crewUserId) === Number(target.crew_user_id)) return false;
  if (actorRole === 'owner') return targetRole !== 'owner';
  return actorRole === 'manager' && targetRole === 'crew';
}


/* =========================================
   REVIEWS SYSTEM HELPERS
========================================= */

const REVIEW_STATUSES = new Set(['rough','final','verified','published','trash']);
const REVIEW_TYPES = new Set(['business','cookie']);
const REVIEW_SOURCES = new Set(['google','hotplate','other']);

const REVIEW_COOKIE_CATALOG = [
  ['OBA-001','Brown Butter Bliss','brown-butter-bliss'],
  ['OBA-002','The Marble Cookie','the-marble-cookie'],
  ['OBA-003','Biscoff Lava Crunch','biscoff-lava-crunch'],
  ['OBA-004','Birthday Bash','birthday-bash'],
  ['OBA-005','Berry Bliss Cheesecake','berry-bliss-cheesecake'],
  ['OBA-006','Midnight Mocha','midnight-mocha'],
  ['OBA-007','PB Classic','pb-classic'],
  ['OBA-008','Safari Snacks','safari-snacks'],
  ['OBA-009','Maple Bacon Goodness','maple-bacon-goodness'],
  ['OBA-010','Cherry Float Sandwich Cookie','cherry-float-sandwich-cookie'],
  ['OBA-011','Plain Jane','plain-jane'],
  ['OBA-012','Red Velvet Dream','red-velvet-dream'],
  ['OBA-013','Stars & Sprinkles','stars-and-sprinkles'],
  ['OBA-014','Loaded Monster','loaded-monster'],
  ['OBA-015','Campfire Crunch','campfire-crunch'],
  ['OBA-016','Peanut Campfire Crunch','peanut-campfire-crunch'],
  ['OBA-017','Chocolate Cosmo','chocolate-cosmo'],
  ['OBA-018','Twilight Marble','twilight-marble'],
  ['OBA-019','Salted Caramel Bliss','salted-caramel-bliss'],
  ['OBA-020',"Cinna’ Cookie Swirl",'cinna-cookie-swirl'],
  ['OBA-021','Spiced Cocoa','spiced-cocoa'],
  ['OBA-022','Pumpkin Butter Bliss','pumpkin-butter-bliss'],
  ['OBA-023','Plain Maple','plain-maple'],
  ['OBA-024','Brown Butter Pecan','brown-butter-pecan'],
  ['OBA-025','SD Classic','sd-classic']
].map(([cookieId,name,slug]) => ({cookieId,name,slug}));
const REVIEW_COOKIE_ID_SET = new Set(REVIEW_COOKIE_CATALOG.map(item => item.cookieId));

function reviewJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function reviewRowToPublicShape(row) {
  return {
    reviewId: row.review_id,
    reviewerName: row.reviewer_name,
    rating: Number(row.rating),
    reviewType: row.review_type,
    originalReviewText: row.original_review_text,
    reviewDate: row.review_date,
    source: row.source,
    sourceUrl: row.source_url,
    status: row.status,
    featuredPriority: Number(row.featured_priority || 0),
    internalNotes: row.internal_notes,
    accessScope: row.access_scope || 'shared',
    importedBy: row.imported_by_name || null,
    importedByUserId: row.imported_by_crew_user_id ? Number(row.imported_by_crew_user_id) : null,
    importedAt: row.imported_at,
    updatedBy: row.updated_by_name || null,
    updatedAt: row.updated_at,
    finalizedBy: row.finalized_by_name || null,
    finalizedByUserId: row.finalized_by_crew_user_id ? Number(row.finalized_by_crew_user_id) : null,
    finalizedAt: row.finalized_at,
    verifiedBy: row.verified_by_name || null,
    verifiedAt: row.verified_at,
    publishedBy: row.published_by_name || null,
    publishedAt: row.published_at,
    trashedAt: row.trashed_at,
    recordVersion: Number(row.record_version || 1),
    cookieIds: reviewJson(row.cookie_ids_json, []),
    cookieNames: reviewJson(row.cookie_names_json, []),
    imagePaths: reviewJson(row.image_paths_json, [])
  };
}

async function recordReviewAudit(env, {reviewId, action, actorId, fromStatus = null, toStatus = null, beforeData = null, afterData = null, note = null}) {
  await env.OBA_DB.prepare(`
    INSERT INTO review_audit_events (
      review_id, action, performed_by_crew_user_id, from_status, to_status,
      before_data, after_data, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    reviewId, action, actorId, fromStatus, toStatus,
    beforeData ? JSON.stringify(beforeData) : null,
    afterData ? JSON.stringify(afterData) : null,
    note || null
  ).run();
}

function normalizeReviewInput(body) {
  const rating = Number(body?.rating);
  const reviewType = String(body?.reviewType || '').trim().toLowerCase();
  const source = String(body?.source || '').trim().toLowerCase();
  const cookieIds = Array.from(new Set((Array.isArray(body?.cookieIds) ? body.cookieIds : [])
    .map(value => String(value || '').trim().toUpperCase()).filter(Boolean)));
  const imagePaths = Array.from(new Set((Array.isArray(body?.imagePaths) ? body.imagePaths : [])
    .map(value => String(value || '').trim()).filter(Boolean)));
  return {
    reviewerName: cleanContactText(body?.reviewerName, 120),
    rating: Number.isInteger(rating) ? rating : null,
    reviewType,
    originalReviewText: cleanContactText(body?.originalReviewText, 8000) || null,
    reviewDate: cleanContactText(body?.reviewDate, 10),
    source,
    sourceUrl: cleanContactText(body?.sourceUrl, 1000) || null,
    featuredPriority: Math.max(0, Math.min(100, Number(body?.featuredPriority || 0) || 0)),
    internalNotes: cleanContactText(body?.internalNotes, 4000) || null,
    cookieIds,
    imagePaths
  };
}

function validateReviewForFinal(input) {
  const errors = [];
  if (!input.reviewerName) errors.push('Reviewer name is required.');
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) errors.push('Rating must be from 1 to 5.');
  if (!REVIEW_TYPES.has(input.reviewType)) errors.push('Choose a valid review type.');
  if (!REVIEW_SOURCES.has(input.source)) errors.push('Choose a valid review source.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.reviewDate || '')) errors.push('A valid review date is required.');
  else if (new Date(`${input.reviewDate}T23:59:59Z`).getTime() > Date.now()) errors.push('Review date cannot be in the future.');
  if ((input.source === 'google' || input.source === 'hotplate') && !input.sourceUrl) errors.push('Source URL is required for Google and Hotplate reviews.');
  if (input.sourceUrl) {
    try { const u = new URL(input.sourceUrl); if (!['http:','https:'].includes(u.protocol)) throw new Error(); }
    catch { errors.push('Source URL must be a valid http(s) URL.'); }
  }
  for (const cookieId of input.cookieIds) if (!REVIEW_COOKIE_ID_SET.has(cookieId)) errors.push(`Unknown Cookie ID: ${cookieId}.`);
  if (input.imagePaths.length > 6) errors.push('A review can have up to 6 photos.');
  for (const path of input.imagePaths) if (!/^images\/reviews\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif)$/i.test(path)) errors.push(`Invalid review photo path: ${path}. Use an existing images/reviews/ image asset.`);
  if (input.reviewType === 'cookie' && input.cookieIds.length === 0) errors.push('Cookie reviews must be linked to at least one cookie.');
  if (input.reviewType === 'business' && input.cookieIds.length > 0) errors.push('General OBA reviews cannot have cookie links. Reclassify it as a Cookie review.');
  return errors;
}

async function loadReviewRecord(env, reviewId) {
  return env.OBA_DB.prepare(`
    SELECT r.*,
      trim(coalesce(i.first_name,'') || ' ' || coalesce(i.last_name,'')) AS imported_by_name,
      trim(coalesce(u.first_name,'') || ' ' || coalesce(u.last_name,'')) AS updated_by_name,
      trim(coalesce(f.first_name,'') || ' ' || coalesce(f.last_name,'')) AS finalized_by_name,
      trim(coalesce(v.first_name,'') || ' ' || coalesce(v.last_name,'')) AS verified_by_name,
      trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) AS published_by_name,
      (SELECT json_group_array(cookie_id) FROM review_cookie_links l WHERE l.review_id=r.review_id) AS cookie_ids_json,
      NULL AS cookie_names_json,
      (SELECT json_group_array(image_path) FROM (SELECT image_path FROM review_images ri WHERE ri.review_id=r.review_id ORDER BY sort_order, review_image_id)) AS image_paths_json
    FROM reviews r
    LEFT JOIN crew_users i ON i.crew_user_id=r.imported_by_crew_user_id
    LEFT JOIN crew_users u ON u.crew_user_id=r.updated_by_crew_user_id
    LEFT JOIN crew_users f ON f.crew_user_id=r.finalized_by_crew_user_id
    LEFT JOIN crew_users v ON v.crew_user_id=r.verified_by_crew_user_id
    LEFT JOIN crew_users p ON p.crew_user_id=r.published_by_crew_user_id
    WHERE r.review_id=? LIMIT 1
  `).bind(reviewId).first();
}

function reviewCanSeeRecord(crewSession, row) {
  // Working access controls who may act on a review, not whether Crew members
  // with Reviews access may see active organizational records.
  return Boolean(row);
}

function reviewCanChangeAccess(crewSession, row) {
  const role = String(crewSession.role || '').toLowerCase();
  const actorId = Number(crewSession.crewUserId);
  return role === 'owner' || role === 'manager' || Number(row?.imported_by_crew_user_id) === actorId;
}

function reviewCanEditActive(crewSession, permissions, row) {
  const role = String(crewSession.role || '').toLowerCase();
  const actorId = Number(crewSession.crewUserId);
  if (role === 'owner') return true;
  if (!row || row.status === 'trash' || !reviewCanSeeRecord(crewSession,row)) return false;
  const shared = row.access_scope === 'shared';
  if (row.status === 'rough') return Number(row.imported_by_crew_user_id) === actorId || permissions['reviews.edit_any_rough'] === true || shared;
  if (row.status === 'final') return Number(row.finalized_by_crew_user_id) === actorId || permissions['reviews.edit_final'] === true || (shared && permissions['reviews.finalize'] === true);
  if (row.status === 'verified') return permissions['reviews.edit_verified'] === true;
  if (row.status === 'published') return permissions['reviews.edit_published'] === true;
  return false;
}

async function replaceReviewCookieLinks(env, reviewId, cookieIds, actorId) {
  const existing = await env.OBA_DB.prepare(`SELECT cookie_id FROM review_cookie_links WHERE review_id=? ORDER BY cookie_id`).bind(reviewId).all();
  const before = (existing.results || []).map(row => row.cookie_id);
  const next = Array.from(new Set(cookieIds)).sort();
  if (JSON.stringify(before) === JSON.stringify(next)) return false;
  const statements = [env.OBA_DB.prepare(`DELETE FROM review_cookie_links WHERE review_id=?`).bind(reviewId)];
  for (const cookieId of next) statements.push(env.OBA_DB.prepare(`INSERT INTO review_cookie_links(review_id,cookie_id,created_by_crew_user_id) VALUES(?,?,?)`).bind(reviewId,cookieId,actorId));
  await env.OBA_DB.batch(statements);
  return true;
}

async function replaceReviewImages(env, reviewId, imagePaths, actorId) {
  const existing = await env.OBA_DB.prepare(`SELECT image_path FROM review_images WHERE review_id=? ORDER BY sort_order, review_image_id`).bind(reviewId).all();
  const before = (existing.results || []).map(row => row.image_path);
  const next = Array.from(new Set(imagePaths));
  if (JSON.stringify(before) === JSON.stringify(next)) return false;
  const statements = [env.OBA_DB.prepare(`DELETE FROM review_images WHERE review_id=?`).bind(reviewId)];
  next.forEach((imagePath,index)=>statements.push(env.OBA_DB.prepare(`INSERT INTO review_images(review_id,image_path,sort_order,created_by_crew_user_id) VALUES(?,?,?,?)`).bind(reviewId,imagePath,index,actorId)));
  await env.OBA_DB.batch(statements);
  return true;
}

function normalizeReviewDuplicateText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

async function reviewDuplicateWarnings(env, input, excludeReviewId = null) {
  const warnings = [];
  // Hotplate exposes reviews from a shared storefront/review page rather than
  // individual review permalinks, so the same Hotplate URL may legitimately
  // belong to many reviews. Keep exact-URL duplicate protection for sources
  // where the URL identifies a specific review (for example Google).
  if (input.sourceUrl && input.source !== 'hotplate') {
    const exact = await env.OBA_DB.prepare(`SELECT review_id FROM reviews WHERE source_url=? AND status!='trash' AND (? IS NULL OR review_id!=?) LIMIT 1`).bind(input.sourceUrl, excludeReviewId, excludeReviewId).first();
    if (exact) warnings.push({severity:'error',code:'exact_source_url',message:`This source URL is already attached to ${exact.review_id}.`,reviewId:exact.review_id});
  }
  if (input.reviewerName && input.rating && input.reviewDate && input.source) {
    const candidates = await env.OBA_DB.prepare(`SELECT review_id, original_review_text FROM reviews WHERE lower(reviewer_name)=lower(?) AND rating=? AND review_date=? AND source=? AND status!='trash' AND (? IS NULL OR review_id!=?) ORDER BY review_id LIMIT 10`).bind(input.reviewerName,input.rating,input.reviewDate,input.source,excludeReviewId,excludeReviewId).all();
    const incomingText = normalizeReviewDuplicateText(input.originalReviewText);
    const rows = candidates.results || [];
    const likely = rows.find(row => incomingText && normalizeReviewDuplicateText(row.original_review_text) === incomingText) || rows[0];
    if (likely && !warnings.some(w=>w.reviewId===likely.review_id)) {
      warnings.push({severity:'warning',code:'possible_duplicate',message:`Possible duplicate of ${likely.review_id}. Review the existing record before continuing.`,reviewId:likely.review_id});
    }
  }
  return warnings;
}


/* =========================================
   LONGNECK ACCOUNT HELPERS
========================================= */

const LONGNECK_SESSION_COOKIE = 'oba_longneck_session';
const LONGNECK_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const LONGNECK_TOKEN_TTL_MINUTES = 30;
const LONGNECK_ALLOWED_ORIGIN = 'https://ollysbakedassortments.com';

function normalizeLongneckEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeLongneckUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/^@/, '') : '';
}

function validLongneckUsername(value) {
  return /^[a-z0-9][a-z0-9._-]{2,23}$/.test(value || '');
}

function validLongneckPassword(value) {
  return typeof value === 'string' && value.length >= 10 && value.length <= 128;
}

function createLongneckSessionCookie(token) {
  return [
    `${LONGNECK_SESSION_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${LONGNECK_SESSION_TTL_SECONDS}`,
    'HttpOnly', 'Secure', 'SameSite=Strict'
  ].join('; ');
}

function expireLongneckSessionCookie() {
  return [`${LONGNECK_SESSION_COOKIE}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'Secure', 'SameSite=Strict'].join('; ');
}

function getLongneckToken(request) {
  const token = parseCookies(request)[LONGNECK_SESSION_COOKIE];
  return typeof token === 'string' && token ? token : null;
}

async function getLongneckSession(request, env) {
  const token = getLongneckToken(request);
  if (!token) return null;
  const tokenHash = await hashCrewSessionToken(token);
  const row = await env.OBA_DB.prepare(`
    SELECT s.session_id, s.longneck_id, s.expires_at,
           l.email, l.first_name, l.last_name, l.display_name, l.username,
           l.status, l.email_verified_at, l.avatar_key, l.marketing_email, l.marketing_sms
    FROM longneck_sessions s
    JOIN longnecks l ON l.longneck_id=s.longneck_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL
      AND datetime(s.expires_at)>datetime('now') AND l.status='active'
    LIMIT 1
  `).bind(tokenHash).first();
  if (!row) return null;
  await env.OBA_DB.prepare(`UPDATE longneck_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE session_id=?`).bind(row.session_id).run();
  return {
    sessionId: row.session_id, longneckId: row.longneck_id, email: row.email,
    firstName: row.first_name, lastName: row.last_name, displayName: row.display_name,
    username: row.username, status: row.status, emailVerified: !!row.email_verified_at,
    avatarKey: row.avatar_key || 'olly', marketingEmail: !!row.marketing_email,
    marketingSms: !!row.marketing_sms, expiresAt: row.expires_at
  };
}

async function requireLongneckSession(request, env, corsHeaders) {
  const session = await getLongneckSession(request, env);
  if (session) return { session };
  return { response: Response.json({ok:false, authenticated:false, error:'Please sign in to continue.'}, {status:401, headers:{...corsHeaders,'Cache-Control':'no-store'}}) };
}

async function longneckChipBalance(env, longneckId) {
  const row = await env.OBA_DB.prepare(`SELECT COALESCE(SUM(amount),0) AS balance FROM longneck_chip_ledger WHERE longneck_id=?`).bind(longneckId).first();
  return Number(row?.balance || 0);
}

async function longneckMembership(env, longneckId) {
  const row = await env.OBA_DB.prepare(`
    SELECT tier,status,started_at,current_period_start,current_period_end,cancel_at_period_end,created_at,updated_at
    FROM longneck_memberships WHERE longneck_id=? LIMIT 1
  `).bind(longneckId).first();
  return row ? {
    tier: row.tier || 'longneck', status: row.status || 'inactive',
    startedAt: row.started_at || null, currentPeriodStart: row.current_period_start || null,
    currentPeriodEnd: row.current_period_end || null, cancelAtPeriodEnd: !!row.cancel_at_period_end
  } : { tier:'longneck', status:'inactive', startedAt:null, currentPeriodStart:null, currentPeriodEnd:null, cancelAtPeriodEnd:false };
}

async function longneckSummary(env, longneckId) {
  const [chips, faves, adventures, moments, membership] = await Promise.all([
    longneckChipBalance(env,longneckId),
    env.OBA_DB.prepare(`SELECT COUNT(*) AS n FROM longneck_faves WHERE longneck_id=?`).bind(longneckId).first(),
    env.OBA_DB.prepare(`SELECT COUNT(*) AS n FROM longneck_event_checkins WHERE longneck_id=?`).bind(longneckId).first(),
    env.OBA_DB.prepare(`SELECT COUNT(*) AS n FROM longneck_moments WHERE longneck_id=? AND moderation_status='approved'`).bind(longneckId).first(),
    longneckMembership(env,longneckId)
  ]);
  return { chips, faves:Number(faves?.n||0), adventures:Number(adventures?.n||0), moments:Number(moments?.n||0), membership };
}

function longneckPublicUser(session) {
  return {
    longneckId: session.longneckId, email: session.email, firstName: session.firstName,
    lastName: session.lastName, displayName: session.displayName, username: session.username,
    avatarKey: session.avatarKey, emailVerified: session.emailVerified,
    marketingEmail: session.marketingEmail, marketingSms: session.marketingSms
  };
}

async function issueLongneckEmailToken(env, longneckId, purpose) {
  const raw = createCrewSessionToken();
  const hash = await hashCrewSessionToken(raw);
  const tokenId = crypto.randomUUID();
  await env.OBA_DB.prepare(`
    INSERT INTO longneck_email_tokens(token_id,longneck_id,purpose,token_hash,expires_at)
    VALUES(?,?,?,?,datetime('now','+${LONGNECK_TOKEN_TTL_MINUTES} minutes'))
  `).bind(tokenId,longneckId,purpose,hash).run();
  return raw;
}

async function sendLongneckAccountEmail(env, {to, firstName, purpose, token}) {
  const isVerify = purpose === 'verify';
  const path = isVerify ? '/my-oba/verify-email.html' : '/my-oba/reset-password.html';
  const action = isVerify ? 'Verify my email' : 'Reset my password';
  const url = `https://ollysbakedassortments.com${path}?token=${encodeURIComponent(token)}`;
  await sendOBAEmail(env, {
    to, subject: isVerify ? 'Verify your OBA Longneck account' : 'Reset your OBA Longneck password',
    text: `Hi ${firstName || 'Longneck'},\n\n${action}: ${url}\n\nThis link expires in ${LONGNECK_TOKEN_TTL_MINUTES} minutes.`,
    html: `<div style="font-family:Arial,sans-serif;color:#33271f"><h2>${isVerify ? 'Welcome to the herd.' : 'Password reset requested.'}</h2><p>Hi ${escapeContactHtml(firstName || 'Longneck')},</p><p><a href="${url}">${action}</a></p><p>This link expires in ${LONGNECK_TOKEN_TTL_MINUTES} minutes.</p></div>`
  });
}

function longneckOriginAllowed(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === LONGNECK_ALLOWED_ORIGIN;
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
       PUBLIC CONTACT FORM
    ========================================== */

    if (url.pathname === '/contact') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (request.method !== 'POST') {
        return Response.json(
          { ok: false, error: 'Method Not Allowed' },
          { status: 405, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
        );
      }

      const origin = request.headers.get('Origin');
      if (origin && origin !== 'https://ollysbakedassortments.com') {
        return Response.json(
          { ok: false, error: 'Request origin is not allowed.' },
          { status: 403, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
        );
      }

      const contentLength = Number(request.headers.get('Content-Length') || 0);
      if (contentLength > 20000) {
        return Response.json(
          { ok: false, error: 'This inquiry is too large to submit.' },
          { status: 413, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
        );
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json(
          { ok: false, error: 'Invalid request.' },
          { status: 400, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
        );
      }

      // Honeypot: silently accept obvious bot submissions without sending mail.
      if (cleanContactText(body?.website, 200)) {
        return Response.json(
          { ok: true },
          { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
        );
      }

      const startedAt = Number(body?.formStartedAt || 0);
      if (!Number.isFinite(startedAt) || startedAt <= 0 || Date.now() - startedAt < 1500) {
        return Response.json(
          { ok: false, error: 'Please wait a moment and try submitting again.' },
          { status: 400, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
        );
      }

      const inquiryType = cleanContactText(body?.inquiryType, 80);
      const name = cleanContactText(body?.name, 100);
      const email = cleanContactText(body?.email, 254).toLowerCase();
      const phone = cleanContactText(body?.phone, 30);
      const preferredContact = cleanContactText(body?.preferredContact, 20) || 'Email';
      const message = cleanContactText(body?.message, 4000);

      if (!OBA_CONTACT_TYPES.has(inquiryType)) {
        return Response.json(
          { ok: false, error: 'Please choose a valid request type.' },
          { status: 400, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
        );
      }

      if (!name || !validateContactEmail(email)) {
        return Response.json(
          { ok: false, error: 'Please provide your name and a valid email address.' },
          { status: 400, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
        );
      }

      const allowedFields = [
        ['Phone', phone],
        ['Preferred reply', preferredContact],
        ['Order number', cleanContactText(body?.orderNumber, 80)],
        ['Pickup / delivery date', cleanContactText(body?.orderDate, 30)],
        ['Type of issue', cleanContactText(body?.issue, 80)],
        ['Desired date', cleanContactText(body?.desiredDate, 30)],
        ['Approximate quantity', cleanContactText(body?.quantity, 20)],
        ['Flavor idea / direction', cleanContactText(body?.flavorIdea, 160)],
        ['Toppings / mix-ins', cleanContactText(body?.ingredients, 240)],
        ['Dietary / allergen notes', cleanContactText(body?.allergenNotes, 240)],
        ['Organization / event', cleanContactText(body?.organization, 160)],
        ['Event type', cleanContactText(body?.eventType, 120)],
        ['Proposed event date', cleanContactText(body?.eventDate, 30)],
        ['Proposed event time', cleanContactText(body?.eventTime, 80)],
        ['Event location', cleanContactText(body?.eventLocation, 200)],
        ['Estimated attendance', cleanContactText(body?.attendance, 20)],
        ['Vendor / setup information', cleanContactText(body?.setup, 500)],
        ['Request from OBA', cleanContactText(body?.request, 500)],
        ['Collaboration type', cleanContactText(body?.collabType, 160)],
        ['Proposed date / timeline', cleanContactText(body?.timeline, 120)],
        ['Brief description', cleanContactText(body?.proposal, 600)],
        ['Additional message', message]
      ].filter(([, value]) => value);

      const subject = `[OBA ${inquiryType}] ${name}`;
      const textLines = [
        `OBA website inquiry`,
        `Request type: ${inquiryType}`,
        `Name: ${name}`,
        `Email: ${email}`,
        ...allowedFields.map(([label, value]) => `${label}: ${value}`)
      ];
      const htmlRows = [
        ['Request type', inquiryType],
        ['Name', name],
        ['Email', email],
        ...allowedFields
      ].map(([label, value]) =>
        `<tr><th align="left" style="padding:8px 12px;border-bottom:1px solid #eadfd5;vertical-align:top">${escapeContactHtml(label)}</th><td style="padding:8px 12px;border-bottom:1px solid #eadfd5;white-space:pre-wrap">${escapeContactHtml(value)}</td></tr>`
      ).join('');

      try {
        await sendOBAEmail(env, {
          to: env.OBA_CONTACT_TO || env.OBA_EMAIL_FROM,
          subject,
          text: textLines.join('\n'),
          html: `<div style="font-family:Arial,sans-serif;color:#33271f"><h2>New OBA website inquiry</h2><table style="border-collapse:collapse;width:100%;max-width:760px">${htmlRows}</table><p style="margin-top:18px">Replying to this email will reply to ${escapeContactHtml(name)} at ${escapeContactHtml(email)}.</p></div>`,
          replyTo: email
        });
      } catch (error) {
        console.error('Contact form email delivery failed.', error);
        return Response.json(
          { ok: false, error: 'We could not send your inquiry right now. Please email OBA directly.' },
          { status: 503, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
        );
      }

      return Response.json(
        { ok: true },
        { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
      );
    }



    /* =========================================
       LONGNECK ACCOUNTS / MY OBA
    ========================================== */

    if (url.pathname.startsWith('/longneck/')) {
      if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:corsHeaders});
      if (!longneckOriginAllowed(request)) return Response.json({ok:false,error:'Forbidden'},{status:403,headers:{...corsHeaders,'Cache-Control':'no-store'}});

      if (url.pathname === '/longneck/register' && request.method === 'POST') {
        let body; try { body=await request.json(); } catch { body={}; }
        const email=normalizeLongneckEmail(body.email), username=normalizeLongneckUsername(body.username);
        const firstName=cleanContactText(body.firstName,60), lastName=cleanContactText(body.lastName,60);
        const displayName=cleanContactText(body.displayName,60), password=body.password;
        if (!firstName || !lastName || !displayName || !validateContactEmail(email) || !validLongneckUsername(username) || !validLongneckPassword(password)) {
          return Response.json({ok:false,error:'Complete every required field. Usernames are 3–24 characters; passwords must be at least 10 characters.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});
        }
        if (body.confirmAdult !== true) return Response.json({ok:false,error:'Longneck Accounts are currently available to guests age 18 and older.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});
        const existing=await env.OBA_DB.prepare(`SELECT longneck_id FROM longnecks WHERE email=? OR username=? LIMIT 1`).bind(email,username).first();
        if (existing) return Response.json({ok:false,error:'That email or username is already connected to a Longneck account.'},{status:409,headers:{...corsHeaders,'Cache-Control':'no-store'}});
        const id=`LN-${crypto.randomUUID().replace(/-/g,'').slice(0,12).toUpperCase()}`;
        const passwordHash=await hashCrewPassword(password);
        await env.OBA_DB.prepare(`INSERT INTO longnecks(longneck_id,email,password_hash,first_name,last_name,display_name,username,status,avatar_key,adult_confirmed_at) VALUES(?,?,?,?,?,?,?,'active','olly',CURRENT_TIMESTAMP)`).bind(id,email,passwordHash,firstName,lastName,displayName,username).run();
        await env.OBA_DB.prepare(`INSERT INTO longneck_chip_ledger(transaction_id,longneck_id,amount,transaction_type,description) VALUES(?,?,25,'welcome','Welcome to the herd')`).bind(crypto.randomUUID(),id).run();
        const verifyToken=await issueLongneckEmailToken(env,id,'verify');
        try { await sendLongneckAccountEmail(env,{to:email,firstName,purpose:'verify',token:verifyToken}); } catch(e){ console.error('Longneck verification email failed',e); }
        const raw=createCrewSessionToken(), tokenHash=await hashCrewSessionToken(raw), sessionId=crypto.randomUUID();
        await env.OBA_DB.prepare(`INSERT INTO longneck_sessions(session_id,longneck_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+30 days'))`).bind(sessionId,id,tokenHash).run();
        return Response.json({ok:true,longneckId:id},{status:201,headers:{...corsHeaders,'Cache-Control':'no-store','Set-Cookie':createLongneckSessionCookie(raw)}});
      }

      if (url.pathname === '/longneck/login' && request.method === 'POST') {
        let body; try { body=await request.json(); } catch { body={}; }
        const email=normalizeLongneckEmail(body.email), password=body.password || '';
        const row=await env.OBA_DB.prepare(`SELECT * FROM longnecks WHERE email=? LIMIT 1`).bind(email).first();
        const valid=row && row.status==='active' ? await verifyCrewPassword(password,row.password_hash) : false;
        if (!valid) return Response.json({ok:false,error:'Email or password is incorrect.'},{status:401,headers:{...corsHeaders,'Cache-Control':'no-store'}});
        const raw=createCrewSessionToken(), hash=await hashCrewSessionToken(raw), sessionId=crypto.randomUUID();
        await env.OBA_DB.prepare(`INSERT INTO longneck_sessions(session_id,longneck_id,token_hash,expires_at) VALUES(?,?,?,datetime('now','+30 days'))`).bind(sessionId,row.longneck_id,hash).run();
        await env.OBA_DB.prepare(`UPDATE longnecks SET last_login_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE longneck_id=?`).bind(row.longneck_id).run();
        return Response.json({ok:true},{headers:{...corsHeaders,'Cache-Control':'no-store','Set-Cookie':createLongneckSessionCookie(raw)}});
      }

      if (url.pathname === '/longneck/session' && request.method === 'GET') {
        const session=await getLongneckSession(request,env);
        if (!session) return Response.json({ok:true,authenticated:false},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
        const summary=await longneckSummary(env,session.longneckId);
        return Response.json({ok:true,authenticated:true,user:longneckPublicUser(session),summary},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }

      if (url.pathname === '/longneck/logout' && request.method === 'POST') {
        const token=getLongneckToken(request);
        if (token) { const hash=await hashCrewSessionToken(token); await env.OBA_DB.prepare(`UPDATE longneck_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?`).bind(hash).run(); }
        return Response.json({ok:true},{headers:{...corsHeaders,'Cache-Control':'no-store','Set-Cookie':expireLongneckSessionCookie()}});
      }

      if (url.pathname === '/longneck/logout-all' && request.method === 'POST') {
        const auth=await requireLongneckSession(request,env,corsHeaders); if(auth.response)return auth.response;
        await env.OBA_DB.prepare(`UPDATE longneck_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE longneck_id=? AND revoked_at IS NULL`).bind(auth.session.longneckId).run();
        return Response.json({ok:true},{headers:{...corsHeaders,'Cache-Control':'no-store','Set-Cookie':expireLongneckSessionCookie()}});
      }

      if (url.pathname === '/longneck/request-reset' && request.method === 'POST') {
        let body; try{body=await request.json();}catch{body={};}
        const email=normalizeLongneckEmail(body.email); const row=await env.OBA_DB.prepare(`SELECT longneck_id,first_name FROM longnecks WHERE email=? AND status='active' LIMIT 1`).bind(email).first();
        if(row){ const token=await issueLongneckEmailToken(env,row.longneck_id,'reset'); try{await sendLongneckAccountEmail(env,{to:email,firstName:row.first_name,purpose:'reset',token});}catch(e){console.error(e);} }
        return Response.json({ok:true,message:'If that email belongs to an account, a reset link is on the way.'},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }

      if ((url.pathname === '/longneck/verify-email' || url.pathname === '/longneck/reset-password') && request.method === 'POST') {
        let body; try{body=await request.json();}catch{body={};}
        const raw=typeof body.token==='string'?body.token:''; if(!raw)return Response.json({ok:false,error:'This link is invalid.'},{status:400,headers:corsHeaders});
        const hash=await hashCrewSessionToken(raw), purpose=url.pathname.endsWith('verify-email')?'verify':'reset';
        const row=await env.OBA_DB.prepare(`SELECT token_id,longneck_id FROM longneck_email_tokens WHERE token_hash=? AND purpose=? AND used_at IS NULL AND datetime(expires_at)>datetime('now') LIMIT 1`).bind(hash,purpose).first();
        if(!row)return Response.json({ok:false,error:'This link is invalid or has expired.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});
        if(purpose==='verify') await env.OBA_DB.prepare(`UPDATE longnecks SET email_verified_at=COALESCE(email_verified_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE longneck_id=?`).bind(row.longneck_id).run();
        else { if(!validLongneckPassword(body.password)) return Response.json({ok:false,error:'Use a password with at least 10 characters.'},{status:400,headers:corsHeaders}); const ph=await hashCrewPassword(body.password); await env.OBA_DB.prepare(`UPDATE longnecks SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE longneck_id=?`).bind(ph,row.longneck_id).run(); await env.OBA_DB.prepare(`UPDATE longneck_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE longneck_id=? AND revoked_at IS NULL`).bind(row.longneck_id).run(); }
        await env.OBA_DB.prepare(`UPDATE longneck_email_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_id=?`).bind(row.token_id).run();
        return Response.json({ok:true},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }

      if (url.pathname === '/longneck/deactivate' && request.method === 'POST') {
        const auth=await requireLongneckSession(request,env,corsHeaders); if(auth.response)return auth.response;
        let body;try{body=await request.json();}catch{body={};}
        const row=await env.OBA_DB.prepare(`SELECT password_hash FROM longnecks WHERE longneck_id=?`).bind(auth.session.longneckId).first();
        const valid=row ? await verifyCrewPassword(body.password||'',row.password_hash) : false;
        if(!valid)return Response.json({ok:false,error:'Enter your current password to deactivate your account.'},{status:401,headers:corsHeaders});
        await env.OBA_DB.prepare(`UPDATE longnecks SET status='deactivated',display_name='Former Longneck',username='deactivated_'||lower(substr(replace(longneck_id,'-',''),1,16)),marketing_email=0,marketing_sms=0,updated_at=CURRENT_TIMESTAMP WHERE longneck_id=?`).bind(auth.session.longneckId).run();
        await env.OBA_DB.prepare(`UPDATE longneck_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE longneck_id=? AND revoked_at IS NULL`).bind(auth.session.longneckId).run();
        return Response.json({ok:true},{headers:{...corsHeaders,'Cache-Control':'no-store','Set-Cookie':expireLongneckSessionCookie()}});
      }

      if (url.pathname === '/longneck/profile' && request.method === 'POST') {
        const auth=await requireLongneckSession(request,env,corsHeaders); if(auth.response)return auth.response;
        let body; try{body=await request.json();}catch{body={};}
        const displayName=cleanContactText(body.displayName,60), username=normalizeLongneckUsername(body.username), avatarKey=cleanContactText(body.avatarKey,30)||'olly';
        if(!displayName||!validLongneckUsername(username))return Response.json({ok:false,error:'Enter a display name and a valid username.'},{status:400,headers:corsHeaders});
        const conflict=await env.OBA_DB.prepare(`SELECT longneck_id FROM longnecks WHERE username=? AND longneck_id!=? LIMIT 1`).bind(username,auth.session.longneckId).first();
        if(conflict)return Response.json({ok:false,error:'That username is already taken.'},{status:409,headers:corsHeaders});
        await env.OBA_DB.prepare(`UPDATE longnecks SET display_name=?,username=?,avatar_key=?,marketing_email=?,marketing_sms=?,updated_at=CURRENT_TIMESTAMP WHERE longneck_id=?`).bind(displayName,username,avatarKey,body.marketingEmail?1:0,body.marketingSms?1:0,auth.session.longneckId).run();
        return Response.json({ok:true},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }

      if (url.pathname === '/longneck/chips' && request.method === 'GET') {
        const auth=await requireLongneckSession(request,env,corsHeaders); if(auth.response)return auth.response;
        const result=await env.OBA_DB.prepare(`SELECT transaction_id,amount,transaction_type,description,created_at FROM longneck_chip_ledger WHERE longneck_id=? ORDER BY created_at DESC LIMIT 100`).bind(auth.session.longneckId).all();
        return Response.json({ok:true,balance:await longneckChipBalance(env,auth.session.longneckId),transactions:result.results||[],rewards:[{chips:500,label:'Classic Cookie'},{chips:750,label:'Specialty Cookie'},{chips:1000,label:'Lil Giraffe Pack'},{chips:1750,label:'Tall Giraffe Pack'},{chips:3500,label:'Giraffe Feast'}]},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }

      if (url.pathname === '/longneck/faves' && request.method === 'GET') {
        const auth=await requireLongneckSession(request,env,corsHeaders); if(auth.response)return auth.response;
        const result=await env.OBA_DB.prepare(`SELECT cookie_id,cookie_slug,cookie_name,created_at FROM longneck_faves WHERE longneck_id=? ORDER BY created_at DESC`).bind(auth.session.longneckId).all();
        return Response.json({ok:true,faves:result.results||[]},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }
      if (url.pathname === '/longneck/faves/toggle' && request.method === 'POST') {
        const auth=await requireLongneckSession(request,env,corsHeaders); if(auth.response)return auth.response;
        let body;try{body=await request.json();}catch{body={};} const slug=cleanContactText(body.cookieSlug,100),name=cleanContactText(body.cookieName,120),cookieId=cleanContactText(body.cookieId,40)||slug;
        if(!slug||!name)return Response.json({ok:false,error:'Cookie information is required.'},{status:400,headers:corsHeaders});
        const old=await env.OBA_DB.prepare(`SELECT 1 AS yes FROM longneck_faves WHERE longneck_id=? AND cookie_id=?`).bind(auth.session.longneckId,cookieId).first();
        if(old) await env.OBA_DB.prepare(`DELETE FROM longneck_faves WHERE longneck_id=? AND cookie_id=?`).bind(auth.session.longneckId,cookieId).run();
        else await env.OBA_DB.prepare(`INSERT INTO longneck_faves(longneck_id,cookie_id,cookie_slug,cookie_name) VALUES(?,?,?,?)`).bind(auth.session.longneckId,cookieId,slug,name).run();
        return Response.json({ok:true,faved:!old},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }

      if (url.pathname === '/longneck/adventures' && request.method === 'GET') {
        const auth=await requireLongneckSession(request,env,corsHeaders);if(auth.response)return auth.response;
        const result=await env.OBA_DB.prepare(`SELECT event_id,event_name,checked_in_at FROM longneck_event_checkins WHERE longneck_id=? ORDER BY checked_in_at DESC`).bind(auth.session.longneckId).all();
        return Response.json({ok:true,adventures:result.results||[]},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }

      if (url.pathname === '/longneck/membership' && request.method === 'GET') {
        const auth=await requireLongneckSession(request,env,corsHeaders);if(auth.response)return auth.response;
        return Response.json({ok:true,membership:await longneckMembership(env,auth.session.longneckId)},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }

      if (url.pathname === '/longneck/moments' && request.method === 'GET') {
        const auth=await requireLongneckSession(request,env,corsHeaders);if(auth.response)return auth.response;
        const result=await env.OBA_DB.prepare(`SELECT moment_id,event_id,caption,image_url,moderation_status,created_at FROM longneck_moments WHERE longneck_id=? ORDER BY created_at DESC`).bind(auth.session.longneckId).all();
        return Response.json({ok:true,moments:result.results||[]},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }

      return Response.json({ok:false,error:'Not Found'},{status:404,headers:corsHeaders});
    }

    /* =========================================
       CREW — LONGNECK MANAGEMENT
    ========================================== */
    if (url.pathname === '/crew/longnecks' || url.pathname === '/crew/longnecks/detail' || url.pathname === '/crew/longnecks/chips' || url.pathname === '/crew/longnecks/membership') {
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
      const crewSession=await getCrewSession(request,env); if(!crewSession)return Response.json({ok:false,error:'Unauthorized'},{status:401,headers:corsHeaders});
      const denial=await requireCrewPermission(env,crewSession,'longnecks.view'); if(denial)return denial;
      if(request.method==='GET' && url.pathname==='/crew/longnecks'){
        const q=(url.searchParams.get('q')||'').trim(); const like=`%${q}%`;
        const result=await env.OBA_DB.prepare(`SELECT l.longneck_id,l.email,l.first_name,l.last_name,l.display_name,l.username,l.status,l.created_at,l.last_login_at,COALESCE(SUM(c.amount),0) AS chips FROM longnecks l LEFT JOIN longneck_chip_ledger c ON c.longneck_id=l.longneck_id WHERE (?='' OR l.email LIKE ? OR l.display_name LIKE ? OR l.username LIKE ? OR l.first_name||' '||l.last_name LIKE ?) GROUP BY l.longneck_id ORDER BY l.created_at DESC LIMIT 250`).bind(q,like,like,like,like).all();
        return Response.json({ok:true,longnecks:result.results||[]},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }
      if(request.method==='GET' && url.pathname==='/crew/longnecks/detail'){
        const id=url.searchParams.get('id')||''; const row=await env.OBA_DB.prepare(`SELECT longneck_id,email,first_name,last_name,display_name,username,status,avatar_key,email_verified_at,marketing_email,marketing_sms,created_at,last_login_at FROM longnecks WHERE longneck_id=?`).bind(id).first(); if(!row)return Response.json({ok:false,error:'Longneck not found.'},{status:404,headers:corsHeaders});
        const chips=await longneckChipBalance(env,id); const ledger=await env.OBA_DB.prepare(`SELECT amount,transaction_type,description,created_at FROM longneck_chip_ledger WHERE longneck_id=? ORDER BY created_at DESC LIMIT 50`).bind(id).all();
        return Response.json({ok:true,longneck:row,chips,membership:await longneckMembership(env,id),ledger:ledger.results||[]},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }
      if(request.method==='POST' && url.pathname==='/crew/longnecks/chips'){
        if(!hasAllowedCrewOrigin(request))return Response.json({ok:false,error:'Forbidden'},{status:403,headers:corsHeaders}); let body;try{body=await request.json();}catch{body={};}
        const amount=Number(body.amount), id=cleanContactText(body.longneckId,40), note=cleanContactText(body.note,300); if(!id||!Number.isInteger(amount)||amount===0||Math.abs(amount)>10000||!note)return Response.json({ok:false,error:'Longneck, whole-chip adjustment, and reason are required.'},{status:400,headers:corsHeaders});
        await env.OBA_DB.prepare(`INSERT INTO longneck_chip_ledger(transaction_id,longneck_id,amount,transaction_type,description,created_by_crew_user_id) VALUES(?,?,?,'crew_adjustment',?,?)`).bind(crypto.randomUUID(),id,amount,note,crewSession.crewUserId).run();
        return Response.json({ok:true,balance:await longneckChipBalance(env,id)},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }
      if(request.method==='POST' && url.pathname==='/crew/longnecks/membership'){
        if(!hasAllowedCrewOrigin(request))return Response.json({ok:false,error:'Forbidden'},{status:403,headers:corsHeaders}); let body;try{body=await request.json();}catch{body={};}
        const id=cleanContactText(body.longneckId,40), tier=cleanContactText(body.tier,20).toLowerCase(), status=cleanContactText(body.status,20).toLowerCase();
        if(!id||!['longneck','gold','platinum'].includes(tier)||!['inactive','active','paused','canceled'].includes(status))return Response.json({ok:false,error:'Choose a valid Longneck membership tier and status.'},{status:400,headers:corsHeaders});
        const exists=await env.OBA_DB.prepare(`SELECT longneck_id FROM longnecks WHERE longneck_id=?`).bind(id).first(); if(!exists)return Response.json({ok:false,error:'Longneck not found.'},{status:404,headers:corsHeaders});
        await env.OBA_DB.prepare(`INSERT INTO longneck_memberships(longneck_id,tier,status,started_at,updated_at) VALUES(?,?,?,CASE WHEN ?='active' THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP) ON CONFLICT(longneck_id) DO UPDATE SET tier=excluded.tier,status=excluded.status,started_at=CASE WHEN excluded.status='active' THEN COALESCE(longneck_memberships.started_at,CURRENT_TIMESTAMP) ELSE longneck_memberships.started_at END,updated_at=CURRENT_TIMESTAMP`).bind(id,tier,status,status).run();
        return Response.json({ok:true,membership:await longneckMembership(env,id)},{headers:{...corsHeaders,'Cache-Control':'no-store'}});
      }
    }

    /* =========================================
       STRICT ORIGIN FOR CREW STATE CHANGES
    ========================================== */

    if (
      request.method !== 'OPTIONS' &&
      requiresStrictCrewOrigin(
        url.pathname,
        request.method
      ) &&
      !hasAllowedCrewOrigin(request)
    ) {
      return Response.json(
        {
          ok: false,
          error: 'Forbidden'
        },
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-store'
          }
        }
      );
    }

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

      const effectivePermissions =
        await getCrewEffectivePermissions(
          env,
          {
            crewUserId: Number(crewUser.crew_user_id),
            role: crewUser.role
          }
        );

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
              crewUser.role,

            effectivePermissions
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

      const effectivePermissions =
        await getCrewEffectivePermissions(
          env,
          crewSession
        );

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
              crewSession.role,

            effectivePermissions
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
    await recordCrewSecurityEvent(
      env,
      {
        eventType:
          'password_reset_password_reuse_blocked',
        crewUserId:
          Number(resetRecord.crew_user_id),
        resetId:
          resetRecord.reset_id,
        ipHash:
          await hashCrewLoginIp(request)
      }
    );

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
   CREW BACKUP RECOVERY EMAIL — REQUEST
========================================= */

if (url.pathname === '/crew/recovery-email/request') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      { ok: false, error: 'Method Not Allowed' },
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
    await getCrewSession(request, env);

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
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid request.' },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  const recoveryEmail =
    typeof body?.recoveryEmail === 'string'
      ? body.recoveryEmail.trim().toLowerCase()
      : '';

  const currentPassword =
    typeof body?.currentPassword === 'string'
      ? body.currentPassword
      : '';

  if (!recoveryEmail || !currentPassword) {
    return Response.json(
      {
        ok: false,
        error:
          'Backup recovery email and current password are required.'
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

  const basicEmailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (
    recoveryEmail.length > 254 ||
    !basicEmailPattern.test(recoveryEmail)
  ) {
    return Response.json(
      {
        ok: false,
        error: 'Enter a valid backup recovery email.'
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

  const crewUser =
    await env.OBA_DB
      .prepare(`
        SELECT
          crew_user_id,
          email,
          password_hash,
          status
        FROM crew_users
        WHERE crew_user_id = ?
        LIMIT 1
      `)
      .bind(crewSession.crewUserId)
      .first();

  if (!crewUser || crewUser.status !== 'active') {
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

  const currentPasswordValid =
    await verifyCrewPassword(
      currentPassword,
      crewUser.password_hash
    );

  if (!currentPasswordValid) {
    await recordCrewSecurityEvent(
      env,
      {
        eventType:
          'recovery_email_verification_denied',
        crewUserId:
          Number(crewUser.crew_user_id),
        ipHash:
          await hashCrewLoginIp(request),
        details: { reason: 'invalid_password' }
      }
    );

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

  if (recoveryEmail === String(crewUser.email).toLowerCase()) {
    return Response.json(
      {
        ok: false,
        error:
          'Backup recovery email must be different from the primary Crew email.'
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

  const emailInUse =
    await env.OBA_DB
      .prepare(`
        SELECT crew_user_id
        FROM crew_users
        WHERE lower(email) = ?
        UNION
        SELECT crew_user_id
        FROM crew_recovery_emails
        WHERE lower(recovery_email) = ?
        LIMIT 1
      `)
      .bind(recoveryEmail, recoveryEmail)
      .first();

  if (
    emailInUse &&
    Number(emailInUse.crew_user_id) !==
      Number(crewUser.crew_user_id)
  ) {
    return Response.json(
      {
        ok: false,
        error:
          'That email is already associated with another Crew account.'
      },
      {
        status: 409,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  const currentRecoveryEmail =
    await env.OBA_DB
      .prepare(`
        SELECT recovery_email, verified_at
        FROM crew_recovery_emails
        WHERE crew_user_id = ?
        LIMIT 1
      `)
      .bind(crewUser.crew_user_id)
      .first();

  if (
    currentRecoveryEmail?.verified_at &&
    String(currentRecoveryEmail.recovery_email).toLowerCase() === recoveryEmail
  ) {
    return Response.json(
      {
        ok: false,
        alreadyVerified: true,
        error: 'That backup recovery email is already verified.'
      },
      {
        status: 409,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  const verificationToken =
    createCrewRecoveryEmailVerificationToken();

  const tokenHash =
    await hashCrewRecoveryEmailVerificationToken(
      verificationToken
    );

  const verificationId =
    crypto.randomUUID();

  const expiresAt =
    getCrewRecoveryEmailVerificationExpiry();

  try {
    await env.OBA_DB.batch([
      env.OBA_DB
        .prepare(`
          UPDATE crew_recovery_email_verifications
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE crew_user_id = ?
            AND used_at IS NULL
            AND revoked_at IS NULL
        `)
        .bind(crewUser.crew_user_id),

      env.OBA_DB
        .prepare(`
          INSERT INTO crew_recovery_email_verifications (
            verification_id,
            crew_user_id,
            pending_email,
            token_hash,
            expires_at
          )
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          verificationId,
          crewUser.crew_user_id,
          recoveryEmail,
          tokenHash,
          expiresAt
        )
    ]);
  } catch (error) {
    console.error(
      'Crew recovery email verification creation failed:',
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          'Unable to start backup email verification.'
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

  const verificationUrl =
    'https://ollysbakedassortments.com/crew/account.html' +
    '?verifyRecoveryEmail=' +
    encodeURIComponent(verificationToken);

  try {
    await sendOBAEmail(
      env,
      {
        to: recoveryEmail,
        subject:
          'Verify your OBA Cookie Crew recovery email',
        text: [
          'OBA Cookie Crew recovery email verification',
          '',
          'This email address was added as a backup recovery address for an OBA Cookie Crew account.',
          '',
          'Verify this address using the secure link below:',
          verificationUrl,
          '',
          `This link expires in ${CREW_RECOVERY_EMAIL_VERIFICATION_TTL_MINUTES} minutes and can only be used once.`,
          '',
          'If you were not expecting this message, you can ignore it.'
        ].join('\n'),
        html: `
          <!doctype html>
          <html>
            <body style="margin:0;padding:0;background:#f7f1e7;font-family:Arial,Helvetica,sans-serif;color:#3a2a20;">
              <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
                <div style="background:#ffffff;border:1px solid #eadfce;border-radius:18px;padding:32px;">
                  <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b674d;">
                    OBA Cookie Crew
                  </p>
                  <h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#3a2a20;">
                    Verify your recovery email
                  </h1>
                  <p style="margin:0 0 22px;font-size:16px;line-height:1.6;">
                    This address was added as a backup recovery email for an OBA Cookie Crew account.
                  </p>
                  <p style="margin:0 0 24px;">
                    <a href="${verificationUrl}" style="display:inline-block;background:#5b3a29;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:999px;">
                      Verify Recovery Email
                    </a>
                  </p>
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#6d594c;">
                    This link expires in ${CREW_RECOVERY_EMAIL_VERIFICATION_TTL_MINUTES} minutes and can only be used once.
                  </p>
                </div>
              </div>
            </body>
          </html>
        `
      }
    );
  } catch (error) {
    await env.OBA_DB
      .prepare(`
        UPDATE crew_recovery_email_verifications
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE verification_id = ?
          AND used_at IS NULL
      `)
      .bind(verificationId)
      .run();

    console.error(
      'Crew recovery email verification send failed:',
      error
    );

    return Response.json(
      {
        ok: false,
        error: 'Unable to send verification email.'
      },
      {
        status: 502,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  await recordCrewSecurityEvent(
    env,
    {
      eventType:
        'recovery_email_verification_sent',
      crewUserId:
        Number(crewUser.crew_user_id),
      ipHash:
        await hashCrewLoginIp(request),
      details: {
        verificationId,
        expiresAt
      }
    }
  );

  return Response.json(
    {
      ok: true,
      verificationPending: true,
      message:
        'Verification instructions were sent to the backup recovery email.'
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
   CREW BACKUP RECOVERY EMAIL — STATUS
========================================= */

if (url.pathname === '/crew/recovery-email') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'GET') {
    return Response.json(
      { ok: false, error: 'Method Not Allowed' },
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
    await getCrewSession(request, env);

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

  const recoveryEmail =
    await env.OBA_DB
      .prepare(`
        SELECT recovery_email, verified_at, updated_at
        FROM crew_recovery_emails
        WHERE crew_user_id = ?
        LIMIT 1
      `)
      .bind(crewSession.crewUserId)
      .first();

  const pendingVerification =
    await env.OBA_DB
      .prepare(`
        SELECT pending_email, expires_at
        FROM crew_recovery_email_verifications
        WHERE crew_user_id = ?
          AND used_at IS NULL
          AND revoked_at IS NULL
          AND datetime(expires_at) > datetime('now')
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .bind(crewSession.crewUserId)
      .first();

  return Response.json(
    {
      ok: true,
      recoveryEmail: recoveryEmail
        ? {
            email: recoveryEmail.recovery_email,
            verifiedAt: recoveryEmail.verified_at,
            updatedAt: recoveryEmail.updated_at
          }
        : null,
      pendingVerification: pendingVerification
        ? {
            email: pendingVerification.pending_email,
            expiresAt: pendingVerification.expires_at
          }
        : null
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
   CREW BACKUP RECOVERY EMAIL — VERIFY
========================================= */

if (url.pathname === '/crew/recovery-email/verify') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      { ok: false, error: 'Method Not Allowed' },
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
    await getCrewSession(request, env);

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
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid request.' },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  const token =
    typeof body?.token === 'string'
      ? body.token.trim()
      : '';

  if (!token || token.length > 512) {
    return Response.json(
      {
        ok: false,
        error: 'This recovery-email verification link is invalid or has expired.'
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

  const tokenHash =
    await hashCrewRecoveryEmailVerificationToken(token);

  const verification =
    await env.OBA_DB
      .prepare(`
        SELECT
          verification_id,
          crew_user_id,
          pending_email,
          expires_at
        FROM crew_recovery_email_verifications
        WHERE token_hash = ?
          AND crew_user_id = ?
          AND used_at IS NULL
          AND revoked_at IS NULL
          AND datetime(expires_at) > datetime('now')
        LIMIT 1
      `)
      .bind(tokenHash, crewSession.crewUserId)
      .first();

  if (!verification) {
    await recordCrewSecurityEvent(
      env,
      {
        eventType: 'recovery_email_verification_failed',
        crewUserId: Number(crewSession.crewUserId),
        ipHash: await hashCrewLoginIp(request),
        details: { reason: 'invalid_or_expired_token' }
      }
    );

    return Response.json(
      {
        ok: false,
        error: 'This recovery-email verification link is invalid or has expired.'
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

  const conflictingAccount =
    await env.OBA_DB
      .prepare(`
        SELECT crew_user_id
        FROM crew_users
        WHERE lower(email) = lower(?)
        UNION
        SELECT crew_user_id
        FROM crew_recovery_emails
        WHERE lower(recovery_email) = lower(?)
        LIMIT 1
      `)
      .bind(
        verification.pending_email,
        verification.pending_email
      )
      .first();

  if (
    conflictingAccount &&
    Number(conflictingAccount.crew_user_id) !==
      Number(crewSession.crewUserId)
  ) {
    await env.OBA_DB
      .prepare(`
        UPDATE crew_recovery_email_verifications
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE verification_id = ?
          AND used_at IS NULL
      `)
      .bind(verification.verification_id)
      .run();

    return Response.json(
      {
        ok: false,
        error: 'That email is already associated with another Crew account.'
      },
      {
        status: 409,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  try {
    await env.OBA_DB.batch([
      env.OBA_DB
        .prepare(`
          INSERT INTO crew_recovery_emails (
            crew_user_id,
            recovery_email,
            verified_at,
            updated_at
          )
          VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(crew_user_id) DO UPDATE SET
            recovery_email = excluded.recovery_email,
            verified_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(
          crewSession.crewUserId,
          verification.pending_email
        ),

      env.OBA_DB
        .prepare(`
          UPDATE crew_recovery_email_verifications
          SET used_at = CURRENT_TIMESTAMP
          WHERE verification_id = ?
            AND used_at IS NULL
            AND revoked_at IS NULL
            AND datetime(expires_at) > datetime('now')
        `)
        .bind(verification.verification_id),

      env.OBA_DB
        .prepare(`
          UPDATE crew_recovery_email_verifications
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE crew_user_id = ?
            AND verification_id <> ?
            AND used_at IS NULL
            AND revoked_at IS NULL
        `)
        .bind(
          crewSession.crewUserId,
          verification.verification_id
        )
    ]);
  } catch (error) {
    console.error(
      'Crew recovery email verification failed:',
      error
    );

    return Response.json(
      {
        ok: false,
        error: 'Unable to verify the backup recovery email.'
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

  await recordCrewSecurityEvent(
    env,
    {
      eventType: 'recovery_email_verified',
      crewUserId: Number(crewSession.crewUserId),
      ipHash: await hashCrewLoginIp(request),
      details: {
        verificationId: verification.verification_id
      }
    }
  );

  return Response.json(
    {
      ok: true,
      verified: true,
      recoveryEmail: verification.pending_email
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
   CREW RECOVERY CODES — AUTHENTICATED
========================================= */

if (url.pathname === '/crew/recovery-codes') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  const crewSession =
    await getCrewSession(request, env);

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

  if (request.method === 'GET') {
    const activeCodes =
      await env.OBA_DB
        .prepare(`
          SELECT COUNT(*) AS active_count
          FROM crew_recovery_codes
          WHERE crew_user_id = ?
            AND used_at IS NULL
            AND revoked_at IS NULL
        `)
        .bind(crewSession.crewUserId)
        .first();

    return Response.json(
      {
        ok: true,
        activeCount:
          Number(activeCodes?.active_count ?? 0)
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

  if (request.method !== 'POST') {
    return Response.json(
      { ok: false, error: 'Method Not Allowed' },
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
      { ok: false, error: 'Invalid request.' },
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

  if (!currentPassword) {
    return Response.json(
      { ok: false, error: 'Current password is required.' },
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

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
      .bind(crewSession.crewUserId)
      .first();

  const passwordValid =
    Boolean(
      crewUser &&
      crewUser.status === 'active' &&
      await verifyCrewPassword(
        currentPassword,
        crewUser.password_hash
      )
    );

  if (!passwordValid) {
    await recordCrewSecurityEvent(
      env,
      {
        eventType: 'recovery_codes_generation_denied',
        crewUserId: crewSession.crewUserId,
        ipHash: await hashCrewLoginIp(request)
      }
    );

    return Response.json(
      { ok: false, error: 'Current password is incorrect.' },
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  const codes = [];
  const rows = [];

  for (let index = 0; index < CREW_RECOVERY_CODE_COUNT; index += 1) {
    const code = createCrewRecoveryCode();
    const codeHash = await hashCrewRecoveryCode(code);

    codes.push(code);
    rows.push({
      recoveryCodeId: crypto.randomUUID(),
      codeHash
    });
  }

  try {
    await env.OBA_DB.batch([
      env.OBA_DB
        .prepare(`
          UPDATE crew_recovery_codes
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE crew_user_id = ?
            AND used_at IS NULL
            AND revoked_at IS NULL
        `)
        .bind(crewSession.crewUserId),

      ...rows.map(row =>
        env.OBA_DB
          .prepare(`
            INSERT INTO crew_recovery_codes (
              recovery_code_id,
              crew_user_id,
              code_hash
            )
            VALUES (?, ?, ?)
          `)
          .bind(
            row.recoveryCodeId,
            crewSession.crewUserId,
            row.codeHash
          )
      )
    ]);
  } catch (error) {
    console.error('Crew recovery code generation failed.', {
      crewUserId: crewSession.crewUserId,
      message:
        error instanceof Error
          ? error.message
          : 'Unknown recovery code error'
    });

    return Response.json(
      { ok: false, error: 'Unable to generate recovery codes.' },
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  await recordCrewSecurityEvent(
    env,
    {
      eventType: 'recovery_codes_generated',
      crewUserId: crewSession.crewUserId,
      ipHash: await hashCrewLoginIp(request),
      details: { count: codes.length }
    }
  );

  return Response.json(
    {
      ok: true,
      codes,
      activeCount: codes.length,
      message:
        'Save these recovery codes now. They will not be shown again.'
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
   CREW ACCOUNT RECOVERY — RECOVERY CODE
========================================= */

if (url.pathname === '/crew/recover-account') {

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (request.method !== 'POST') {
    return Response.json(
      { ok: false, error: 'Method Not Allowed' },
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
      { ok: false, error: 'Invalid request.' },
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

  const recoveryCode =
    typeof body?.recoveryCode === 'string'
      ? body.recoveryCode
      : '';

  const newPassword =
    typeof body?.newPassword === 'string'
      ? body.newPassword
      : '';

  if (!email || !recoveryCode || !newPassword) {
    return Response.json(
      {
        ok: false,
        error: 'Email, recovery code, and new password are required.'
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
        error: 'New password must be at least 12 characters.'
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

  const emailHash =
    await hashCrewSecurityValue(email);
  const ipHash =
    await hashCrewLoginIp(request);
  const attemptId =
    crypto.randomUUID();

  try {
    await env.OBA_DB
      .prepare(`
        DELETE FROM crew_recovery_code_attempts
        WHERE attempted_at <
          datetime('now', '-' || ? || ' days')
      `)
      .bind(CREW_RECOVERY_ATTEMPT_RETENTION_DAYS)
      .run();
  } catch (cleanupError) {
    console.error('Crew recovery attempt cleanup failed.', {
      message:
        cleanupError instanceof Error
          ? cleanupError.message
          : 'Unknown cleanup error'
    });
  }

  const emailAttempts =
    await env.OBA_DB
      .prepare(`
        SELECT COUNT(*) AS attempt_count
        FROM crew_recovery_code_attempts
        WHERE email_hash = ?
          AND attempted_at >=
            datetime('now', '-' || ? || ' minutes')
      `)
      .bind(
        emailHash,
        CREW_RECOVERY_RATE_WINDOW_MINUTES
      )
      .first();

  let ipAttemptCount = 0;

  if (ipHash) {
    const ipAttempts =
      await env.OBA_DB
        .prepare(`
          SELECT COUNT(*) AS attempt_count
          FROM crew_recovery_code_attempts
          WHERE ip_hash = ?
            AND attempted_at >=
              datetime('now', '-' || ? || ' minutes')
        `)
        .bind(
          ipHash,
          CREW_RECOVERY_RATE_WINDOW_MINUTES
        )
        .first();

    ipAttemptCount =
      Number(ipAttempts?.attempt_count ?? 0);
  }

  await env.OBA_DB
    .prepare(`
      INSERT INTO crew_recovery_code_attempts (
        attempt_id,
        email_hash,
        ip_hash
      )
      VALUES (?, ?, ?)
    `)
    .bind(attemptId, emailHash, ipHash)
    .run();

  if (
    Number(emailAttempts?.attempt_count ?? 0) >=
      CREW_RECOVERY_MAX_EMAIL_ATTEMPTS ||
    ipAttemptCount >= CREW_RECOVERY_MAX_IP_ATTEMPTS
  ) {
    await recordCrewSecurityEvent(
      env,
      {
        eventType: 'account_recovery_rate_limited',
        ipHash
      }
    );

    return Response.json(
      {
        ok: false,
        error: 'Unable to verify that recovery code.'
      },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  const codeHash =
    await hashCrewRecoveryCode(recoveryCode);

  const recoveryRecord =
    await env.OBA_DB
      .prepare(`
        SELECT
          rc.recovery_code_id,
          rc.crew_user_id,
          u.password_hash,
          u.status
        FROM crew_recovery_codes rc
        INNER JOIN crew_users u
          ON u.crew_user_id = rc.crew_user_id
        WHERE u.email = ?
          AND rc.code_hash = ?
          AND rc.used_at IS NULL
          AND rc.revoked_at IS NULL
          AND u.status = 'active'
        LIMIT 1
      `)
      .bind(email, codeHash)
      .first();

  if (!recoveryRecord) {
    await recordCrewSecurityEvent(
      env,
      {
        eventType: 'account_recovery_failed',
        ipHash
      }
    );

    return Response.json(
      {
        ok: false,
        error: 'Unable to verify that recovery code.'
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

  const samePassword =
    await verifyCrewPassword(
      newPassword,
      recoveryRecord.password_hash
    );

  if (samePassword) {
    return Response.json(
      {
        ok: false,
        error: 'Choose a password different from your current password.'
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

  const passwordHash =
    await hashCrewPassword(newPassword);

  try {
    const recoveryBatchResults =
      await env.OBA_DB.batch([
      env.OBA_DB
        .prepare(`
          UPDATE crew_users
          SET
            password_hash = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE crew_user_id = ?
            AND EXISTS (
              SELECT 1
              FROM crew_recovery_codes
              WHERE recovery_code_id = ?
                AND crew_user_id = ?
                AND used_at IS NULL
                AND revoked_at IS NULL
            )
        `)
        .bind(
          passwordHash,
          recoveryRecord.crew_user_id,
          recoveryRecord.recovery_code_id,
          recoveryRecord.crew_user_id
        ),

      env.OBA_DB
        .prepare(`
          UPDATE crew_recovery_codes
          SET used_at = CURRENT_TIMESTAMP
          WHERE recovery_code_id = ?
            AND used_at IS NULL
            AND revoked_at IS NULL
        `)
        .bind(recoveryRecord.recovery_code_id),

      env.OBA_DB
        .prepare(`
          UPDATE crew_sessions
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE crew_user_id = ?
            AND revoked_at IS NULL
        `)
        .bind(recoveryRecord.crew_user_id),

      env.OBA_DB
        .prepare(`
          UPDATE crew_password_resets
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE crew_user_id = ?
            AND used_at IS NULL
            AND revoked_at IS NULL
        `)
        .bind(recoveryRecord.crew_user_id),

      env.OBA_DB
        .prepare(`
          UPDATE crew_recovery_code_attempts
          SET successful = 1
          WHERE attempt_id = ?
        `)
        .bind(attemptId)
    ]);

    const passwordUpdateChanges =
      Number(
        recoveryBatchResults?.[0]?.meta?.changes ??
        recoveryBatchResults?.[0]?.meta?.rows_written ??
        0
      );

    if (passwordUpdateChanges < 1) {
      return Response.json(
        {
          ok: false,
          error: 'Unable to verify that recovery code.'
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
  } catch (error) {
    console.error('Crew account recovery failed.', {
      crewUserId: Number(recoveryRecord.crew_user_id),
      message:
        error instanceof Error
          ? error.message
          : 'Unknown account recovery error'
    });

    return Response.json(
      { ok: false, error: 'Unable to recover this account.' },
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  await recordCrewSecurityEvent(
    env,
    {
      eventType: 'account_recovered_with_code',
      crewUserId: Number(recoveryRecord.crew_user_id),
      ipHash,
      details: {
        recoveryCodeId: recoveryRecord.recovery_code_id
      }
    }
  );

  return Response.json(
    {
      ok: true,
      recovered: true,
      authenticated: false
    },
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-store',
        'Set-Cookie': createExpiredCrewSessionCookie()
      }
    }
  );
}


/* =========================================
   CREW ACCESS — RBAC + INVITATIONS
========================================= */

if (url.pathname === '/crew/access') {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:corsHeaders});
  if (request.method !== 'GET') return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const crewSession = await getCrewSession(request, env);
  if (!crewSession) return Response.json({ok:false,error:'Authentication required.'},{status:401,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const denied = await requireCrewAccessPermission(env, crewSession, 'crew_access.view', corsHeaders);
  if (denied) return denied;
  const [roleRows, overrideRows] = await Promise.all([
    env.OBA_DB.prepare(`SELECT role, permission_key, allowed, updated_at FROM crew_role_permissions ORDER BY role, permission_key`).all(),
    env.OBA_DB.prepare(`SELECT crew_user_id, permission_key, override_value, reason, updated_at FROM crew_permission_overrides ORDER BY crew_user_id, permission_key`).all()
  ]);
  const effectivePermissions = await getCrewEffectivePermissions(env, crewSession);
  return Response.json({ok:true,permissionKeys:CREW_PERMISSION_KEYS,rolePermissions:roleRows.results||[],overrides:overrideRows.results||[],actor:{crewUserId:Number(crewSession.crewUserId),role:crewSession.role,effectivePermissions}}, {status:200,headers:{...corsHeaders,'Cache-Control':'no-store'}});
}

if (url.pathname === '/crew/role-permission') {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:corsHeaders});
  if (request.method !== 'POST') return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const crewSession=await getCrewSession(request,env);
  if(!crewSession) return Response.json({ok:false,error:'Authentication required.'},{status:401,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  if(String(crewSession.role).toLowerCase()!=='owner') return Response.json({ok:false,error:'Owner access is required to change role templates.'},{status:403,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  let body; try{body=await request.json();}catch{return Response.json({ok:false,error:'Invalid request.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}})}
  const role=String(body?.role||'').toLowerCase(), key=String(body?.permissionKey||'').trim(), allowed=body?.allowed===true||body?.allowed===1;
  if(!['crew','manager'].includes(role)||!CREW_PERMISSION_KEY_SET.has(key)) return Response.json({ok:false,error:'Invalid role or permission.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  await env.OBA_DB.prepare(`INSERT INTO crew_role_permissions(role,permission_key,allowed,updated_by_crew_user_id) VALUES(?,?,?,?) ON CONFLICT(role,permission_key) DO UPDATE SET allowed=excluded.allowed,updated_by_crew_user_id=excluded.updated_by_crew_user_id,updated_at=CURRENT_TIMESTAMP`).bind(role,key,allowed?1:0,Number(crewSession.crewUserId)).run();
  await recordCrewSecurityEvent(env,{eventType:'crew_role_permission_changed',crewUserId:Number(crewSession.crewUserId),details:{role,permissionKey:key,allowed}});
  return Response.json({ok:true,role,permissionKey:key,allowed},{status:200,headers:{...corsHeaders,'Cache-Control':'no-store'}});
}

if (url.pathname === '/crew/member-permissions') {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
  if(request.method!=='GET')return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const crewSession=await getCrewSession(request,env);if(!crewSession)return Response.json({ok:false,error:'Authentication required.'},{status:401,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const denied=await requireCrewAccessPermission(env,crewSession,'crew_access.view',corsHeaders);if(denied)return denied;
  const targetId=Number(url.searchParams.get('crewUserId'));if(!Number.isInteger(targetId)||targetId<1)return Response.json({ok:false,error:'A valid Crew member is required.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const target=await loadCrewTarget(env,targetId);if(!target)return Response.json({ok:false,error:'Crew member not found.'},{status:404,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const effectivePermissions=await getCrewEffectivePermissions(env,{crewUserId:targetId,role:target.role});
  const overrides=await env.OBA_DB.prepare(`SELECT permission_key,override_value,reason,updated_at FROM crew_permission_overrides WHERE crew_user_id=? ORDER BY permission_key`).bind(targetId).all();
  return Response.json({ok:true,user:{crewUserId:targetId,email:target.email,firstName:target.first_name,lastName:target.last_name,role:target.role,status:target.status},effectivePermissions,overrides:overrides.results||[]},{status:200,headers:{...corsHeaders,'Cache-Control':'no-store'}});
}

if (url.pathname === '/crew/member-permission') {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:corsHeaders});
  if (request.method !== 'POST') return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const crewSession=await getCrewSession(request,env);
  if(!crewSession) return Response.json({ok:false,error:'Authentication required.'},{status:401,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const denied=await requireCrewAccessPermission(env,crewSession,'crew.permissions',corsHeaders); if(denied)return denied;
  let body; try{body=await request.json();}catch{return Response.json({ok:false,error:'Invalid request.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}})}
  const targetId=Number(body?.crewUserId), key=String(body?.permissionKey||'').trim(), value=String(body?.overrideValue||'inherit').toLowerCase();
  if(!Number.isInteger(targetId)||targetId<1||!CREW_PERMISSION_KEY_SET.has(key)||!['inherit','allow','deny'].includes(value)) return Response.json({ok:false,error:'Invalid permission override.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const target=await loadCrewTarget(env,targetId); if(!canAdministerCrewTarget(crewSession,target)) return Response.json({ok:false,error:'You cannot change permissions for that account.'},{status:403,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  if(String(crewSession.role).toLowerCase()!=='owner' && value==='allow' && !(await hasCrewPermission(env,crewSession,key))) return Response.json({ok:false,error:'You cannot grant a permission you do not have.'},{status:403,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  if(value==='inherit') await env.OBA_DB.prepare(`DELETE FROM crew_permission_overrides WHERE crew_user_id=? AND permission_key=?`).bind(targetId,key).run();
  else await env.OBA_DB.prepare(`INSERT INTO crew_permission_overrides(crew_user_id,permission_key,override_value,updated_by_crew_user_id,reason) VALUES(?,?,?,?,?) ON CONFLICT(crew_user_id,permission_key) DO UPDATE SET override_value=excluded.override_value,updated_by_crew_user_id=excluded.updated_by_crew_user_id,reason=excluded.reason,updated_at=CURRENT_TIMESTAMP`).bind(targetId,key,value,Number(crewSession.crewUserId),cleanContactText(body?.reason,500)||null).run();
  await recordCrewSecurityEvent(env,{eventType:'crew_member_permission_changed',crewUserId:targetId,details:{initiatedByCrewUserId:Number(crewSession.crewUserId),permissionKey:key,overrideValue:value}});
  return Response.json({ok:true,crewUserId:targetId,permissionKey:key,overrideValue:value},{status:200,headers:{...corsHeaders,'Cache-Control':'no-store'}});
}

if (url.pathname === '/crew/member-role') {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
  if(request.method!=='POST')return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const crewSession=await getCrewSession(request,env); if(!crewSession)return Response.json({ok:false,error:'Authentication required.'},{status:401,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const denied=await requireCrewAccessPermission(env,crewSession,'crew.roles',corsHeaders);if(denied)return denied;
  let body;try{body=await request.json();}catch{return Response.json({ok:false,error:'Invalid request.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}})}
  const targetId=Number(body?.crewUserId),newRole=String(body?.role||'').toLowerCase();
  if(!Number.isInteger(targetId)||!['crew','manager'].includes(newRole))return Response.json({ok:false,error:'Invalid account or role.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const target=await loadCrewTarget(env,targetId);if(!canAdministerCrewTarget(crewSession,target))return Response.json({ok:false,error:'You cannot change that account role.'},{status:403,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  if(String(crewSession.role).toLowerCase()!=='owner'&&newRole!=='crew')return Response.json({ok:false,error:'Only the Owner can promote a Crew member to Manager.'},{status:403,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  await env.OBA_DB.prepare(`UPDATE crew_users SET role=?,updated_at=CURRENT_TIMESTAMP WHERE crew_user_id=? AND role!='owner'`).bind(newRole,targetId).run();
  await recordCrewSecurityEvent(env,{eventType:'crew_member_role_changed',crewUserId:targetId,details:{initiatedByCrewUserId:Number(crewSession.crewUserId),previousRole:target.role,newRole}});
  return Response.json({ok:true,crewUserId:targetId,role:newRole},{status:200,headers:{...corsHeaders,'Cache-Control':'no-store'}});
}

if (url.pathname === '/crew/member-status') {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
  if(request.method!=='POST')return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const crewSession=await getCrewSession(request,env);if(!crewSession)return Response.json({ok:false,error:'Authentication required.'},{status:401,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const denied=await requireCrewAccessPermission(env,crewSession,'crew.disable',corsHeaders);if(denied)return denied;
  let body;try{body=await request.json();}catch{return Response.json({ok:false,error:'Invalid request.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}})}
  const targetId=Number(body?.crewUserId),status=String(body?.status||'').toLowerCase();if(!Number.isInteger(targetId)||!['active','disabled'].includes(status))return Response.json({ok:false,error:'Invalid account status.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const target=await loadCrewTarget(env,targetId);if(!canAdministerCrewTarget(crewSession,target))return Response.json({ok:false,error:'You cannot change that account status.'},{status:403,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  await env.OBA_DB.batch([env.OBA_DB.prepare(`UPDATE crew_users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE crew_user_id=? AND role!='owner'`).bind(status,targetId),env.OBA_DB.prepare(`UPDATE crew_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE crew_user_id=? AND revoked_at IS NULL`).bind(targetId)]);
  await recordCrewSecurityEvent(env,{eventType:'crew_member_status_changed',crewUserId:targetId,details:{initiatedByCrewUserId:Number(crewSession.crewUserId),status}});
  return Response.json({ok:true,crewUserId:targetId,status},{status:200,headers:{...corsHeaders,'Cache-Control':'no-store'}});
}

async function sendCrewInvitationEmail(env, invitation, rawToken) {
  const inviteUrl='https://ollysbakedassortments.com/crew/accept-invite.html?token='+encodeURIComponent(rawToken);
  await sendOBAEmail(env,{to:invitation.email,subject:'You’re invited to OBA Cookie Crew',text:[`Hi ${invitation.firstName},`,'','You’ve been invited to join OBA Cookie Crew.',`Role: ${invitation.role === 'manager' ? 'Manager' : 'Crew'}`,'','Create your Crew password:',inviteUrl,'',`This invitation expires in ${CREW_INVITATION_TTL_DAYS} days and can only be used once.`].join('\n'),html:`<!doctype html><html><body style="margin:0;padding:0;background:#f7f1e7;font-family:Arial,Helvetica,sans-serif;color:#3a2a20"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #eadfce;border-radius:18px;padding:32px"><p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b674d">OBA Cookie Crew</p><h1 style="margin:0 0 18px;font-size:28px">You’re invited</h1><p style="font-size:16px;line-height:1.6">Hi ${escapeContactHtml(invitation.firstName)}, you’ve been invited to join OBA Cookie Crew as <strong>${invitation.role==='manager'?'Manager':'Crew'}</strong>.</p><p style="margin:24px 0"><a href="${inviteUrl}" style="display:inline-block;background:#5b3a29;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:999px">Create Crew Account</a></p><p style="font-size:14px;color:#6d594c">This invitation expires in ${CREW_INVITATION_TTL_DAYS} days and can only be used once.</p></div></div></body></html>`});
}

if (url.pathname === '/crew/invitations' || url.pathname === '/crew/invite') {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
  const crewSession=await getCrewSession(request,env);if(!crewSession)return Response.json({ok:false,error:'Authentication required.'},{status:401,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const denied=await requireCrewAccessPermission(env,crewSession,'crew.invite',corsHeaders);if(denied)return denied;
  if(request.method==='GET'){
    await env.OBA_DB.prepare(`UPDATE crew_invitations SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='pending' AND datetime(expires_at)<=datetime('now')`).run();
    const rows=await env.OBA_DB.prepare(`SELECT invitation_id,email,first_name,last_name,role,status,expires_at,accepted_at,revoked_at,created_at,updated_at,invited_by_crew_user_id FROM crew_invitations ORDER BY created_at DESC LIMIT 100`).all();
    return Response.json({ok:true,invitations:rows.results||[]},{status:200,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  }
  if(request.method!=='POST')return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  let body;try{body=await request.json();}catch{return Response.json({ok:false,error:'Invalid request.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}})}
  const email=cleanContactText(body?.email,254).toLowerCase(),firstName=cleanContactText(body?.firstName,80),lastName=cleanContactText(body?.lastName,80),role=String(body?.role||'crew').toLowerCase();
  if(!validateContactEmail(email)||!firstName||!lastName||!['crew','manager'].includes(role))return Response.json({ok:false,error:'Valid name, email, and role are required.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  if(role==='manager' && !(await hasCrewPermission(env,crewSession,'crew.invite_manager')))return Response.json({ok:false,error:'You do not have permission to invite Managers.'},{status:403,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const existing=await env.OBA_DB.prepare(`SELECT crew_user_id FROM crew_users WHERE lower(email)=lower(?) LIMIT 1`).bind(email).first();if(existing)return Response.json({ok:false,error:'A Crew account already exists for that email.'},{status:409,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  await env.OBA_DB.prepare(`UPDATE crew_invitations SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='pending' AND datetime(expires_at)<=datetime('now')`).run();
  const pending=await env.OBA_DB.prepare(`SELECT invitation_id FROM crew_invitations WHERE lower(email)=lower(?) AND status='pending' LIMIT 1`).bind(email).first();if(pending)return Response.json({ok:false,error:'A pending invitation already exists for that email.'},{status:409,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const rawToken=createCrewPasswordResetToken(),tokenHash=await hashCrewPasswordResetToken(rawToken),invitationId=crypto.randomUUID(),expiresAt=new Date(Date.now()+CREW_INVITATION_TTL_DAYS*86400000).toISOString();
  await env.OBA_DB.prepare(`INSERT INTO crew_invitations(invitation_id,email,first_name,last_name,role,token_hash,invited_by_crew_user_id,status,expires_at) VALUES(?,?,?,?,?,?,?,'pending',?)`).bind(invitationId,email,firstName,lastName,role,tokenHash,Number(crewSession.crewUserId),expiresAt).run();
  try{await sendCrewInvitationEmail(env,{email,firstName,lastName,role},rawToken);}catch(error){await env.OBA_DB.prepare(`UPDATE crew_invitations SET status='revoked',revoked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE invitation_id=?`).bind(invitationId).run();console.error('Crew invitation email failed:',error);return Response.json({ok:false,error:'The Crew invitation could not be delivered.'},{status:502,headers:{...corsHeaders,'Cache-Control':'no-store'}})}
  await recordCrewSecurityEvent(env,{eventType:'crew_invitation_sent',crewUserId:Number(crewSession.crewUserId),details:{invitationId,email,role,expiresAt}});
  return Response.json({ok:true,invitationId,email,role,expiresAt},{status:201,headers:{...corsHeaders,'Cache-Control':'no-store'}});
}

if (url.pathname === '/crew/invitation/resend') {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});if(request.method!=='POST')return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const crewSession=await getCrewSession(request,env);if(!crewSession)return Response.json({ok:false,error:'Authentication required.'},{status:401,headers:{...corsHeaders,'Cache-Control':'no-store'}});const denied=await requireCrewAccessPermission(env,crewSession,'crew.invite',corsHeaders);if(denied)return denied;
  let body;try{body=await request.json();}catch{return Response.json({ok:false,error:'Invalid request.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}})}const invitationId=String(body?.invitationId||'').trim();const invitation=await env.OBA_DB.prepare(`SELECT invitation_id,email,first_name,last_name,role,status FROM crew_invitations WHERE invitation_id=? LIMIT 1`).bind(invitationId).first();if(!invitation||invitation.status!=='pending')return Response.json({ok:false,error:'Pending invitation not found.'},{status:404,headers:{...corsHeaders,'Cache-Control':'no-store'}});if(invitation.role==='manager'&&!(await hasCrewPermission(env,crewSession,'crew.invite_manager')))return Response.json({ok:false,error:'You cannot manage Manager invitations.'},{status:403,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const rawToken=createCrewPasswordResetToken(),tokenHash=await hashCrewPasswordResetToken(rawToken),expiresAt=new Date(Date.now()+CREW_INVITATION_TTL_DAYS*86400000).toISOString();await env.OBA_DB.prepare(`UPDATE crew_invitations SET token_hash=?,expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE invitation_id=? AND status='pending'`).bind(tokenHash,expiresAt,invitationId).run();try{await sendCrewInvitationEmail(env,{email:invitation.email,firstName:invitation.first_name,lastName:invitation.last_name,role:invitation.role},rawToken);}catch(error){console.error('Crew invitation resend failed:',error);return Response.json({ok:false,error:'The Crew invitation could not be delivered.'},{status:502,headers:{...corsHeaders,'Cache-Control':'no-store'}})}await recordCrewSecurityEvent(env,{eventType:'crew_invitation_resent',crewUserId:Number(crewSession.crewUserId),details:{invitationId,email:invitation.email,role:invitation.role,expiresAt}});return Response.json({ok:true,invitationId,expiresAt},{status:200,headers:{...corsHeaders,'Cache-Control':'no-store'}});
}

if (url.pathname === '/crew/invitation/revoke') {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});if(request.method!=='POST')return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const crewSession=await getCrewSession(request,env);if(!crewSession)return Response.json({ok:false,error:'Authentication required.'},{status:401,headers:{...corsHeaders,'Cache-Control':'no-store'}});const denied=await requireCrewAccessPermission(env,crewSession,'crew.invite',corsHeaders);if(denied)return denied;
  let body;try{body=await request.json();}catch{return Response.json({ok:false,error:'Invalid request.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}})}const invitationId=String(body?.invitationId||'').trim();const invitation=await env.OBA_DB.prepare(`SELECT invitation_id,role,status FROM crew_invitations WHERE invitation_id=? LIMIT 1`).bind(invitationId).first();if(!invitation||invitation.status!=='pending')return Response.json({ok:false,error:'Pending invitation not found.'},{status:404,headers:{...corsHeaders,'Cache-Control':'no-store'}});if(invitation.role==='manager'&&String(crewSession.role).toLowerCase()!=='owner'&&!(await hasCrewPermission(env,crewSession,'crew.invite_manager')))return Response.json({ok:false,error:'You cannot manage Manager invitations.'},{status:403,headers:{...corsHeaders,'Cache-Control':'no-store'}});await env.OBA_DB.prepare(`UPDATE crew_invitations SET status='revoked',revoked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE invitation_id=? AND status='pending'`).bind(invitationId).run();return Response.json({ok:true,invitationId,status:'revoked'},{status:200,headers:{...corsHeaders,'Cache-Control':'no-store'}});
}

if (url.pathname === '/crew/invitation') {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});if(request.method!=='GET')return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'no-store'}});const token=String(url.searchParams.get('token')||'').trim();if(!token)return Response.json({ok:false,error:'Invitation token is required.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});const tokenHash=await hashCrewPasswordResetToken(token);const invitation=await env.OBA_DB.prepare(`SELECT invitation_id,email,first_name,last_name,role,expires_at FROM crew_invitations WHERE token_hash=? AND status='pending' AND datetime(expires_at)>datetime('now') LIMIT 1`).bind(tokenHash).first();if(!invitation)return Response.json({ok:false,error:'This invitation is invalid or has expired.'},{status:404,headers:{...corsHeaders,'Cache-Control':'no-store'}});return Response.json({ok:true,invitation:{invitationId:invitation.invitation_id,email:invitation.email,firstName:invitation.first_name,lastName:invitation.last_name,role:invitation.role,expiresAt:invitation.expires_at}},{status:200,headers:{...corsHeaders,'Cache-Control':'no-store'}});
}

if (url.pathname === '/crew/invitation/accept') {
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});if(request.method!=='POST')return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'no-store'}});let body;try{body=await request.json();}catch{return Response.json({ok:false,error:'Invalid request.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}})}const token=String(body?.token||'').trim(),password=typeof body?.password==='string'?body.password:'';if(!token||password.length<12)return Response.json({ok:false,error:'A valid invitation and password of at least 12 characters are required.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});const tokenHash=await hashCrewPasswordResetToken(token);const invitation=await env.OBA_DB.prepare(`SELECT invitation_id,email,first_name,last_name,role,expires_at FROM crew_invitations WHERE token_hash=? AND status='pending' AND datetime(expires_at)>datetime('now') LIMIT 1`).bind(tokenHash).first();if(!invitation)return Response.json({ok:false,error:'This invitation is invalid or has expired.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}});const existing=await env.OBA_DB.prepare(`SELECT crew_user_id FROM crew_users WHERE lower(email)=lower(?) LIMIT 1`).bind(invitation.email).first();if(existing)return Response.json({ok:false,error:'A Crew account already exists for this email.'},{status:409,headers:{...corsHeaders,'Cache-Control':'no-store'}});let passwordHash;try{passwordHash=await hashCrewPassword(password);}catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:'Unable to create account.'},{status:400,headers:{...corsHeaders,'Cache-Control':'no-store'}})}
  const userInsert=await env.OBA_DB.prepare(`INSERT INTO crew_users(email,password_hash,first_name,last_name,role,status) SELECT ?,?,?,?,?, 'active' WHERE EXISTS(SELECT 1 FROM crew_invitations WHERE invitation_id=? AND status='pending' AND datetime(expires_at)>datetime('now'))`).bind(invitation.email,passwordHash,invitation.first_name,invitation.last_name,invitation.role,invitation.invitation_id).run();if(Number(userInsert.meta?.changes||0)!==1)return Response.json({ok:false,error:'This invitation could not be accepted.'},{status:409,headers:{...corsHeaders,'Cache-Control':'no-store'}});const newUser=await env.OBA_DB.prepare(`SELECT crew_user_id FROM crew_users WHERE lower(email)=lower(?) LIMIT 1`).bind(invitation.email).first();await env.OBA_DB.prepare(`UPDATE crew_invitations SET status='accepted',accepted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE invitation_id=? AND status='pending'`).bind(invitation.invitation_id).run();await recordCrewSecurityEvent(env,{eventType:'crew_invitation_accepted',crewUserId:Number(newUser?.crew_user_id)||null,details:{invitationId:invitation.invitation_id,role:invitation.role}});return Response.json({ok:true,accepted:true},{status:201,headers:{...corsHeaders,'Cache-Control':'no-store'}});
}

/* =========================================
   CREW DIRECTORY + ADMINISTRATIVE RECOVERY
========================================= */

if (url.pathname === '/crew/users') {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return Response.json(
      { ok: false, error: 'Method Not Allowed' },
      { status: 405, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
    );
  }

  const crewSession = await getCrewSession(request, env);
  if (!crewSession) {
    return Response.json(
      { ok: false, error: 'Authentication required.' },
      { status: 401, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
    );
  }

  const crewAccessDenied = await requireCrewAccessPermission(
    env, crewSession, 'crew_access.view', corsHeaders
  );
  if (crewAccessDenied) return crewAccessDenied;

  const result = await env.OBA_DB.prepare(`
    SELECT crew_user_id, email, first_name, last_name, role, status,
           created_at, updated_at, last_login_at
    FROM crew_users
    ORDER BY
      CASE lower(role) WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END,
      lower(last_name), lower(first_name), lower(email)
  `).all();

  const actorRole = String(crewSession.role).toLowerCase();
  const actorId = Number(crewSession.crewUserId);
  const actorCanRecover = await hasCrewPermission(env, crewSession, 'crew.recover');

  const users = (result.results || []).map(row => {
    const targetRole = String(row.role || '').toLowerCase();
    const targetId = Number(row.crew_user_id);
    const canRecover =
      actorCanRecover &&
      targetId !== actorId &&
      row.status === 'active' &&
      (
        actorRole === 'owner'
          ? targetRole !== 'owner'
          : targetRole === 'crew'
      );

    return {
      crewUserId: targetId,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
      canRecover
    };
  });

  return Response.json(
    { ok: true, users },
    { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
  );
}

if (url.pathname === '/crew/admin-recovery') {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json(
      { ok: false, error: 'Method Not Allowed' },
      { status: 405, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
    );
  }

  const crewSession = await getCrewSession(request, env);
  if (!crewSession) {
    return Response.json(
      { ok: false, error: 'Authentication required.' },
      { status: 401, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
    );
  }

  const actorRole = String(crewSession.role || '').toLowerCase();
  const recoveryDenied = await requireCrewAccessPermission(
    env, crewSession, 'crew.recover', corsHeaders
  );
  if (recoveryDenied) return recoveryDenied;

  let body;
  try { body = await request.json(); }
  catch {
    return Response.json(
      { ok: false, error: 'Invalid request.' },
      { status: 400, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
    );
  }

  const targetCrewUserId = Number(body?.crewUserId);
  if (!Number.isInteger(targetCrewUserId) || targetCrewUserId <= 0) {
    return Response.json(
      { ok: false, error: 'A valid Crew member is required.' },
      { status: 400, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
    );
  }

  if (targetCrewUserId === Number(crewSession.crewUserId)) {
    return Response.json(
      { ok: false, error: 'Use Account Settings to recover your own account.' },
      { status: 400, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
    );
  }

  const target = await env.OBA_DB.prepare(`
    SELECT crew_user_id, email, first_name, last_name, role, status
    FROM crew_users
    WHERE crew_user_id = ?
    LIMIT 1
  `).bind(targetCrewUserId).first();

  if (!target || target.status !== 'active') {
    return Response.json(
      { ok: false, error: 'That Crew account is not available for recovery.' },
      { status: 404, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
    );
  }

  const targetRole = String(target.role || '').toLowerCase();
  const allowed = actorRole === 'owner'
    ? targetRole !== 'owner'
    : targetRole === 'crew';

  if (!allowed) {
    return Response.json(
      { ok: false, error: 'You do not have permission to recover that Crew account.' },
      { status: 403, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
    );
  }

  const resetToken = createCrewPasswordResetToken();
  const tokenHash = await hashCrewPasswordResetToken(resetToken);
  const resetId = crypto.randomUUID();
  const expiresAt = getCrewPasswordResetExpiry();
  const actorIpHash = await hashCrewLoginIp(request);

  try {
    await env.OBA_DB.batch([
      env.OBA_DB.prepare(`
        UPDATE crew_password_resets
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE crew_user_id = ?
          AND used_at IS NULL
          AND revoked_at IS NULL
      `).bind(targetCrewUserId),
      env.OBA_DB.prepare(`
        INSERT INTO crew_password_resets (
          reset_id, crew_user_id, token_hash, expires_at, requested_ip_hash
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(resetId, targetCrewUserId, tokenHash, expiresAt, actorIpHash)
    ]);
  } catch (error) {
    console.error('Administrative Crew recovery creation failed:', error);
    return Response.json(
      { ok: false, error: 'Unable to create the recovery invitation.' },
      { status: 500, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
    );
  }

  const resetUrl =
    'https://ollysbakedassortments.com/crew/reset-password.html?token=' +
    encodeURIComponent(resetToken);

  try {
    await sendOBAEmail(env, {
      to: target.email,
      subject: 'OBA Cookie Crew account recovery',
      text: [
        'OBA Cookie Crew account recovery', '',
        'An authorized OBA Crew administrator sent you a secure account recovery link.', '',
        'Use this link to choose a new password:', resetUrl, '',
        `This link expires in ${CREW_PASSWORD_RESET_TTL_MINUTES} minutes and can only be used once.`, '',
        'OBA staff cannot see or choose your password.',
        'If you were not expecting this message, contact the OBA owner.'
      ].join('\n'),
      html: `<!doctype html><html><body style="margin:0;padding:0;background:#f7f1e7;font-family:Arial,Helvetica,sans-serif;color:#3a2a20;"><div style="max-width:600px;margin:0 auto;padding:32px 20px;"><div style="background:#fff;border:1px solid #eadfce;border-radius:18px;padding:32px;"><p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b674d;">OBA Cookie Crew</p><h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#3a2a20;">Recover your Crew account</h1><p style="margin:0 0 22px;font-size:16px;line-height:1.6;">An authorized OBA Crew administrator sent you a secure account recovery link.</p><p style="margin:0 0 24px;"><a href="${resetUrl}" style="display:inline-block;background:#5b3a29;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:999px;">Choose a New Password</a></p><p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#6d594c;">This link expires in ${CREW_PASSWORD_RESET_TTL_MINUTES} minutes and can only be used once.</p><p style="margin:0;font-size:14px;line-height:1.6;color:#6d594c;">OBA staff cannot see or choose your password. If you were not expecting this message, contact the OBA owner.</p></div></div></body></html>`
    });
  } catch (error) {
    console.error('Administrative Crew recovery email failed:', error);
    await env.OBA_DB.prepare(`
      UPDATE crew_password_resets
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE reset_id = ? AND used_at IS NULL AND revoked_at IS NULL
    `).bind(resetId).run();

    await recordCrewSecurityEvent(env, {
      eventType: 'admin_recovery_email_delivery_failed',
      crewUserId: targetCrewUserId,
      resetId,
      ipHash: actorIpHash,
      details: { initiatedByCrewUserId: Number(crewSession.crewUserId) }
    });

    return Response.json(
      { ok: false, error: 'The recovery invitation could not be delivered.' },
      { status: 502, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
    );
  }

  await recordCrewSecurityEvent(env, {
    eventType: 'admin_recovery_invitation_sent',
    crewUserId: targetCrewUserId,
    resetId,
    ipHash: actorIpHash,
    details: {
      initiatedByCrewUserId: Number(crewSession.crewUserId),
      initiatedByRole: actorRole,
      targetRole,
      expiresAt
    }
  });

  return Response.json(
    {
      ok: true,
      message: 'Recovery invitation sent.',
      expiresAt
    },
    { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } }
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
   * From this point forward, every validly formed
   * request receives the same public response.
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

  const requestId =
    crypto.randomUUID();

  const emailHash =
    await hashCrewSecurityValue(email);

  const requestedIpHash =
    await hashCrewLoginIp(request);

  /*
   * Best-effort retention cleanup. This removes old
   * request/audit material without ever storing raw
   * reset tokens.
   */
  try {
    await env.OBA_DB.batch([
      env.OBA_DB
        .prepare(`
          DELETE FROM crew_password_reset_attempts
          WHERE attempted_at <
            datetime(
              'now',
              '-' || ? || ' days'
            )
        `)
        .bind(
          CREW_PASSWORD_RESET_ATTEMPT_RETENTION_DAYS
        ),

      env.OBA_DB
        .prepare(`
          DELETE FROM crew_password_resets
          WHERE created_at <
            datetime(
              'now',
              '-' || ? || ' days'
            )
            AND (
              used_at IS NOT NULL
              OR revoked_at IS NOT NULL
              OR datetime(expires_at) <=
                 datetime('now')
            )
        `)
        .bind(
          CREW_PASSWORD_RESET_RECORD_RETENTION_DAYS
        )
    ]);
  } catch (cleanupError) {
    console.error(
      'Crew password reset cleanup failed:',
      cleanupError
    );
  }

  const recentEmailRequests =
    await env.OBA_DB
      .prepare(`
        SELECT COUNT(*) AS request_count
        FROM crew_password_reset_attempts
        WHERE email_hash = ?
          AND attempted_at >=
            datetime(
              'now',
              '-' || ? || ' minutes'
            )
      `)
      .bind(
        emailHash,
        CREW_PASSWORD_RESET_RATE_WINDOW_MINUTES
      )
      .first();

  let recentIpRequestCount = 0;

  if (requestedIpHash) {
    const recentIpRequests =
      await env.OBA_DB
        .prepare(`
          SELECT COUNT(*) AS request_count
          FROM crew_password_reset_attempts
          WHERE ip_hash = ?
            AND attempted_at >=
              datetime(
                'now',
                '-' || ? || ' minutes'
              )
        `)
        .bind(
          requestedIpHash,
          CREW_PASSWORD_RESET_RATE_WINDOW_MINUTES
        )
        .first();

    recentIpRequestCount =
      Number(
        recentIpRequests?.request_count ?? 0
      );
  }

  const emailRequestCount =
    Number(
      recentEmailRequests?.request_count ?? 0
    );

  await env.OBA_DB
    .prepare(`
      INSERT INTO crew_password_reset_attempts (
        request_id,
        email_hash,
        ip_hash
      )
      VALUES (?, ?, ?)
    `)
    .bind(
      requestId,
      emailHash,
      requestedIpHash
    )
    .run();

  if (
    emailRequestCount >=
      CREW_PASSWORD_RESET_MAX_EMAIL_REQUESTS ||
    recentIpRequestCount >=
      CREW_PASSWORD_RESET_MAX_IP_REQUESTS
  ) {
    await recordCrewSecurityEvent(
      env,
      {
        eventType:
          'password_reset_rate_limited',
        ipHash: requestedIpHash
      }
    );

    return genericResponse();
  }

  /*
   * A reset may be requested with either the primary
   * Crew email or a verified backup recovery email.
   * The public response remains identical either way.
   */
  const crewUser =
    await env.OBA_DB
      .prepare(`
        SELECT
          cu.crew_user_id,
          cu.email,
          cu.status,
          CASE
            WHEN lower(cu.email) = ? THEN cu.email
            WHEN lower(cre.recovery_email) = ?
              AND cre.verified_at IS NOT NULL
              THEN cre.recovery_email
            ELSE NULL
          END AS recovery_destination
        FROM crew_users cu
        LEFT JOIN crew_recovery_emails cre
          ON cre.crew_user_id = cu.crew_user_id
        WHERE lower(cu.email) = ?
           OR (
             lower(cre.recovery_email) = ?
             AND cre.verified_at IS NOT NULL
           )
        LIMIT 1
      `)
      .bind(email, email, email, email)
      .first();

  const eligibleAccount =
    Boolean(
      crewUser &&
      crewUser.status === 'active' &&
      crewUser.recovery_destination
    );

  await env.OBA_DB
    .prepare(`
      UPDATE crew_password_reset_attempts
      SET eligible_account = ?
      WHERE request_id = ?
    `)
    .bind(
      eligibleAccount ? 1 : 0,
      requestId
    )
    .run();

  await recordCrewSecurityEvent(
    env,
    {
      eventType:
        'password_reset_requested',
      crewUserId:
        eligibleAccount
          ? Number(crewUser.crew_user_id)
          : null,
      ipHash: requestedIpHash
    }
  );

  if (!eligibleAccount) {
    return genericResponse();
  }

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

  try {
    await env.OBA_DB.batch([
      env.OBA_DB
        .prepare(`
          UPDATE crew_password_resets
          SET revoked_at = CURRENT_TIMESTAMP
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

    return genericResponse();
  }

  await recordCrewSecurityEvent(
    env,
    {
      eventType:
        'password_reset_token_issued',
      crewUserId:
        Number(crewUser.crew_user_id),
      resetId,
      ipHash: requestedIpHash,
      details: {
        expiresAt,
        destinationType:
          String(crewUser.recovery_destination).toLowerCase() ===
          String(crewUser.email).toLowerCase()
            ? 'primary'
            : 'backup'
      }
    }
  );

  const resetUrl =
    'https://ollysbakedassortments.com/crew/reset-password.html' +
    '?token=' +
    encodeURIComponent(resetToken);


  /* =========================================
     SEND RESET EMAIL
  ========================================== */

  try {

    await sendOBAEmail(
      env,
      {
        to: crewUser.recovery_destination,

        subject:
          'Reset your OBA Cookie Crew password',

        text: [
          'OBA Cookie Crew password reset',
          '',
          'A password reset was requested for your Cookie Crew account.',
          '',
          'Use this secure link to choose a new password:',
          resetUrl,
          '',
          `This link expires in ${CREW_PASSWORD_RESET_TTL_MINUTES} minutes and can only be used once.`,
          '',
          'If you did not request this reset, you can ignore this email.'
        ].join('\n'),

        html: `
          <!doctype html>
          <html>
            <body style="margin:0;padding:0;background:#f7f1e7;font-family:Arial,Helvetica,sans-serif;color:#3a2a20;">
              <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
                <div style="background:#ffffff;border:1px solid #eadfce;border-radius:18px;padding:32px;">
                  <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b674d;">
                    OBA Cookie Crew
                  </p>

                  <h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#3a2a20;">
                    Reset your password
                  </h1>

                  <p style="margin:0 0 22px;font-size:16px;line-height:1.6;">
                    A password reset was requested for your Cookie Crew account.
                  </p>

                  <p style="margin:0 0 24px;">
                    <a
                      href="${resetUrl}"
                      style="display:inline-block;background:#5b3a29;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:999px;"
                    >
                      Reset Cookie Crew Password
                    </a>
                  </p>

                  <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#6d594c;">
                    This link expires in ${CREW_PASSWORD_RESET_TTL_MINUTES} minutes and can only be used once.
                  </p>

                  <p style="margin:0;font-size:14px;line-height:1.6;color:#6d594c;">
                    If you did not request this reset, you can ignore this email.
                  </p>
                </div>
              </div>
            </body>
          </html>
        `
      }
    );

    await env.OBA_DB
      .prepare(`
        UPDATE crew_password_reset_attempts
        SET email_sent = 1
        WHERE request_id = ?
      `)
      .bind(requestId)
      .run();

    await recordCrewSecurityEvent(
      env,
      {
        eventType: 'password_reset_email_sent',
        crewUserId:
          Number(crewUser.crew_user_id),
        resetId,
        ipHash: requestedIpHash
      }
    );

    console.log(
      'Crew password reset email sent.',
      {
        resetId,
        crewUserId:
          Number(crewUser.crew_user_id),
        expiresAt
      }
    );

  } catch (error) {

    console.error(
      'Crew password reset email delivery failed.',
      {
        resetId,
        crewUserId:
          Number(crewUser.crew_user_id),
        message:
          error instanceof Error
            ? error.message
            : 'Unknown email delivery error'
      }
    );

    await recordCrewSecurityEvent(
      env,
      {
        eventType:
          'password_reset_email_delivery_failed',
        crewUserId:
          Number(crewUser.crew_user_id),
        resetId,
        ipHash: requestedIpHash
      }
    );

    /*
     * A reset link that was not delivered must not
     * remain active in D1.
     */
    try {
      await env.OBA_DB
        .prepare(`
          UPDATE crew_password_resets

          SET
            revoked_at = CURRENT_TIMESTAMP

          WHERE reset_id = ?
            AND used_at IS NULL
            AND revoked_at IS NULL
        `)
        .bind(resetId)
        .run();

    } catch (revokeError) {
      console.error(
        'Crew password reset revoke-after-email-failure failed:',
        {
          resetId,
          message:
            revokeError instanceof Error
              ? revokeError.message
              : 'Unknown reset revoke error'
        }
      );
    }

    /*
     * Keep the public response generic so delivery
     * failures cannot be used for account enumeration.
     */
    return genericResponse();
  }


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
    await recordCrewSecurityEvent(
      env,
      {
        eventType:
          'password_reset_invalid_token',
        ipHash:
          await hashCrewLoginIp(request)
      }
    );

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


  await recordCrewSecurityEvent(
    env,
    {
      eventType:
        'password_reset_completed',
      crewUserId:
        Number(resetRecord.crew_user_id),
      resetId:
        resetRecord.reset_id,
      ipHash:
        await hashCrewLoginIp(request)
    }
  );

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


  /* =========================================
     REQUIRE CREW PERMISSION
  ========================================== */

  const permissionDenied =
    await requireCrewPermission(
      env,
      crewSession,
      'inventory.view'
    );

  if (permissionDenied) {
    return permissionDenied;
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


/* =========================================
   PUBLIC REVIEWS API
   Published-only, presentation-safe data.
========================================= */

if (url.pathname === '/reviews/public') {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:corsHeaders});
  if (request.method !== 'GET') return Response.json({ok:false,error:'Method Not Allowed'},{status:405,headers:{...corsHeaders,'Cache-Control':'public, max-age=60'}});

  const publicHeaders={...corsHeaders,'Cache-Control':'public, max-age=120, s-maxage=300','Content-Type':'application/json; charset=utf-8'};
  try {
    // Keep the public query deliberately simple and D1-safe. Relationships and
    // images are fetched separately rather than through correlated JSON SQL so
    // one presentation field cannot take down the entire public review feed.
    const [reviewRows, linkRows, imageRows, stats, cookieRows] = await Promise.all([
      env.OBA_DB.prepare(`SELECT review_pk,review_id,reviewer_name,rating,review_type,original_review_text,review_date,source,source_url,featured_priority
        FROM reviews WHERE status='published'
        ORDER BY featured_priority DESC,review_date DESC,review_pk DESC`).all(),
      env.OBA_DB.prepare(`SELECT l.review_id,l.cookie_id
        FROM review_cookie_links l JOIN reviews r ON r.review_id=l.review_id
        WHERE r.status='published'
        ORDER BY l.review_id,l.cookie_id`).all(),
      env.OBA_DB.prepare(`SELECT i.review_id,i.image_path,i.sort_order
        FROM review_images i JOIN reviews r ON r.review_id=i.review_id
        WHERE r.status='published'
        ORDER BY i.review_id,i.sort_order,i.image_path`).all(),
      env.OBA_DB.prepare(`SELECT
        COUNT(*) review_count,
        ROUND(AVG(rating),2) average_rating,
        SUM(CASE WHEN rating=5 THEN 1 ELSE 0 END) five_star_count,
        ROUND(100.0*SUM(CASE WHEN rating=5 THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0),1) five_star_percentage,
        SUM(CASE WHEN original_review_text IS NOT NULL AND trim(original_review_text)<>'' THEN 1 ELSE 0 END) written_review_count,
        SUM(CASE WHEN source='google' THEN 1 ELSE 0 END) google_review_count,
        SUM(CASE WHEN source='hotplate' THEN 1 ELSE 0 END) hotplate_review_count,
        SUM(CASE WHEN review_type='cookie' THEN 1 ELSE 0 END) cookie_review_count,
        (SELECT COUNT(DISTINCT l.cookie_id) FROM review_cookie_links l JOIN reviews pr ON pr.review_id=l.review_id WHERE pr.status='published') distinct_cookies_reviewed,
        MAX(review_date) latest_review_date
        FROM reviews WHERE status='published'`).first(),
      env.OBA_DB.prepare(`SELECT l.cookie_id,COUNT(*) review_count,ROUND(AVG(r.rating),2) average_rating,
        SUM(CASE WHEN r.rating=5 THEN 1 ELSE 0 END) five_star_count,MAX(r.review_date) latest_review_date
        FROM review_cookie_links l JOIN reviews r ON r.review_id=l.review_id
        WHERE r.status='published' GROUP BY l.cookie_id ORDER BY review_count DESC,average_rating DESC,l.cookie_id`).all()
    ]);

    const cookiesById=new Map(REVIEW_COOKIE_CATALOG.map(c=>[c.cookieId,c]));
    const cookieIdsByReview=new Map();
    for (const row of (linkRows.results||[])) {
      if (!cookieIdsByReview.has(row.review_id)) cookieIdsByReview.set(row.review_id,[]);
      cookieIdsByReview.get(row.review_id).push(row.cookie_id);
    }
    const imagePathsByReview=new Map();
    for (const row of (imageRows.results||[])) {
      if (!imagePathsByReview.has(row.review_id)) imagePathsByReview.set(row.review_id,[]);
      imagePathsByReview.get(row.review_id).push(row.image_path);
    }

    const reviews=(reviewRows.results||[]).map(row=>({
      reviewId:row.review_id,
      reviewerDisplayName:row.reviewer_name,
      rating:Number(row.rating),
      reviewType:row.review_type,
      reviewText:row.original_review_text||null,
      reviewDate:row.review_date,
      source:row.source,
      sourceUrl:row.source_url||null,
      featuredPriority:Number(row.featured_priority||0),
      cookies:(cookieIdsByReview.get(row.review_id)||[]).map(id=>cookiesById.get(id)).filter(Boolean),
      imagePaths:imagePathsByReview.get(row.review_id)||[]
    }));
    const cookies=(cookieRows.results||[]).map(row=>({
      cookie:cookiesById.get(row.cookie_id)||{cookieId:row.cookie_id,name:row.cookie_id,slug:''},
      reviewCount:Number(row.review_count||0),averageRating:Number(row.average_rating||0),
      fiveStarCount:Number(row.five_star_count||0),latestReviewDate:row.latest_review_date||null
    }));
    return new Response(JSON.stringify({ok:true,stats:{
      reviewCount:Number(stats?.review_count||0),averageRating:Number(stats?.average_rating||0),fiveStarCount:Number(stats?.five_star_count||0),
      fiveStarPercentage:Number(stats?.five_star_percentage||0),writtenReviewCount:Number(stats?.written_review_count||0),
      googleReviewCount:Number(stats?.google_review_count||0),hotplateReviewCount:Number(stats?.hotplate_review_count||0),
      cookieReviewCount:Number(stats?.cookie_review_count||0),distinctCookiesReviewed:Number(stats?.distinct_cookies_reviewed||0),latestReviewDate:stats?.latest_review_date||null
    },cookies,reviews}),{status:200,headers:publicHeaders});
  } catch (error) {
    console.error('Public reviews API failed',error);
    return new Response(JSON.stringify({ok:false,error:'Review data is temporarily unavailable.'}),{status:500,headers:{...publicHeaders,'Cache-Control':'no-store'}});
  }
}

/* =========================================
   CREW REVIEWS MANAGER API
========================================= */

if (url.pathname.startsWith('/crew/reviews')) {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:corsHeaders});
  const crewSession = await getCrewSession(request,env);
  if (!crewSession) return Response.json({ok:false,error:'Authentication required.'},{status:401,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const permissions = await getCrewEffectivePermissions(env,crewSession);
  const deny = key => !permissions[key] && String(crewSession.role).toLowerCase() !== 'owner';
  const json = (data,status=200) => Response.json(data,{status,headers:{...corsHeaders,'Cache-Control':'no-store'}});
  const actorId = Number(crewSession.crewUserId);

  if (url.pathname === '/crew/reviews/cookies') {
    if (request.method !== 'GET') return json({ok:false,error:'Method Not Allowed'},405);
    if (deny('reviews.view')) return json({ok:false,error:'You do not have permission to view Reviews.'},403);
    return json({ok:true,cookies:REVIEW_COOKIE_CATALOG});
  }

  if (url.pathname === '/crew/reviews/overview') {
    if (request.method !== 'GET') return json({ok:false,error:'Method Not Allowed'},405);
    if (deny('reviews.view')) return json({ok:false,error:'You do not have permission to view Reviews.'},403);
    const sharedQueueSql = ` AND r.access_scope='shared'`;
    const [counts, mine, team, stats, myQueueRows, teamQueueRows] = await Promise.all([
      env.OBA_DB.prepare(`SELECT status,COUNT(*) count FROM reviews GROUP BY status`).all(),
      env.OBA_DB.prepare(`SELECT status,COUNT(*) count FROM reviews WHERE imported_by_crew_user_id=? OR finalized_by_crew_user_id=? GROUP BY status`).bind(actorId,actorId).all(),
      env.OBA_DB.prepare(`SELECT status,COUNT(*) count FROM reviews r WHERE status IN ('final','verified')${sharedQueueSql} GROUP BY status`).all(),
      env.OBA_DB.prepare(`SELECT
        SUM(CASE WHEN status IN ('final','verified','published') THEN 1 ELSE 0 END) final_count,
        AVG(CASE WHEN status IN ('final','verified','published') THEN rating END) final_avg,
        SUM(CASE WHEN status IN ('verified','published') THEN 1 ELSE 0 END) verified_count,
        AVG(CASE WHEN status IN ('verified','published') THEN rating END) verified_avg,
        SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) published_count,
        AVG(CASE WHEN status='published' THEN rating END) published_avg
        FROM reviews`).first(),
      env.OBA_DB.prepare(`SELECT r.review_id,r.reviewer_name,r.rating,r.source,r.status,r.queue_entered_at,r.updated_at FROM reviews r WHERE r.status!='trash' AND (r.imported_by_crew_user_id=? OR r.finalized_by_crew_user_id=?) ORDER BY CASE r.status WHEN 'rough' THEN 1 WHEN 'final' THEN 2 WHEN 'verified' THEN 3 ELSE 4 END,coalesce(r.queue_entered_at,r.updated_at) ASC,r.review_pk ASC LIMIT 100`).bind(actorId,actorId).all(),
      env.OBA_DB.prepare(`SELECT r.review_id,r.reviewer_name,r.rating,r.source,r.status,r.access_scope,r.queue_entered_at,r.updated_at FROM reviews r WHERE r.status IN ('rough','final','verified')${sharedQueueSql} ORDER BY CASE r.status WHEN 'final' THEN 1 WHEN 'verified' THEN 2 WHEN 'rough' THEN 3 ELSE 4 END,coalesce(r.queue_entered_at,r.updated_at) ASC,r.review_pk ASC LIMIT 150`).all()
    ]);
    return json({ok:true,counts:counts.results||[],myCounts:mine.results||[],teamCounts:team.results||[],stats,myQueue:myQueueRows.results||[],teamQueue:teamQueueRows.results||[],trashVisible:permissions['reviews.trash_view']===true||['owner','manager'].includes(String(crewSession.role).toLowerCase())});
  }

  if (url.pathname === '/crew/reviews/stats') {
    if (request.method !== 'GET') return json({ok:false,error:'Method Not Allowed'},405);
    if (deny('reviews.view')) return json({ok:false,error:'You do not have permission to view Reviews.'},403);
    const scopes = await env.OBA_DB.prepare(`SELECT
      SUM(CASE WHEN status IN ('final','verified','published') THEN 1 ELSE 0 END) final_count,
      ROUND(AVG(CASE WHEN status IN ('final','verified','published') THEN rating END),2) final_avg,
      SUM(CASE WHEN status IN ('verified','published') THEN 1 ELSE 0 END) verified_count,
      ROUND(AVG(CASE WHEN status IN ('verified','published') THEN rating END),2) verified_avg,
      SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) published_count,
      ROUND(AVG(CASE WHEN status='published' THEN rating END),2) published_avg,
      SUM(CASE WHEN status='published' AND rating=5 THEN 1 ELSE 0 END) published_five_star,
      SUM(CASE WHEN status='published' AND original_review_text IS NOT NULL THEN 1 ELSE 0 END) published_written,
      SUM(CASE WHEN status='published' AND source='google' THEN 1 ELSE 0 END) published_google,
      SUM(CASE WHEN status='published' AND source='hotplate' THEN 1 ELSE 0 END) published_hotplate
      FROM reviews`).first();
    const cookieRows = await env.OBA_DB.prepare(`SELECT l.cookie_id,
      SUM(CASE WHEN r.status='published' THEN 1 ELSE 0 END) public_count,
      ROUND(AVG(CASE WHEN r.status='published' THEN r.rating END),2) public_avg,
      SUM(CASE WHEN r.status IN ('verified','published') THEN 1 ELSE 0 END) verified_count,
      ROUND(AVG(CASE WHEN r.status IN ('verified','published') THEN r.rating END),2) verified_avg,
      SUM(CASE WHEN r.status IN ('final','verified','published') THEN 1 ELSE 0 END) final_count,
      ROUND(AVG(CASE WHEN r.status IN ('final','verified','published') THEN r.rating END),2) final_avg,
      MAX(CASE WHEN r.status IN ('final','verified','published') THEN r.review_date END) latest_review_date
      FROM review_cookie_links l JOIN reviews r ON r.review_id=l.review_id WHERE r.status!='trash' GROUP BY l.cookie_id ORDER BY l.cookie_id`).all();
    return json({ok:true,scopes,cookies:(cookieRows.results||[]).map(row=>({...row,cookie:REVIEW_COOKIE_CATALOG.find(c=>c.cookieId===row.cookie_id)||{cookieId:row.cookie_id,name:row.cookie_id,slug:''}}))});
  }

  if (url.pathname === '/crew/reviews/audit') {
    if (request.method !== 'GET') return json({ok:false,error:'Method Not Allowed'},405);
    if (deny('reviews.view_audit')) return json({ok:false,error:'You do not have permission to view Review audit history.'},403);
    const reviewId = cleanContactText(url.searchParams.get('reviewId'),20).toUpperCase();
    const rows = await env.OBA_DB.prepare(`SELECT a.*,trim(coalesce(u.first_name,'')||' '||coalesce(u.last_name,'')) actor_name,u.email actor_email FROM review_audit_events a LEFT JOIN crew_users u ON u.crew_user_id=a.performed_by_crew_user_id WHERE (?='' OR a.review_id=?) ORDER BY a.performed_at DESC,a.event_id DESC LIMIT 250`).bind(reviewId,reviewId).all();
    return json({ok:true,events:(rows.results||[]).map(row=>({...row,beforeData:reviewJson(row.before_data),afterData:reviewJson(row.after_data)}))});
  }

  if (url.pathname === '/crew/reviews') {
    if (request.method !== 'GET') return json({ok:false,error:'Method Not Allowed'},405);
    if (deny('reviews.view')) return json({ok:false,error:'You do not have permission to view Reviews.'},403);
    const status = String(url.searchParams.get('status')||'active').toLowerCase();
    if (status==='trash' && deny('reviews.trash_view')) return json({ok:false,error:'You do not have permission to view Trash.'},403);
    const baseWhere = status==='trash' ? `r.status='trash'` : status==='all' ? `r.status!='trash'` : REVIEW_STATUSES.has(status) ? `r.status=?` : `r.status!='trash'`;
    const where = baseWhere;
    const query = `SELECT r.*,
      trim(coalesce(i.first_name,'')||' '||coalesce(i.last_name,'')) imported_by_name,
      trim(coalesce(u.first_name,'')||' '||coalesce(u.last_name,'')) updated_by_name,
      trim(coalesce(f.first_name,'')||' '||coalesce(f.last_name,'')) finalized_by_name,
      trim(coalesce(v.first_name,'')||' '||coalesce(v.last_name,'')) verified_by_name,
      trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) published_by_name,
      (SELECT json_group_array(cookie_id) FROM review_cookie_links l WHERE l.review_id=r.review_id) cookie_ids_json,
      NULL cookie_names_json
      FROM reviews r
      LEFT JOIN crew_users i ON i.crew_user_id=r.imported_by_crew_user_id
      LEFT JOIN crew_users u ON u.crew_user_id=r.updated_by_crew_user_id
      LEFT JOIN crew_users f ON f.crew_user_id=r.finalized_by_crew_user_id
      LEFT JOIN crew_users v ON v.crew_user_id=r.verified_by_crew_user_id
      LEFT JOIN crew_users p ON p.crew_user_id=r.published_by_crew_user_id
      WHERE ${where} ORDER BY CASE r.status WHEN 'final' THEN 1 WHEN 'verified' THEN 2 WHEN 'rough' THEN 3 WHEN 'published' THEN 4 ELSE 5 END,coalesce(r.queue_entered_at,r.updated_at) ASC,r.review_pk ASC LIMIT 500`;
    const result = status!=='active' && status!=='all' && status!=='trash' && REVIEW_STATUSES.has(status) ? await env.OBA_DB.prepare(query).bind(status).all() : await env.OBA_DB.prepare(query).all();
    const reviews=(result.results||[]).map(reviewRowToPublicShape).map(item=>({...item,cookieNames:item.cookieIds.map(id=>REVIEW_COOKIE_CATALOG.find(c=>c.cookieId===id)?.name||id)}));
    return json({ok:true,reviews,permissions,actor:{crewUserId:actorId,role:crewSession.role}});
  }

  if (url.pathname === '/crew/reviews/record') {
    if (request.method !== 'GET') return json({ok:false,error:'Method Not Allowed'},405);
    if (deny('reviews.view')) return json({ok:false,error:'You do not have permission to view Reviews.'},403);
    const reviewId=cleanContactText(url.searchParams.get('reviewId'),20).toUpperCase();
    const row=await loadReviewRecord(env,reviewId); if(!row) return json({ok:false,error:'Review not found.'},404);
    if(row.status==='trash' && deny('reviews.trash_view')) return json({ok:false,error:'Review not found.'},404);
    if(row.status!=='trash' && !reviewCanSeeRecord(crewSession,row)) return json({ok:false,error:'Review not found.'},404);
    const review=reviewRowToPublicShape(row); review.cookieNames=review.cookieIds.map(id=>REVIEW_COOKIE_CATALOG.find(c=>c.cookieId===id)?.name||id);
    return json({ok:true,review,canEdit:reviewCanEditActive(crewSession,permissions,row),canChangeAccess:reviewCanChangeAccess(crewSession,row),permissions});
  }

  if (url.pathname === '/crew/reviews/import') {
    if (request.method !== 'POST') return json({ok:false,error:'Method Not Allowed'},405);
    if (deny('reviews.import')) return json({ok:false,error:'You do not have permission to import Reviews.'},403);
    let body; try{body=await request.json()}catch{return json({ok:false,error:'Invalid request.'},400)}
    const input=normalizeReviewInput(body); const warnings=await reviewDuplicateWarnings(env,input);
    if(warnings.some(w=>w.severity==='error')) return json({ok:false,error:warnings[0].message,warnings},409);
    const possibleDuplicate=warnings.find(w=>w.code==='possible_duplicate');
    if(possibleDuplicate && body?.duplicateAcknowledged!==true) return json({ok:false,error:possibleDuplicate.message,code:'POSSIBLE_DUPLICATE',warnings},409);
    const sequence=await env.OBA_DB.prepare(`UPDATE review_sequences SET next_number=next_number+1 WHERE sequence_key='reviews' RETURNING next_number-1 AS review_number`).first();
    const reviewNumber=Number(sequence?.review_number);
    if(!Number.isInteger(reviewNumber)||reviewNumber<1) return json({ok:false,error:'Unable to allocate a Review ID.'},500);
    const reviewId=`REV-${String(reviewNumber).padStart(3,'0')}`;
    const accessScope=String(crewSession.role||'').toLowerCase()==='crew'?'shared':'private';
    await env.OBA_DB.prepare(`INSERT INTO reviews(review_id,reviewer_name,rating,review_type,original_review_text,review_date,source,source_url,status,featured_priority,internal_notes,access_scope,imported_by_crew_user_id,updated_by_crew_user_id) VALUES(?,?,?,?,?,?,?,?,'rough',?,?,?,?,?)`).bind(reviewId,input.reviewerName||null,input.rating,input.reviewType||null,input.originalReviewText,input.reviewDate||null,input.source||null,input.sourceUrl,input.featuredPriority,input.internalNotes,accessScope,actorId,actorId).run();
    await replaceReviewCookieLinks(env,reviewId,input.cookieIds,actorId);
    await replaceReviewImages(env,reviewId,input.imagePaths,actorId);
    await recordReviewAudit(env,{reviewId,action:'IMPORTED',actorId,toStatus:'rough',afterData:input});
    return json({ok:true,reviewId,status:'rough',warnings},201);
  }

  if (url.pathname === '/crew/reviews/access') {
    if (request.method !== 'POST') return json({ok:false,error:'Method Not Allowed'},405);
    let body; try{body=await request.json()}catch{return json({ok:false,error:'Invalid request.'},400)}
    const reviewId=cleanContactText(body?.reviewId,20).toUpperCase(), expectedVersion=Number(body?.recordVersion), note=cleanContactText(body?.note,1000), accessScope=String(body?.accessScope||'').toLowerCase();
    if(!['shared','private'].includes(accessScope)) return json({ok:false,error:'Choose Shared or Private Crew access.'},400);
    if(!note) return json({ok:false,error:'A note/reason is required when changing Crew access.'},400);
    const row=await loadReviewRecord(env,reviewId); if(!row||row.status==='trash') return json({ok:false,error:'Review not found.'},404);
    if(!reviewCanSeeRecord(crewSession,row)||!reviewCanChangeAccess(crewSession,row)) return json({ok:false,error:'You do not have permission to change Crew access for this review.'},403);
    if(Number(row.record_version)!==expectedVersion) return json({ok:false,error:'This review changed while you were working on it.',code:'STALE_REVIEW',currentVersion:Number(row.record_version)},409);
    if((row.access_scope||'shared')===accessScope) return json({ok:true,reviewId,accessScope,recordVersion:expectedVersion});
    const update=await env.OBA_DB.prepare(`UPDATE reviews SET access_scope=?,updated_by_crew_user_id=?,updated_at=CURRENT_TIMESTAMP,record_version=record_version+1 WHERE review_id=? AND record_version=?`).bind(accessScope,actorId,reviewId,expectedVersion).run();
    if(Number(update.meta?.changes||0)!==1) return json({ok:false,error:'This review changed while you were working on it.',code:'STALE_REVIEW'},409);
    await recordReviewAudit(env,{reviewId,action:accessScope==='shared'?'ACCESS_SHARED':'ACCESS_PRIVATIZED',actorId,fromStatus:row.status,toStatus:row.status,beforeData:{accessScope:row.access_scope||'shared'},afterData:{accessScope},note});
    return json({ok:true,reviewId,accessScope,recordVersion:expectedVersion+1});
  }

  if (url.pathname === '/crew/reviews/save') {
    if (request.method !== 'POST') return json({ok:false,error:'Method Not Allowed'},405);
    let body; try{body=await request.json()}catch{return json({ok:false,error:'Invalid request.'},400)}
    const reviewId=cleanContactText(body?.reviewId,20).toUpperCase(), expectedVersion=Number(body?.recordVersion), note=cleanContactText(body?.note,1000);
    const row=await loadReviewRecord(env,reviewId); if(!row) return json({ok:false,error:'Review not found.'},404);
    if(!reviewCanEditActive(crewSession,permissions,row)) return json({ok:false,error:'You do not have edit authority for this review.'},403);
    if(Number(row.record_version)!==expectedVersion) return json({ok:false,error:'This review changed while you were working on it.',code:'STALE_REVIEW',currentVersion:Number(row.record_version)},409);
    if(!note) return json({ok:false,error:'A change note is required when updating a review.'},400);
    const input=normalizeReviewInput(body); const finalErrors=row.status==='rough'?[]:validateReviewForFinal(input); if(finalErrors.length) return json({ok:false,error:finalErrors[0],errors:finalErrors},400);
    const warnings=await reviewDuplicateWarnings(env,input,reviewId); if(warnings.some(w=>w.severity==='error')) return json({ok:false,error:warnings[0].message,warnings},409);
    const before=reviewRowToPublicShape(row); const sourceChanged=['reviewerName','rating','reviewType','originalReviewText','reviewDate','source','sourceUrl'].some(key=>String(before[key]??'')!==String(input[key]??''));
    const currentLinks=before.cookieIds.slice().sort(); const nextLinks=input.cookieIds.slice().sort(); const linksChanged=JSON.stringify(currentLinks)!==JSON.stringify(nextLinks);
    const currentImages=(before.imagePaths||[]); const nextImages=input.imagePaths; const imagesChanged=JSON.stringify(currentImages)!==JSON.stringify(nextImages);
    let nextStatus=row.status;
    if((row.status==='verified'||row.status==='published')&&(sourceChanged||linksChanged||imagesChanged)) nextStatus='final';
    const result=await env.OBA_DB.prepare(`UPDATE reviews SET reviewer_name=?,rating=?,review_type=?,original_review_text=?,review_date=?,source=?,source_url=?,featured_priority=?,internal_notes=?,status=?,updated_by_crew_user_id=?,updated_at=CURRENT_TIMESTAMP,record_version=record_version+1,verified_by_crew_user_id=CASE WHEN ?='final' AND status IN('verified','published') THEN NULL ELSE verified_by_crew_user_id END,verified_at=CASE WHEN ?='final' AND status IN('verified','published') THEN NULL ELSE verified_at END,published_by_crew_user_id=CASE WHEN ?='final' AND status='published' THEN NULL ELSE published_by_crew_user_id END,published_at=CASE WHEN ?='final' AND status='published' THEN NULL ELSE published_at END WHERE review_id=? AND record_version=?`).bind(input.reviewerName||null,input.rating,input.reviewType||null,input.originalReviewText,input.reviewDate||null,input.source||null,input.sourceUrl,input.featuredPriority,input.internalNotes,nextStatus,actorId,nextStatus,nextStatus,nextStatus,nextStatus,reviewId,expectedVersion).run();
    if(Number(result.meta?.changes||0)!==1) return json({ok:false,error:'This review changed while you were working on it.',code:'STALE_REVIEW'},409);
    await replaceReviewCookieLinks(env,reviewId,input.cookieIds,actorId);
    await replaceReviewImages(env,reviewId,input.imagePaths,actorId);
    const action=row.status==='rough'?'ROUGH_SAVED':row.status==='final'?'FINAL_EDITED':row.status==='verified'?'VERIFIED_EDITED':'PUBLISHED_EDITED';
    await recordReviewAudit(env,{reviewId,action,actorId,fromStatus:row.status,toStatus:nextStatus,beforeData:before,afterData:input,note:note||null});
    if(nextStatus==='final' && row.status!==nextStatus) await recordReviewAudit(env,{reviewId,action:'VERIFICATION_INVALIDATED',actorId,fromStatus:row.status,toStatus:'final',note:'Source-of-truth fields, cookie associations, or review photos changed; re-verification is required.'});
    return json({ok:true,reviewId,status:nextStatus,recordVersion:expectedVersion+1,warnings,reverificationRequired:nextStatus==='final'&&row.status!==nextStatus});
  }

  if (url.pathname === '/crew/reviews/action') {
    if (request.method !== 'POST') return json({ok:false,error:'Method Not Allowed'},405);
    let body; try{body=await request.json()}catch{return json({ok:false,error:'Invalid request.'},400)}
    const reviewId=cleanContactText(body?.reviewId,20).toUpperCase(), action=String(body?.action||'').toLowerCase(), expectedVersion=Number(body?.recordVersion), note=cleanContactText(body?.note,1000);
    const row=await loadReviewRecord(env,reviewId); if(!row) return json({ok:false,error:'Review not found.'},404);
    if(Number(row.record_version)!==expectedVersion) return json({ok:false,error:'This review changed while you were working on it.',code:'STALE_REVIEW',currentVersion:Number(row.record_version)},409);
    let toStatus=null,auditAction='',requiredPermission=null,noteRequired=false;
    if(action==='finalize'&&row.status==='rough'){toStatus='final';auditAction='FINALIZED';requiredPermission='reviews.finalize'}
    else if(action==='return'&&row.status==='final'){toStatus='rough';auditAction='RETURNED_TO_ROUGH';requiredPermission='reviews.edit_final';noteRequired=true}
    else if(action==='verify'&&row.status==='final'){toStatus='verified';auditAction='VERIFIED';requiredPermission='reviews.verify';noteRequired=true}
    else if(action==='revoke_verification'&&row.status==='verified'){toStatus='final';auditAction='VERIFICATION_REVOKED';requiredPermission='reviews.edit_verified';noteRequired=true}
    else if(action==='publish'&&row.status==='verified'){toStatus='published';auditAction='PUBLISHED';requiredPermission='reviews.publish'}
    else if(action==='unpublish'&&row.status==='published'){toStatus='verified';auditAction='UNPUBLISHED';requiredPermission='reviews.unpublish';noteRequired=true}
    else if(action==='trash'&&row.status!=='trash'){toStatus='trash';auditAction='MOVED_TO_TRASH';noteRequired=true}
    else if(action==='restore'&&row.status==='trash'){toStatus='rough';auditAction='RESTORED';requiredPermission='reviews.trash_restore';noteRequired=true}
    else return json({ok:false,error:'That workflow action is not valid for this review.'},409);
    if(requiredPermission && deny(requiredPermission)) return json({ok:false,error:'You do not have permission to perform this action.'},403);
    if((action==='trash'||action==='finalize') && !reviewCanEditActive(crewSession,permissions,row)) return json({ok:false,error:action==='trash'?'You can only move reviews to Trash when you currently have edit authority over them.':'You can only finalize a Rough review you currently have edit authority over.'},403);
    if(noteRequired&&!note) return json({ok:false,error:'A note/reason is required for this action.'},400);
    if(action==='finalize'){const input=normalizeReviewInput({reviewerName:row.reviewer_name,rating:row.rating,reviewType:row.review_type,originalReviewText:row.original_review_text,reviewDate:row.review_date,source:row.source,sourceUrl:row.source_url,featuredPriority:row.featured_priority,internalNotes:row.internal_notes,cookieIds:reviewJson(row.cookie_ids_json,[])});const errors=validateReviewForFinal(input);if(errors.length)return json({ok:false,error:errors[0],errors},400)}
    const metadataSets=[];
    const metadataBinds=[];
    if(action==='finalize'){metadataSets.push('finalized_by_crew_user_id=?','finalized_at=CURRENT_TIMESTAMP','queue_entered_at=CURRENT_TIMESTAMP');metadataBinds.push(actorId)}
    if(action==='return'){metadataSets.push('finalized_by_crew_user_id=NULL','finalized_at=NULL','queue_entered_at=NULL','returned_by_crew_user_id=?','returned_at=CURRENT_TIMESTAMP');metadataBinds.push(actorId)}
    if(action==='verify'){metadataSets.push('verified_by_crew_user_id=?','verified_at=CURRENT_TIMESTAMP','queue_entered_at=CURRENT_TIMESTAMP');metadataBinds.push(actorId)}
    if(action==='revoke_verification'){metadataSets.push('verified_by_crew_user_id=NULL','verified_at=NULL','queue_entered_at=CURRENT_TIMESTAMP');}
    if(action==='publish'){metadataSets.push('published_by_crew_user_id=?','published_at=CURRENT_TIMESTAMP','queue_entered_at=NULL');metadataBinds.push(actorId)}
    if(action==='unpublish'){metadataSets.push('published_by_crew_user_id=NULL','published_at=NULL','unpublished_by_crew_user_id=?','unpublished_at=CURRENT_TIMESTAMP','queue_entered_at=CURRENT_TIMESTAMP');metadataBinds.push(actorId)}
    if(action==='trash'){metadataSets.push('trashed_by_crew_user_id=?','trashed_at=CURRENT_TIMESTAMP','trash_reason=?','queue_entered_at=NULL');metadataBinds.push(actorId,note)}
    if(action==='restore'){metadataSets.push('trashed_by_crew_user_id=NULL','trashed_at=NULL','trash_reason=NULL','finalized_by_crew_user_id=NULL','finalized_at=NULL','verified_by_crew_user_id=NULL','verified_at=NULL','published_by_crew_user_id=NULL','published_at=NULL','queue_entered_at=NULL');}
    const updateSql=`UPDATE reviews SET status=?,updated_by_crew_user_id=?,updated_at=CURRENT_TIMESTAMP,record_version=record_version+1${metadataSets.length?','+metadataSets.join(','):''} WHERE review_id=? AND record_version=?`;
    const update=await env.OBA_DB.prepare(updateSql).bind(toStatus,actorId,...metadataBinds,reviewId,expectedVersion).run();
    if(Number(update.meta?.changes||0)!==1)return json({ok:false,error:'This review changed while you were working on it.',code:'STALE_REVIEW'},409);
    await recordReviewAudit(env,{reviewId,action:auditAction,actorId,fromStatus:row.status,toStatus,beforeData:{status:row.status,recordVersion:expectedVersion},afterData:{status:toStatus,recordVersion:expectedVersion+1},note:note||null});
    return json({ok:true,reviewId,status:toStatus,recordVersion:expectedVersion+1});
  }

  if (url.pathname === '/crew/reviews/permanent-delete') {
    if (request.method !== 'POST') return json({ok:false,error:'Method Not Allowed'},405);
    if (deny('reviews.permanent_delete')) return json({ok:false,error:'You do not have permission to permanently delete Reviews.'},403);
    let body;try{body=await request.json()}catch{return json({ok:false,error:'Invalid request.'},400)}
    const reviewId=cleanContactText(body?.reviewId,20).toUpperCase(),note=cleanContactText(body?.note,1000),expectedVersion=Number(body?.recordVersion);
    if(!note)return json({ok:false,error:'A deletion reason is required.'},400);
    const row=await loadReviewRecord(env,reviewId);if(!row||row.status!=='trash')return json({ok:false,error:'Trashed review not found.'},404);
    if(Number(row.record_version)!==expectedVersion)return json({ok:false,error:'This review changed while you were working on it.',code:'STALE_REVIEW'},409);
    await env.OBA_DB.batch([
      env.OBA_DB.prepare(`INSERT INTO review_tombstones(review_id,deleted_by_crew_user_id,deletion_reason,prior_status) VALUES(?,?,?,'trash')`).bind(reviewId,actorId,note),
      env.OBA_DB.prepare(`INSERT INTO review_audit_events(review_id,action,performed_by_crew_user_id,from_status,to_status,before_data,note) VALUES(?,'PERMANENTLY_DELETED',?,'trash',NULL,?,?)`).bind(reviewId,actorId,JSON.stringify({recordVersion:expectedVersion}),note),
      env.OBA_DB.prepare(`DELETE FROM reviews WHERE review_id=? AND record_version=? AND status='trash'`).bind(reviewId,expectedVersion)
    ]);
    return json({ok:true,reviewId,permanentlyDeleted:true});
  }

  return json({ok:false,error:'Not Found'},404);
}

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


  /* =========================================
     REQUIRE CREW PERMISSION
  ========================================== */

  const permissionDenied =
    await requireCrewPermission(
      env,
      crewSession,
      'inventory.add_baked'
    );

  if (permissionDenied) {
    return permissionDenied;
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


  /* =========================================
     REQUIRE CREW PERMISSION
  ========================================== */

  const permissionDenied =
    await requireCrewPermission(
      env,
      crewSession,
      'inventory.adjust'
    );

  if (permissionDenied) {
    return permissionDenied;
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


  /* =========================================
     REQUIRE CREW PERMISSION
  ========================================== */

  const permissionDenied =
    await requireCrewPermission(
      env,
      crewSession,
      'inventory.locations'
    );

  if (permissionDenied) {
    return permissionDenied;
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
     REQUIRE CREW PERMISSION
  ========================================== */

  const permissionDenied =
    await requireCrewPermission(
      env,
      crewSession,
      'inventory.transfer'
    );

  if (permissionDenied) {
    return permissionDenied;
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
