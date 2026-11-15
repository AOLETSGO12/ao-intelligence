/**
 * Adapter layer for connected business services.
 *
 * Each function returns a Promise so a real API can later replace the
 * demo implementation without changing business.js. Today these read
 * from window.BUSINESS_DEMO_DATA only — there are no network calls,
 * and nothing is a live shop, bank, or payments connection.
 *
 * To wire a real source later, keep the same function names and the
 * same resolved shape (see the comments on each function).
 */
(function (root) {
  "use strict";

  function getStore() {
    return root.BUSINESS_DEMO_DATA;
  }

  function findBusiness(businessId) {
    var store = getStore();
    var list = (store && store.businesses) || [];
    return list.find(function (b) { return b.id === businessId; }) || list[0] || null;
  }

  function resolve(value) {
    return Promise.resolve(value);
  }

  function rejectMissing(kind) {
    return Promise.reject(new Error("No demo business is available for " + kind + "."));
  }

  function isConnected(business, serviceId) {
    return !!(business && business.connectedServiceIds && business.connectedServiceIds.indexOf(serviceId) !== -1);
  }

  function serviceRecord(store, business, service) {
    return {
      id: service.id,
      name: service.name,
      kind: service.kind,
      blurb: service.blurb,
      connectLabel: service.connectLabel,
      connected: isConnected(business, service.id),
      status: isConnected(business, service.id) ? "Connected (demo)" : "Not connected",
      isDemo: true
    };
  }

  /**
   * List the services a business can connect, with demo status flags.
   */
  function listServices(businessId) {
    var store = getStore();
    var business = findBusiness(businessId);
    if (!store || !business) return rejectMissing("listServices");
    return resolve({
      businessId: business.id,
      isDemo: true,
      currency: store.currency || "GBP",
      services: (store.services || []).map(function (service) {
        return serviceRecord(store, business, service);
      })
    });
  }

  /**
   * Mark a service as connected in this page session only (demo).
   * A real implementation would start OAuth or a bank consent flow.
   */
  function connectService(businessId, serviceId) {
    var store = getStore();
    var business = findBusiness(businessId);
    if (!store || !business) return rejectMissing("connectService");
    var known = (store.services || []).some(function (s) { return s.id === serviceId; });
    if (!known) {
      return Promise.reject(new Error("Unknown service."));
    }
    if (!business.connectedServiceIds) business.connectedServiceIds = [];
    if (business.connectedServiceIds.indexOf(serviceId) === -1) {
      business.connectedServiceIds.push(serviceId);
    }
    return listServices(business.id);
  }

  /**
   * Shopify sales and orders for the 30-day demo window.
   * Resolved value: { businessId, isDemo, connected, currency, daily, orders }
   * daily: [{ date, total, orderCount }]
   * orders: [{ id, date, time, reference, description, total }]
   */
  function getShopifySales(businessId) {
    var business = findBusiness(businessId);
    if (!business) return rejectMissing("getShopifySales");
    var src = business.shopify || { daily: [], orders: [] };
    return resolve({
      businessId: business.id,
      isDemo: true,
      connected: isConnected(business, "shopify"),
      currency: src.currency || "GBP",
      daily: src.daily || [],
      orders: src.orders || []
    });
  }

  /**
   * NatWest (bank) transactions and daily money in.
   * Resolved value: { businessId, isDemo, connected, currency, accountName, dailyIn, transactions }
   * dailyIn: [{ date, total }]
   * transactions: [{ id, date, time, description, amount, direction }]
   */
  function getBankTransactions(businessId) {
    var business = findBusiness(businessId);
    if (!business) return rejectMissing("getBankTransactions");
    var src = business.bank || { dailyIn: [], transactions: [] };
    return resolve({
      businessId: business.id,
      isDemo: true,
      connected: isConnected(business, "natwest"),
      currency: src.currency || "GBP",
      accountName: src.accountName || "",
      dailyIn: src.dailyIn || [],
      transactions: src.transactions || []
    });
  }

  /**
   * Stripe payments (empty in the default demo; present so a live API can replace it).
   */
  function getStripePayments(businessId) {
    var business = findBusiness(businessId);
    if (!business) return rejectMissing("getStripePayments");
    var src = business.stripe || { payments: [] };
    return resolve({
      businessId: business.id,
      isDemo: true,
      connected: isConnected(business, "stripe"),
      currency: src.currency || "GBP",
      payments: src.payments || []
    });
  }

  /**
   * Square sales (empty in the default demo).
   */
  function getSquareSales(businessId) {
    var business = findBusiness(businessId);
    if (!business) return rejectMissing("getSquareSales");
    var src = business.square || { payments: [] };
    return resolve({
      businessId: business.id,
      isDemo: true,
      connected: isConnected(business, "square"),
      currency: src.currency || "GBP",
      payments: src.payments || []
    });
  }

  /**
   * Xero invoices (empty in the default demo).
   */
  function getXeroInvoices(businessId) {
    var business = findBusiness(businessId);
    if (!business) return rejectMissing("getXeroInvoices");
    var src = business.xero || { invoices: [] };
    return resolve({
      businessId: business.id,
      isDemo: true,
      connected: isConnected(business, "xero"),
      currency: src.currency || "GBP",
      invoices: src.invoices || []
    });
  }

  /**
   * Catalogue of demo businesses (ids and names only) for the switcher.
   */
  function listBusinesses() {
    var store = getStore();
    if (!store) return rejectMissing("listBusinesses");
    return resolve({
      isDemo: true,
      demoLabel: store.demoLabel || "Demo data",
      currency: store.currency || "GBP",
      locale: store.locale || "en-GB",
      today: store.today,
      todayLabel: store.todayLabel,
      rangeLabel: store.rangeLabel,
      businesses: (store.businesses || []).map(function (b) {
        return {
          id: b.id,
          name: b.name,
          shortName: b.shortName,
          type: b.type,
          agent: b.agent,
          flavor: b.flavor || {}
        };
      })
    });
  }

  root.Connectors = {
    listBusinesses: listBusinesses,
    listServices: listServices,
    connectService: connectService,
    getShopifySales: getShopifySales,
    getBankTransactions: getBankTransactions,
    getStripePayments: getStripePayments,
    getSquareSales: getSquareSales,
    getXeroInvoices: getXeroInvoices
  };
})(window);
