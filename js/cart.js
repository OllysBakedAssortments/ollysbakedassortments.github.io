/* =========================================================
   OBA COOKIES — SHARED CART
   File: /js/cart.js

   This file manages the site's shared shopping cart.

   Cart data is stored in localStorage so it persists across:
   - page refreshes
   - navigation between pages
   - return visits in the same browser

   Expected product shape:

   {
     id: "brown-butter-bliss",
     name: "Brown Butter Bliss",
     price: 4.00,
     quantity: 2
   }

========================================================= */


(function () {

  'use strict';


  /* =========================================================
     CONFIG
  ========================================================= */

  const STORAGE_KEY =
     'oba-cart';


   const CART_ID_STORAGE_KEY =
     'oba-cart-id';
   
   
   const CART_UPDATED_EVENT =
     'oba-cart-updated';
   
   
   const RESERVATION_API_BASE =
     'https://oba-checkout.ollysbakedassortments.workers.dev';
   
   
   const CART_RESERVATION_ENDPOINT =
     `${RESERVATION_API_BASE}/cart-reservation`;
   
   
   const CART_RELEASE_ENDPOINT =
     `${RESERVATION_API_BASE}/cart-reservation/release`;

   const CART_CHECKOUT_PROTECTION_ENDPOINT =
  `${RESERVATION_API_BASE}/cart-reservation/checkout-protection`;

/* =========================================================
   RESERVATION STATE

   Browser-side copy of the current server-authoritative
   reservation timing.

   D1 remains authoritative. This state exists only so the
   frontend can later render the reservation countdown and
   expiration UX.
========================================================= */

let reservationState = {
  reservationId: null,
  status: null,
  expiresAt: null,
  extensionCount: 0,
  checkoutProtectionUsed: false
};

  /* =========================================================
     HELPERS
  ========================================================= */

  function normalizeId(value) {

    return String(value || '')
      .trim();

  }


  function normalizeName(value) {

    return String(value || '')
      .trim();

  }


  function normalizePrice(value) {

    const price = Number(value);

    if (!Number.isFinite(price) || price < 0) {

      return 0;

    }

    return price;

  }


  function normalizeQuantity(value) {

    const quantity = Number(value);

    if (!Number.isFinite(quantity)) {

      return 0;

    }

    return Math.max(
      0,
      Math.floor(quantity)
    );

  }


  function normalizeProduct(product) {

    if (!product || typeof product !== 'object') {

      return null;

    }


    const id = normalizeId(
      product.id
    );


    const name = normalizeName(
      product.name
    );


    const price = normalizePrice(
      product.price
    );


    const quantity = normalizeQuantity(
      product.quantity
    );


    if (!id || !name) {

      return null;

    }


    return {
      id,
      name,
      price,
      quantity
    };

  }


  function formatMoney(value) {

    return new Intl.NumberFormat(
      'en-US',
      {
        style: 'currency',
        currency: 'USD'
      }
    ).format(
      Number(value) || 0
    );

  }

/* =========================================================
   CART ID

   Anonymous browser identifier used to connect the
   local cart with its server-side inventory reservation.

   This ID persists independently from the cart contents.
========================================================= */

function createCartId() {

  return crypto.randomUUID();

}


function getCartId() {

  try {

    let cartId =
      localStorage.getItem(
        CART_ID_STORAGE_KEY
      );


    if (!cartId) {

      cartId =
        createCartId();


      localStorage.setItem(
        CART_ID_STORAGE_KEY,
        cartId
      );

    }


    return cartId;

  }

  catch (error) {

    console.error(
      'OBA Cart: Could not access persistent cart ID.',
      error
    );


    /*
      Fallback for browsers where localStorage
      is unavailable.

      This ID will last only for the current page.
    */

    if (!getCartId.fallbackId) {

      getCartId.fallbackId =
        createCartId();

    }


    return getCartId.fallbackId;

  }

}

/* =========================================================
   RESERVATION PAYLOAD

   Converts the browser cart into the minimal inventory
   payload expected by the reservation API.

   Price and product name are intentionally excluded.
   Inventory authority lives on the server.
========================================================= */

function buildReservationPayload() {

  const items =
    Object.values(
      readCart()
    )
      .filter(
        item =>
          item.quantity > 0
      )
      .map(
        item => ({
          id: item.id,
          quantity: item.quantity
        })
      );


  return {
    cartId: getCartId(),
    items
  };

}

function clearReservationState() {

  reservationState = {
    reservationId: null,
    status: null,
    expiresAt: null,
    extensionCount: 0,
    checkoutProtectionUsed: false
  };

}


function updateReservationState(data) {

  if (
    !data ||
    typeof data !== 'object'
  ) {

    return;

  }


  reservationState = {
    reservationId:
      data.reservationId || null,

    status:
      data.status || null,

    expiresAt:
      data.expiresAt || null,

    extensionCount:
      Number.isFinite(
        Number(data.extensionCount)
      )
        ? Number(data.extensionCount)
        : 0,

    checkoutProtectionUsed:
      data.checkoutProtectionUsed === true ||
      data.checkoutProtectionUsed === 1
  };

}

/* =========================================================
   RESERVATION COUNTDOWN

   Calculates remaining hold time from the authoritative
   server-provided expiresAt timestamp.

   No independent browser timer is created here.
   Refreshing the page therefore cannot reset the hold.
========================================================= */

function getReservationTimeRemaining() {

  if (
    !reservationState.expiresAt ||
    reservationState.status !== 'active'
  ) {

    return {
      active: false,
      expired: false,
      milliseconds: 0,
      totalSeconds: 0,
      minutes: 0,
      seconds: 0,
      formatted: '00:00'
    };

  }


  const expiresAt =
    Date.parse(
      reservationState.expiresAt
    );


  if (!Number.isFinite(expiresAt)) {

    return {
      active: false,
      expired: false,
      milliseconds: 0,
      totalSeconds: 0,
      minutes: 0,
      seconds: 0,
      formatted: '00:00'
    };

  }


  const milliseconds =
    Math.max(
      0,
      expiresAt - Date.now()
    );


  const totalSeconds =
    Math.ceil(
      milliseconds / 1000
    );


  const minutes =
    Math.floor(
      totalSeconds / 60
    );


  const seconds =
    totalSeconds % 60;


  const formatted =
    `${String(minutes).padStart(2, '0')}:${
      String(seconds).padStart(2, '0')
    }`;


  return {
    active:
      milliseconds > 0,

    expired:
      milliseconds <= 0,

    milliseconds,

    totalSeconds,

    minutes,

    seconds,

    formatted
  };

}
   
/* =========================================================
   RESERVATION SYNC

   Synchronizes the browser cart with the authoritative
   server-side inventory reservation.

   Non-empty cart:
   POST /cart-reservation

   Empty cart:
   POST /cart-reservation/release

   This function does not modify the browser cart.
========================================================= */

async function syncCartReservation() {

  const payload =
    buildReservationPayload();


  const hasItems =
    payload.items.length > 0;


  const endpoint =
    hasItems
      ? CART_RESERVATION_ENDPOINT
      : CART_RELEASE_ENDPOINT;


  const body =
    hasItems
      ? payload
      : {
          cartId: payload.cartId
        };


  try {

    const response =
      await fetch(
        endpoint,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify(body)
        }
      );


    let data = null;


    try {

      data =
        await response.json();

    }

    catch (error) {

      console.error(
        'OBA Cart: Reservation response was not valid JSON.',
        error
      );

    }


    if (!response.ok) {

  console.error(
    'OBA Cart: Reservation sync failed.',
    {
      status: response.status,
      data
    }
  );


  return {
    ok: false,
    status: response.status,
    data
  };

}


if (hasItems) {

  updateReservationState(
    data.reservation
  );

}

else {

  clearReservationState();

}


window.dispatchEvent(
  new CustomEvent(
    'oba-reservation-updated',
    {
      detail: {
        reservation: {
          ...reservationState
        }
      }
    }
  )
);


return {
  ok: true,
  status: response.status,
  data
};

  }

  catch (error) {

    console.error(
      'OBA Cart: Could not reach reservation service.',
      error
    );


    return {
      ok: false,
      status: 0,
      error
    };

  }

}

/* =========================================================
   CHECK AVAILABILITY

   Explicitly attempts to reserve the current cart again.

   Intended for the customer-facing "Check Availability"
   action after a reservation has expired.

   This does not run automatically on page load or refresh.
========================================================= */

async function checkAvailability() {

  const payload =
    buildReservationPayload();


  if (payload.items.length === 0) {

    return {
      ok: false,
      status: 400,
      data: {
        error:
          'Your cart is empty.'
      }
    };

  }


  return await syncCartReservation();

}

/* =========================================================
   CHECKOUT PROTECTION

   Applies the reservation's one-time checkout protection
   immediately before the customer enters checkout.

   The server remains authoritative over whether protection
   can be applied and how much time remains.
========================================================= */

async function protectReservationForCheckout() {

  const payload =
    buildReservationPayload();


  if (payload.items.length === 0 && !(getPendingPack() && reservationState.status === 'active' && reservationState.reservationId)) {

    return {
      ok: false,
      status: 400,
      data: {
        error:
          'Your cart is empty.'
      }
    };

  }


  try {

    const response =
      await fetch(
        CART_CHECKOUT_PROTECTION_ENDPOINT,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body:
            JSON.stringify({
              cartId: payload.cartId
            })
        }
      );


    let data = null;


    try {

      data =
        await response.json();

    }

    catch (error) {

      console.error(
        'OBA Cart: Checkout protection response was not valid JSON.',
        error
      );

    }


    if (!response.ok) {

      console.error(
        'OBA Cart: Checkout protection failed.',
        {
          status: response.status,
          data
        }
      );


      return {
        ok: false,
        status: response.status,
        data
      };

    }


    if (data?.reservation) {

      updateReservationState(
        data.reservation
      );


      window.dispatchEvent(
        new CustomEvent(
          'oba-reservation-updated',
          {
            detail: {
              reservation: {
                ...reservationState
              }
            }
          }
        )
      );

    }


    return {
      ok: true,
      status: response.status,
      data
    };

  }

  catch (error) {

    console.error(
      'OBA Cart: Could not reach checkout protection service.',
      error
    );


    return {
      ok: false,
      status: 0,
      error
    };

  }

}
   
  /* =========================================================
     STORAGE
  ========================================================= */

  function readCart() {

    try {

      const stored =
        localStorage.getItem(
          STORAGE_KEY
        );


      if (!stored) {

        return {};

      }


      const parsed =
        JSON.parse(stored);


      if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
      ) {

        return {};

      }


      const cleanedCart = {};


      Object.values(parsed).forEach(
        rawItem => {

          const item =
            normalizeProduct(
              rawItem
            );


          if (
            !item ||
            item.quantity <= 0
          ) {

            return;

          }


          cleanedCart[item.id] =
            item;

        }
      );


      return cleanedCart;

    }

    catch (error) {

      console.error(
        'OBA Cart: Could not read cart.',
        error
      );


      return {};

    }

  }


  function saveCart(cart) {

    try {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(cart)
      );

    }

    catch (error) {

      console.error(
        'OBA Cart: Could not save cart.',
        error
      );

    }

  }



  /* =========================================================
     EVENTS
  ========================================================= */

  function dispatchCartUpdated() {

    window.dispatchEvent(
      new CustomEvent(
        CART_UPDATED_EVENT,
        {
          detail: {
            cart: readCart()
          }
        }
      )
    );

  }



  /* =========================================================
     PHASE 03D.1 — PENDING GIRAFFE PACK IN SHARED BATCH
     Separate from paid cookie line items and reservation payload.
     No client-provided pack price is trusted for checkout.
  ========================================================= */

  const PENDING_PACK_KEY = 'oba-cart-pending-pack-v1';
  const PACK_SIZES = { lil: 3, tall: 6, feast: 13 };

  function normalizePendingPack(value) {
    if (!value || value.v !== 1 || !Object.hasOwn(PACK_SIZES, value.size) ||
        typeof value.planningDropId !== 'string' ||
        !/^wd-[a-f0-9-]{36}$/.test(value.planningDropId) ||
        !Array.isArray(value.items) || !value.items.length || value.items.length > 13) return null;
    const used = new Set(); let total = 0;
    const items = [];
    for (const item of value.items) {
      if (!item || typeof item.productId !== 'string' ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.productId) ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 13 ||
          used.has(item.productId)) return null;
      used.add(item.productId); total += item.quantity;
      items.push({productId:item.productId, quantity:item.quantity,
        name:String(item.name || item.productId).slice(0,120)});
    }
    if (total !== PACK_SIZES[value.size]) return null;
    return {v:1, planningDropId:value.planningDropId, size:value.size, items};
  }

  function getPendingPack() {
    try { return normalizePendingPack(JSON.parse(localStorage.getItem(PENDING_PACK_KEY) || 'null')); }
    catch { return null; }
  }

  function setPendingPack(value) {
    const pack = normalizePendingPack(value);
    if (!pack) return false;
    try { localStorage.setItem(PENDING_PACK_KEY, JSON.stringify(pack)); }
    catch { return false; }
    renderMiniCart();
    window.dispatchEvent(new CustomEvent('oba-pending-pack-updated', {detail:{pack}}));
    return true;
  }

  function removePendingPack() {
    try { localStorage.removeItem(PENDING_PACK_KEY); } catch { return false; }
    renderMiniCart();
    window.dispatchEvent(new CustomEvent('oba-pending-pack-updated', {detail:{pack:null}}));
    return true;
  }

  /* Phase 03D.2C: pack reservation bridge. Reserved pack contents are still
     charged only by the server's immutable reservation snapshot. */
  async function packCheckoutReady() {
    try {
      const response = await fetch(`${RESERVATION_API_BASE}/storefront/giraffe-packs/checkout-status`,
        {cache:'no-store',headers:{Accept:'application/json'}});
      const data = await response.json();
      return response.ok && data.ok === true && data.packCheckoutEnabled === true;
    } catch { return false; }
  }

  async function reservePendingPack() {
    const pack = getPendingPack();
    if (!pack) return {ok:false,error:'No Giraffe Pack selected.'};
    if (!await packCheckoutReady()) return {ok:false,error:'Giraffe Pack checkout is not enabled.'};
    const individualItems = getItems().map(({id,quantity})=>({id,quantity}));
    const snapshot = JSON.stringify({pack,individualItems});
    // The normal cookie hold cannot be reused for a pack. Release it explicitly.
    // If the new hold fails, attempt to restore the original cookie hold.
    const old = await fetch(CART_RELEASE_ENDPOINT, {method:'POST',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({cartId:getCartId()})});
    if (!old.ok) return {ok:false,error:'Could not release the existing cookie hold.'};
    clearReservationState();
    try {
      const response = await fetch(`${RESERVATION_API_BASE}/storefront/giraffe-packs/cart-hold`, {
        method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({cartId:getCartId(),pack:{planningDropId:pack.planningDropId,
          size:pack.size,items:pack.items.map(({productId,quantity})=>({productId,quantity}))},individualItems})
      });
      const data = await response.json();
      if (!response.ok || !data.ok || data.reservationCreated !== true) {
        if (individualItems.length) await syncCartReservation();
        return {ok:false,error:data.error||'Could not reserve the combined batch.'};
      }
      if (snapshot !== JSON.stringify({pack:getPendingPack(),individualItems:getItems().map(({id,quantity})=>({id,quantity}))})) {
        // The customer's selection changed during the network request: release the stale hold.
        await fetch(CART_RELEASE_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({cartId:getCartId()})});
        clearReservationState();
        if (getItems().length) await syncCartReservation();
        return {ok:false,error:'Your batch changed during reservation. Please try again.'};
      }
      updateReservationState({reservationId:data.reservationId,expiresAt:data.expiresAt,status:'active'});
      window.dispatchEvent(new CustomEvent('oba-reservation-updated',{detail:{reservation:{...reservationState}}}));
      return {ok:true,data};
    } catch {
      if (individualItems.length) await syncCartReservation();
      return {ok:false,error:'Could not reach the reservation service.'};
    }
  }

  /* =========================================================
     CORE CART FUNCTIONS
  ========================================================= */

  function getCart() {

    return readCart();

  }


  function getItems() {

    return Object.values(
      readCart()
    );

  }


  function getItem(productId) {

    const id =
      normalizeId(productId);


    if (!id) {

      return null;

    }


    const cart =
      readCart();


    return cart[id] || null;

  }


  function setQuantity(
    product,
    quantity
  ) {

    const cleanProduct =
      normalizeProduct(product);


    if (!cleanProduct) {

      console.warn(
        'OBA Cart: Invalid product supplied.',
        product
      );

      return;

    }


    const cleanQuantity =
      normalizeQuantity(quantity);


    const cart =
      readCart();


    if (cleanQuantity === 0) {

      delete cart[
        cleanProduct.id
      ];

    }

    else {

      cart[
        cleanProduct.id
      ] = {
        id: cleanProduct.id,
        name: cleanProduct.name,
        price: cleanProduct.price,
        quantity: cleanQuantity
      };

    }


    saveCart(cart);

    dispatchCartUpdated();

  }


  function add(
    product,
    amount = 1
  ) {

    const cleanProduct =
      normalizeProduct(product);


    if (!cleanProduct) {

      console.warn(
        'OBA Cart: Could not add invalid product.',
        product
      );

      return;

    }


    const cleanAmount =
      Math.max(
        1,
        normalizeQuantity(amount)
      );


    const existing =
      getItem(
        cleanProduct.id
      );


    const newQuantity =
      existing
        ? existing.quantity + cleanAmount
        : cleanAmount;


    setQuantity(
      cleanProduct,
      newQuantity
    );

  }


  function remove(
    productId,
    amount = 1
  ) {

    const existing =
      getItem(
        productId
      );


    if (!existing) {

      return;

    }


    const cleanAmount =
      Math.max(
        1,
        normalizeQuantity(amount)
      );


    setQuantity(
      existing,
      existing.quantity - cleanAmount
    );

  }


  function removeItem(
    productId
  ) {

    const existing =
      getItem(
        productId
      );


    if (!existing) {

      return;

    }


    setQuantity(
      existing,
      0
    );

  }


  function clear() {

    try {

      localStorage.removeItem(
        STORAGE_KEY
      );

    }

    catch (error) {

      console.error(
        'OBA Cart: Could not clear cart.',
        error
      );

    }


    dispatchCartUpdated();

  }



  /* =========================================================
     TOTALS
  ========================================================= */

  function count() {

    return getItems()
      .reduce(
        (total, item) => {

          return total +
            item.quantity;

        },
        0
      );

  }


  function subtotal() {

    return getItems()
      .reduce(
        (total, item) => {

          return total +
            (
              item.price *
              item.quantity
            );

        },
        0
      );

  }


  function isEmpty() {

    return count() === 0;

  }



  /* =========================================================
     GLOBAL CART COUNT
  ========================================================= */

  function renderCartCounts() {

    const cartCount =
      count();


    document
      .querySelectorAll(
        '[data-cart-count]'
      )
      .forEach(
        element => {

          element.textContent =
            cartCount;


          element.hidden =
            cartCount === 0;


          element.setAttribute(
            'aria-label',
            `${cartCount} item${
              cartCount === 1
                ? ''
                : 's'
            } in cart`
          );

        }
      );

  }



  /* =========================================================
     OPTIONAL MINI CART

     These hooks are intentionally generic so the same
     cart.js can power a mini-cart drawer on every page.

     Supported markup:

     [data-mini-cart-items]
     [data-mini-cart-empty]
     [data-mini-cart-subtotal]
     [data-mini-cart-count]

  ========================================================= */

  function createMiniCartItem(
    item
  ) {

    const wrapper =
      document.createElement(
        'div'
      );


    wrapper.className =
      'mini-cart-item';


    wrapper.dataset.productId =
      item.id;



    /* -----------------------------------------
       INFO
    ----------------------------------------- */

    const info =
      document.createElement(
        'div'
      );


    info.className =
      'mini-cart-item-info';



    const name =
      document.createElement(
        'strong'
      );


    name.className =
      'mini-cart-item-name';


    name.textContent =
      item.name;



    const unitPrice =
      document.createElement(
        'span'
      );


    unitPrice.className =
      'mini-cart-item-unit-price';


    unitPrice.textContent =
      `${formatMoney(item.price)} each`;



    info.append(
      name,
      unitPrice
    );



    /* -----------------------------------------
       QUANTITY
    ----------------------------------------- */

    const quantityControls =
      document.createElement(
        'div'
      );


    quantityControls.className =
      'mini-cart-quantity';



    const minus =
      document.createElement(
        'button'
      );


    minus.type =
      'button';


    minus.className =
      'mini-cart-qty-minus';


    minus.setAttribute(
      'aria-label',
      `Remove one ${item.name}`
    );


    minus.textContent =
      '−';



    const quantity =
      document.createElement(
        'span'
      );


    quantity.className =
      'mini-cart-quantity-value';


    quantity.textContent =
      item.quantity;



    const plus =
      document.createElement(
        'button'
      );


    plus.type =
      'button';


    plus.className =
      'mini-cart-qty-plus';


    plus.setAttribute(
      'aria-label',
      `Add one ${item.name}`
    );


    plus.textContent =
      '+';



    quantityControls.append(
      minus,
      quantity,
      plus
    );



    /* -----------------------------------------
       PRICE
    ----------------------------------------- */

    const price =
      document.createElement(
        'strong'
      );


    price.className =
      'mini-cart-item-price';


    price.textContent =
      formatMoney(
        item.price *
        item.quantity
      );



    /* -----------------------------------------
       REMOVE
    ----------------------------------------- */

    const removeButton =
      document.createElement(
        'button'
      );


    removeButton.type =
      'button';


    removeButton.className =
      'mini-cart-remove';


    removeButton.setAttribute(
      'aria-label',
      `Remove ${item.name} from cart`
    );


    removeButton.textContent =
      'Remove';



    /* -----------------------------------------
       EVENTS
    ----------------------------------------- */

    minus.addEventListener(
      'click',
      () => {

        remove(
          item.id,
          1
        );

      }
    );


    plus.addEventListener(
      'click',
      () => {

        add(
          item,
          1
        );

      }
    );


    removeButton.addEventListener(
      'click',
      () => {

        removeItem(
          item.id
        );

      }
    );



    /* -----------------------------------------
       BUILD
    ----------------------------------------- */

    wrapper.append(
      info,
      quantityControls,
      price,
      removeButton
    );


    return wrapper;

  }



  function renderMiniCart() {

    const items =
      getItems();


    const miniCartContainers =
      document.querySelectorAll(
        '[data-mini-cart-items]'
      );


    miniCartContainers.forEach(
      container => {

        container.innerHTML =
          '';


        items.forEach(
          item => {

            container.appendChild(
              createMiniCartItem(
                item
              )
            );

          }
        );

        // Pending packs are visible but NEVER included in paid cart totals.
        const pendingPack = getPendingPack();
        if (pendingPack) {
          const preview = document.createElement('div');
          preview.className = 'oba-cart-pending-pack';
          const heading = document.createElement('strong');
          heading.textContent = ({lil:'Lil Giraffe',tall:'Tall Giraffe',feast:'Giraffe Feast'})[pendingPack.size] + ' — pending';
          const details = document.createElement('p');
          details.textContent = pendingPack.items.map(item => `${item.quantity} ${item.name}`).join(' · ');
          const warning = document.createElement('small');
          warning.textContent = 'Not included in the individual-cookie subtotal. Checkout must obtain an active server-side pack reservation before payment.';
          const removeButton = document.createElement('button');
          removeButton.type = 'button';
          removeButton.textContent = 'Remove pack preview';
          removeButton.addEventListener('click', removePendingPack);
          // Recheck the whole batch against the server, including cookie quantities
          // already held by this browser's existing cart reservation. This is a
          // readiness preview only: the Worker does not reserve or charge packs.
          const verifyButton = document.createElement('button');
          verifyButton.type = 'button';
          verifyButton.textContent = 'Check full batch price & stock';
          const feedback = document.createElement('p');
          feedback.setAttribute('role', 'status');
          feedback.setAttribute('aria-live', 'polite');
          verifyButton.addEventListener('click', async () => {
            verifyButton.disabled = true;
            feedback.textContent = 'Checking current weekly menu and Online stock…';
            const currentPack = getPendingPack();
            if (!currentPack) { feedback.textContent = 'Pack preview removed.'; verifyButton.disabled = false; return; }
            const before = JSON.stringify({pack:currentPack,individualItems:getItems().map(({id,quantity})=>({id,quantity}))});
            try {
              const response = await fetch(`${RESERVATION_API_BASE}/storefront/giraffe-packs/cart-plan`, {
                method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},
                body:JSON.stringify({cartId:getCartId(),pack:{planningDropId:currentPack.planningDropId,
                  size:currentPack.size,items:currentPack.items.map(({productId,quantity})=>({productId,quantity}))},
                  individualItems:getItems().map(({id,quantity})=>({id,quantity}))})
              });
              const data = await response.json();
              const after=JSON.stringify({pack:getPendingPack(),individualItems:getItems().map(({id,quantity})=>({id,quantity}))});
              if(before!==after){feedback.textContent='Your batch changed. Check again.';return;}
              if(!response.ok||!data.ok){feedback.textContent=data.error||'Unable to verify this batch.';return;}
              feedback.textContent=data.available
                ? `Combined subtotal: ${formatMoney(data.combinedSubtotalCents/100)}. Stock checked only; select Continue to Checkout to request a pack reservation if the feature is enabled.`
                : 'Not enough Online stock for this entire batch. No pack was reserved.';
            } catch { feedback.textContent='Could not reach inventory service. Please try again.'; }
            finally {verifyButton.disabled=false;}
          });
          preview.append(heading,details,warning,verifyButton,feedback,removeButton);
          container.appendChild(preview);
        }


      }
    );



    document
      .querySelectorAll(
        '[data-mini-cart-empty]'
      )
      .forEach(
        element => {

          element.hidden =
            items.length > 0 || !!getPendingPack();

        }
      );



    document
      .querySelectorAll(
        '[data-mini-cart-subtotal]'
      )
      .forEach(
        element => {

          element.textContent =
            formatMoney(
              subtotal()
            );

        }
      );



    document
      .querySelectorAll(
        '[data-mini-cart-count]'
      )
      .forEach(
        element => {

          element.textContent =
            count();

        }
      );

  }



  /* =========================================================
     OPTIONAL CART DRAWER

     Supported hooks:

     [data-cart-open]
     [data-cart-close]
     [data-cart-overlay]
     [data-cart-drawer]

  ========================================================= */

  function getCartDrawer() {

    return document.querySelector(
      '[data-cart-drawer]'
    );

  }


  function getCartOverlay() {

    return document.querySelector(
      '[data-cart-overlay]'
    );

  }


  function openCartDrawer() {

    const drawer =
      getCartDrawer();


    const overlay =
      getCartOverlay();


    if (!drawer) {

      return;

    }


    drawer.classList.add(
      'is-open'
    );


    drawer.setAttribute(
      'aria-hidden',
      'false'
    );


    if (overlay) {

      overlay.classList.add(
        'is-open'
      );


      overlay.hidden =
        false;

    }


    document.body.classList.add(
      'cart-open'
    );


    const closeButton =
      drawer.querySelector(
        '[data-cart-close]'
      );


    if (closeButton) {

      closeButton.focus();

    }

  }


  function closeCartDrawer() {

    const drawer =
      getCartDrawer();


    const overlay =
      getCartOverlay();


    if (!drawer) {

      return;

    }


    drawer.classList.remove(
      'is-open'
    );


    drawer.setAttribute(
      'aria-hidden',
      'true'
    );


    if (overlay) {

      overlay.classList.remove(
        'is-open'
      );


      overlay.hidden =
        true;

    }


    document.body.classList.remove(
      'cart-open'
    );

  }



  /* =========================================================
     GLOBAL CLICK HANDLERS
  ========================================================= */

  document.addEventListener(
    'click',
    event => {

      const openButton =
        event.target.closest(
          '[data-cart-open]'
        );


      if (openButton) {

        event.preventDefault();

        openCartDrawer();

        return;

      }



      const closeButton =
        event.target.closest(
          '[data-cart-close]'
        );


      if (closeButton) {

        event.preventDefault();

        closeCartDrawer();

        return;

      }



      const overlay =
        event.target.closest(
          '[data-cart-overlay]'
        );


      if (overlay) {

        closeCartDrawer();

      }

    }
  );



  /* =========================================================
     KEYBOARD
  ========================================================= */

  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Escape'
      ) {

        closeCartDrawer();

      }

    }
  );



  /* =========================================================
     CROSS-TAB SYNC

     If the cart changes in another tab,
     update this tab automatically.
  ========================================================= */

  window.addEventListener(
    'storage',
    event => {

      if (
        event.key !== STORAGE_KEY && event.key !== PENDING_PACK_KEY
      ) {

        return;

      }


      renderCartCounts();

      renderMiniCart();


      window.dispatchEvent(
        new CustomEvent(
          CART_UPDATED_EVENT,
          {
            detail: {
              cart: readCart(),
              source: 'storage'
            }
          }
        )
      );

    }
  );



  /* =========================================================
     CART UPDATE RENDERING
  ========================================================= */

  window.addEventListener(
     CART_UPDATED_EVENT,
     event => {
   
       renderCartCounts();
   
       renderMiniCart();
   
   
       /*
         A storage event means another browser tab
         changed the shared cart.
   
         That originating tab performs the reservation
         sync, so this tab only needs to re-render.
       */
   
       if (
         event.detail?.source === 'storage'
       ) {
   
         return;
   
       }
   
   
       syncCartReservation()
         .then(
           result => {
   
             if (!result.ok) {
   
               console.error(
                 'OBA Cart: Automatic reservation sync failed.',
                 result
               );
   
             }
   
           }
         );
   
     }
   );



  /* =========================================================
     PUBLIC API
  ========================================================= */

  window.OBA_CART = {

    packCheckoutReady,
    reservePendingPack,
    getPendingPack,
    removePendingPack,

   getCartId,

    buildReservationPayload,

      syncCartReservation,
      
      checkAvailability,

      protectReservationForCheckout,
      
      getReservationState() {

  return {
    ...reservationState
  };

},

     getReservationTimeRemaining,
     
    getCart,

    getItems,

    getItem,

    setQuantity,

    add,

    remove,

    removeItem,

    clear,

    count,

    subtotal,

    isEmpty,

    formatMoney,

    renderCartCounts,

    renderMiniCart,

    openCartDrawer,

    closeCartDrawer

  };



  /* =========================================================
     INITIAL RENDER
  ========================================================= */

  function initializeCart() {

    renderCartCounts();

    renderMiniCart();

  }


  if (
    document.readyState === 'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      initializeCart
    );

  }

  else {

    initializeCart();

  }


})();
