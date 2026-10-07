(() => {
  'use strict';

  const API_BASE = 'https://api.ollysbakedassortments.com';

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok || data?.ok === false) {
      const error = new Error(data?.error || `Request failed (${response.status}).`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeAccessContext(context = {}) {
    const clean = value => value === null || value === undefined || value === '' ? null : String(value).trim() || null;
    return {
      managerKey: clean(context.managerKey),
      recordType: clean(context.recordType),
      recordId: clean(context.recordId),
      sectionKey: clean(context.sectionKey),
      actionKey: clean(context.actionKey)
    };
  }

  async function requestAccess({ permissionKey, reason, requestedUntil = null, ...context }) {
    return api('/crew/access-request', {
      method: 'POST',
      body: JSON.stringify({
        permissionKey,
        reason,
        requestedUntil,
        ...normalizeAccessContext(context)
      })
    });
  }

  function permissionSet(value) {
    if (Array.isArray(value)) return new Set(value);
    return new Set(Object.entries(value || {}).filter(([, allowed]) => allowed === true).map(([key]) => key));
  }

  window.OBA_CREW_CORE = Object.freeze({
    API_BASE,
    api,
    esc,
    normalizeAccessContext,
    requestAccess,
    permissionSet
  });
})();
