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

      }
    );



    document
      .querySelectorAll(
        '[data-mini-cart-empty]'
      )
      .forEach(
        element => {

          element.hidden =
            items.length > 0;

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
        event.key !== STORAGE_KEY
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
    () => {

      renderCartCounts();

      renderMiniCart();

    }
  );



  /* =========================================================
     PUBLIC API
  ========================================================= */

  window.OBA_CART = {

   getCartId,

    buildReservationPayload,
     
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
