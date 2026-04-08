/**
 * By: Mervyn Teo Zi Yan, A0273039A
 *
 * k6 Volume Test Suite
 *
 * Tests the ecommerce API under sustained high-volume traffic over an extended
 * period. Unlike spike tests (sudden bursts), volume tests verify that the
 * system can handle a large, steady number of concurrent users for a prolonged
 * duration without performance degradation, memory leaks, or rising error rates.
 *
 * Volume pattern (per scenario):
 *   ramp up (50 VUs, 30s) → sustained load (200 VUs, 5m) → ramp down (0 VUs, 30s)
 *
 * ─── Scenarios ────────────────────────────────────────────────────────────────
 *
 *   auth              - Registers unique users and logs them in under sustained
 *                       load. Verifies that bcrypt hashing and JWT signing remain
 *                       stable over many minutes of continuous registration/login
 *                       traffic.
 *                       Endpoints: POST /api/v1/auth/register
 *                                  POST /api/v1/auth/login
 *
 *   products          - Continuously lists products, fetches the product count,
 *                       and retrieves paginated product lists. Verifies the
 *                       product browsing experience remains fast under sustained
 *                       concurrent access.
 *                       Endpoints: GET /api/v1/product/get-product
 *                                  GET /api/v1/product/product-count
 *                                  GET /api/v1/product/product-list/:page
 *
 *   categories        - Continuously fetches the full category list. Verifies
 *                       this lightweight endpoint remains responsive under
 *                       sustained high concurrency.
 *                       Endpoint:  GET /api/v1/category/get-category
 *
 *   search            - Continuously searches for products using a rotating set
 *                       of keywords. Verifies that MongoDB regex-based search
 *                       remains performant under prolonged load.
 *                       Endpoint:  GET /api/v1/product/search/:keyword
 *
 *   filters           - Continuously applies product filters (by category and
 *                       price range). Verifies the filter pipeline handles
 *                       sustained concurrent filter requests.
 *                       Endpoint:  POST /api/v1/product/product-filters
 *
 *   single_product    - Continuously fetches a single product by slug. Verifies
 *                       that individual product page loads remain consistent
 *                       under sustained traffic.
 *                       Endpoint:  GET /api/v1/product/get-product/:slug
 *
 *   related_products  - Continuously fetches related products for a given
 *                       product/category ID pair. Verifies the recommendation
 *                       query stays fast under volume.
 *                       Endpoint:  GET /api/v1/product/related-product/:pid/:cid
 *
 *   category_products - Continuously fetches all products under a category slug.
 *                       Verifies category-based product listing handles sustained
 *                       high concurrency.
 *                       Endpoint:  GET /api/v1/product/product-category/:slug
 *
 *   user_orders       - Continuously fetches orders for an authenticated user.
 *                       Verifies that the authenticated orders endpoint stays
 *                       responsive under sustained volume.
 *                       Endpoint:  GET /api/v1/auth/orders  (requires auth token)
 *
 * ─── Optional env vars ────────────────────────────────────────────────────────
 *
 *   BASE_URL            - default: http://localhost:6060
 *   TEST_EMAIL          - existing user email for login (default: test@test.com)
 *   TEST_PASSWORD       - existing user password (default: test1234)
 *   TEST_PRODUCT_SLUG   - product slug for single_product scenario (default: test-product)
 *   TEST_PRODUCT_ID     - product _id for related_products scenario
 *   TEST_CATEGORY_ID    - category _id for related_products scenario
 *   TEST_CATEGORY_SLUG  - category slug for category_products scenario (default: test-category)
 *
 * Test suite written by Mervyn Teo Zi Yan, A0273039A
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

// Mark 404 as a non-failed response (used for endpoints with placeholder slugs/IDs)
const ACCEPT_404 = { responseCallback: http.expectedStatuses(200, 404) };

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:6060";

// Volume stage profile: gradual ramp-up → sustained high load → ramp-down
//
// Ramp-up (50 VUs over 30s): Gradually introduce load so the server can
// warm up its connection pools, JIT caches, and MongoDB connections.
//
// Sustained load (200 VUs for 5 minutes): This is the core of the volume
// test. 200 concurrent virtual users over 5 minutes generates tens of
// thousands of requests, testing whether response times remain stable,
// memory usage stays bounded, and the error rate stays near zero under
// prolonged pressure. This is different from spike testing — the load
// is steady, not sudden.
//
// Ramp-down (0 VUs over 30s): Gracefully reduces load to observe how
// the server recovers and whether any resource cleanup issues appear.
// Mervyn Teo Zi Yan, A0273039A
const VOLUME_STAGES = [
  { duration: "30s", target: 50 },   // ramp up
  { duration: "5m", target: 200 },   // sustained high load
  { duration: "30s", target: 0 },    // ramp down
];

// ─── Custom Metrics ──────────────────────────────────────────────────────────

const loginDuration             = new Trend("login_duration", true);
const productsDuration          = new Trend("products_duration", true);
const searchDuration            = new Trend("search_duration", true);
const filtersDuration           = new Trend("filters_duration", true);
const categoryDuration          = new Trend("category_duration", true);
const singleProductDuration     = new Trend("single_product_duration", true);
const relatedProductsDuration   = new Trend("related_products_duration", true);
const categoryProductsDuration  = new Trend("category_products_duration", true);
const ordersDuration            = new Trend("orders_duration", true);

const errorRate = new Rate("error_rate");
const totalReqs = new Counter("total_requests");

// ─── Thresholds ──────────────────────────────────────────────────────────────

// Mervyn Teo Zi Yan, A0273039A
export const options = {
  scenarios: buildScenarios(),
  thresholds: {
    // Under sustained volume, error rate must stay below 1% (stricter than
    // spike tests because the load is steady and predictable)
    http_req_failed: ["rate<0.01"],
    error_rate:      ["rate<0.01"],

    // 95th-percentile latencies under sustained volume load
    // These are tighter than spike thresholds because the server is not
    // being overwhelmed with sudden bursts — it should maintain consistent
    // performance under steady load.
    login_duration:              ["p(95)<5000"],
    products_duration:           ["p(95)<1500"],
    search_duration:             ["p(95)<2000"],
    filters_duration:            ["p(95)<2000"],
    category_duration:           ["p(95)<1500"],
    single_product_duration:     ["p(95)<1500"],
    related_products_duration:   ["p(95)<1500"],
    category_products_duration:  ["p(95)<1500"],
    orders_duration:             ["p(95)<1500"],

    // Overall p95 set to 5000ms to account for bcrypt latency in auth
    http_req_duration: ["p(95)<5000"],
  },
};

// ─── Setup (runs once before all VUs) ────────────────────────────────────────

/**
 * Obtains an auth token once before the test run.
 * First attempts login with the configured test credentials.
 * If login fails (user not found), registers a new test user and logs in.
 * Returned data is passed to scenario functions that need authentication.
 */
// Mervyn Teo Zi Yan, A0273039A
export function setup() {
  const email    = __ENV.TEST_EMAIL    || "volumetest@volume.test";
  const password = __ENV.TEST_PASSWORD || "Volume1234!";

  // Try to login first
  const loginPayload = JSON.stringify({ email, password });
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, {
    headers: JSON_HEADERS,
  });

  let token = null;
  if (loginRes.status === 200) {
    try {
      const body = JSON.parse(loginRes.body);
      if (body.token) token = body.token;
    } catch { /* no-op */ }
  }

  // If login failed, register a new user and login again
  // Mervyn Teo Zi Yan, A0273039A
  if (!token) {
    const regPayload = JSON.stringify({
      name:     "Volume Test User",
      email:    email,
      password: password,
      phone:    "12345678",
      address:  "123 Volume Test St",
      answer:   "volume",
    });

    http.post(`${BASE_URL}/api/v1/auth/register`, regPayload, {
      headers: JSON_HEADERS,
    });

    // Login with the newly registered user
    const retryRes = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, {
      headers: JSON_HEADERS,
    });

    if (retryRes.status === 200) {
      try {
        const body = JSON.parse(retryRes.body);
        if (body.token) token = body.token;
      } catch { /* no-op */ }
    }
  }

  return { token };
}

// ─── Scenario Builder ────────────────────────────────────────────────────────

// Mervyn Teo Zi Yan, A0273039A
function buildScenarios() {
  const all = {
    /**
     * Volume test: Auth registration and login under sustained load.
     * Verifies that bcrypt hashing does not cause response time degradation
     * over many minutes of continuous auth traffic.
     */
    // Mervyn Teo Zi Yan, A0273039A
    auth_volume: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: VOLUME_STAGES,
      exec: "authScenario",
      tags: { scenario: "auth" },
    },

    /**
     * Volume test: Product browsing under sustained load.
     * Verifies that the product listing, count, and pagination endpoints
     * remain responsive over prolonged high concurrency.
     */
    // Mervyn Teo Zi Yan, A0273039A
    products_volume: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: VOLUME_STAGES,
      startTime: "0s",
      exec: "productsScenario",
      tags: { scenario: "products" },
    },

    /**
     * Volume test: Category listing under sustained load.
     * Verifies that this lightweight read endpoint remains fast even when
     * served to hundreds of concurrent users continuously.
     */
    // Mervyn Teo Zi Yan, A0273039A
    categories_volume: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: VOLUME_STAGES,
      startTime: "0s",
      exec: "categoriesScenario",
      tags: { scenario: "categories" },
    },

    /**
     * Volume test: Search under sustained load.
     * Verifies that MongoDB regex search stays responsive under continuous
     * diverse search traffic.
     */
    // Mervyn Teo Zi Yan, A0273039A
    search_volume: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: VOLUME_STAGES,
      startTime: "0s",
      exec: "searchScenario",
      tags: { scenario: "search" },
    },

    /**
     * Volume test: Product filters under sustained load.
     * Verifies that filter queries with various category and price
     * combinations remain performant over an extended period.
     */
    // Mervyn Teo Zi Yan, A0273039A
    filters_volume: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: VOLUME_STAGES,
      startTime: "0s",
      exec: "filtersScenario",
      tags: { scenario: "filters" },
    },

    /**
     * Volume test: Single product fetch under sustained load.
     * Verifies that repeated reads of a single product document remain
     * consistent and fast over time.
     */
    // Mervyn Teo Zi Yan, A0273039A
    single_product_volume: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: VOLUME_STAGES,
      startTime: "0s",
      exec: "singleProductScenario",
      tags: { scenario: "single_product" },
    },

    /**
     * Volume test: Related products under sustained load.
     * Verifies that the related products query (category match + exclusion)
     * remains fast under prolonged concurrent access.
     */
    // Mervyn Teo Zi Yan, A0273039A
    related_products_volume: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: VOLUME_STAGES,
      startTime: "0s",
      exec: "relatedProductsScenario",
      tags: { scenario: "related_products" },
    },

    /**
     * Volume test: Category products under sustained load.
     * Verifies that fetching all products within a category handles
     * continuous high concurrency without degradation.
     */
    // Mervyn Teo Zi Yan, A0273039A
    category_products_volume: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: VOLUME_STAGES,
      startTime: "0s",
      exec: "categoryProductsScenario",
      tags: { scenario: "category_products" },
    },

    /**
     * Volume test: Authenticated user orders under sustained load.
     * Verifies that the authenticated orders endpoint with populated
     * product/buyer fields handles sustained concurrent reads.
     */
    // Mervyn Teo Zi Yan, A0273039A
    user_orders_volume: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: VOLUME_STAGES,
      startTime: "0s",
      exec: "userOrdersScenario",
      tags: { scenario: "user_orders" },
    },
  };

  const selected = __ENV.SCENARIO;
  if (selected) {
    const key = `${selected}_volume`;
    if (!all[key]) {
      throw new Error(
        `Unknown SCENARIO "${selected}". Valid values: auth, products, categories, search, filters, single_product, related_products, category_products, user_orders`
      );
    }
    return { [key]: all[key] };
  }

  return all;
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────

const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * Attempt login with test credentials.
 * Returns the token string or null on failure.
 */
// Mervyn Teo Zi Yan, A0273039A
function login() {
  const payload = JSON.stringify({
    email:    __ENV.TEST_EMAIL    || "volumetest@volume.test",
    password: __ENV.TEST_PASSWORD || "Volume1234!",
  });

  const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
    headers: JSON_HEADERS,
    tags: { name: "POST /api/v1/auth/login" },
  });

  loginDuration.add(res.timings.duration);
  totalReqs.add(1);

  const ok = check(res, {
    "login: status is 200": (r) => r.status === 200,
    "login: has token":     (r) => {
      try { return !!JSON.parse(r.body).token; } catch { return false; }
    },
  });

  errorRate.add(!ok);

  if (res.status === 200) {
    try { return JSON.parse(res.body).token; } catch { return null; }
  }
  return null;
}

function authHeader(token) {
  return { Authorization: token };
}

// ─── Scenario: Auth ──────────────────────────────────────────────────────────

/**
 * Volume test: Auth registration and login under sustained load.
 *
 * Continuously registers unique users and immediately logs them in.
 * Under sustained load, this verifies:
 *  - bcrypt hashing does not cause cumulative response time increases
 *  - JWT token generation remains consistent
 *  - MongoDB write operations (user creation) remain stable
 *  - Connection pool is not exhausted over time
 *
 * Endpoints: POST /api/v1/auth/register, POST /api/v1/auth/login
 */
// Mervyn Teo Zi Yan, A0273039A
export function authScenario() {
  group("auth", () => {
    // Register a unique user per VU iteration
    // Mervyn Teo Zi Yan, A0273039A
    const uid     = `${__VU}_${__ITER}_${Date.now()}`;
    const payload = JSON.stringify({
      name:     `VolumeUser ${uid}`,
      email:    `voluser_${uid}@volume.test`,
      password: "Volume1234!",
      phone:    "12345678",
      address:  "123 Volume Test St",
      answer:   "volume",
    });

    const regRes = http.post(`${BASE_URL}/api/v1/auth/register`, payload, {
      headers: JSON_HEADERS,
      tags: { name: "POST /api/v1/auth/register" },
    });

    totalReqs.add(1);
    loginDuration.add(regRes.timings.duration);

    const regOk = check(regRes, {
      "register: status 201 or 200": (r) => r.status === 200 || r.status === 201,
      "register: success field":     (r) => {
        try { return JSON.parse(r.body).success !== undefined; } catch { return false; }
      },
    });
    errorRate.add(!regOk);

    sleep(0.5);

    // Login with the same credentials
    // Mervyn Teo Zi Yan, A0273039A
    const loginPayload = JSON.stringify({
      email:    `voluser_${uid}@volume.test`,
      password: "Volume1234!",
    });

    const loginRes = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, {
      headers: JSON_HEADERS,
      tags: { name: "POST /api/v1/auth/login" },
    });

    loginDuration.add(loginRes.timings.duration);
    totalReqs.add(1);

    const loginOk = check(loginRes, {
      "login: status 200":   (r) => r.status === 200,
      "login: token exists": (r) => {
        try { return !!JSON.parse(r.body).token; } catch { return false; }
      },
      "login: success true": (r) => {
        try { return JSON.parse(r.body).success === true; } catch { return false; }
      },
    });
    errorRate.add(!loginOk);
  });

  sleep(1);
}

// ─── Scenario: Products ──────────────────────────────────────────────────────

/**
 * Volume test: Product browsing under sustained load.
 *
 * Continuously fetches the full product list, product count, and paginated
 * product pages. Under sustained load, this verifies:
 *  - MongoDB read queries with .populate() remain stable
 *  - Pagination logic handles concurrent page requests
 *  - Response times do not degrade over the 5-minute sustained period
 *
 * Endpoints:
 *   GET /api/v1/product/get-product
 *   GET /api/v1/product/product-count
 *   GET /api/v1/product/product-list/:page
 */
// Mervyn Teo Zi Yan, A0273039A
export function productsScenario() {
  group("products", () => {
    // List all products
    // Mervyn Teo Zi Yan, A0273039A
    const listRes = http.get(`${BASE_URL}/api/v1/product/get-product`, {
      tags: { name: "GET /api/v1/product/get-product" },
    });

    productsDuration.add(listRes.timings.duration);
    totalReqs.add(1);

    const listOk = check(listRes, {
      "get-product: status 200":         (r) => r.status === 200,
      "get-product: has products array": (r) => {
        try { return Array.isArray(JSON.parse(r.body).products); } catch { return false; }
      },
      "get-product: success true":       (r) => {
        try { return JSON.parse(r.body).success === true; } catch { return false; }
      },
    });
    errorRate.add(!listOk);

    sleep(0.3);

    // Product count
    // Mervyn Teo Zi Yan, A0273039A
    const countRes = http.get(`${BASE_URL}/api/v1/product/product-count`, {
      tags: { name: "GET /api/v1/product/product-count" },
    });

    productsDuration.add(countRes.timings.duration);
    totalReqs.add(1);

    const countOk = check(countRes, {
      "product-count: status 200":   (r) => r.status === 200,
      "product-count: has total":    (r) => {
        try { return JSON.parse(r.body).total !== undefined; } catch { return false; }
      },
    });
    errorRate.add(!countOk);

    sleep(0.3);

    // Paginated list — cycle through pages 1-3 based on VU and iteration
    // Mervyn Teo Zi Yan, A0273039A
    const page = (__ITER % 3) + 1;
    const pageRes = http.get(`${BASE_URL}/api/v1/product/product-list/${page}`, {
      tags: { name: "GET /api/v1/product/product-list/:page" },
    });

    productsDuration.add(pageRes.timings.duration);
    totalReqs.add(1);

    const pageOk = check(pageRes, {
      "product-list: status 200":     (r) => r.status === 200,
      "product-list: has products":   (r) => {
        try { return Array.isArray(JSON.parse(r.body).products); } catch { return false; }
      },
    });
    errorRate.add(!pageOk);
  });

  sleep(1);
}

// ─── Scenario: Categories ────────────────────────────────────────────────────

/**
 * Volume test: Category listing under sustained load.
 *
 * Continuously fetches the complete category list. Under sustained load,
 * this verifies:
 *  - MongoDB .find({}) on the categories collection remains fast
 *  - Express JSON serialization handles repeated calls without issues
 *  - No memory leaks from repeated category list fetches
 *
 * Endpoints: GET /api/v1/category/get-category
 */
// Mervyn Teo Zi Yan, A0273039A
export function categoriesScenario() {
  group("categories", () => {
    // Mervyn Teo Zi Yan, A0273039A
    const res = http.get(`${BASE_URL}/api/v1/category/get-category`, {
      tags: { name: "GET /api/v1/category/get-category" },
    });

    categoryDuration.add(res.timings.duration);
    totalReqs.add(1);

    const ok = check(res, {
      "get-category: status 200":        (r) => r.status === 200,
      "get-category: has category array": (r) => {
        try { return Array.isArray(JSON.parse(r.body).category); } catch { return false; }
      },
      "get-category: success true":      (r) => {
        try { return JSON.parse(r.body).success === true; } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

// ─── Scenario: Search ────────────────────────────────────────────────────────

const SEARCH_KEYWORDS = ["shirt", "phone", "book", "laptop", "shoes", "watch", "bag", "jacket", "ring", "table"];

/**
 * Volume test: Search under sustained load.
 *
 * Continuously searches for products using a rotating set of 10 keywords.
 * Under sustained load, this verifies:
 *  - MongoDB $regex search performance remains stable across many queries
 *  - The $or query (matching name or description) handles concurrent access
 *  - No index scan degradation over time
 *
 * Endpoints: GET /api/v1/product/search/:keyword
 */
// Mervyn Teo Zi Yan, A0273039A
export function searchScenario() {
  group("search", () => {
    // Mervyn Teo Zi Yan, A0273039A
    const keyword = SEARCH_KEYWORDS[(__VU + __ITER) % SEARCH_KEYWORDS.length];

    const res = http.get(`${BASE_URL}/api/v1/product/search/${keyword}`, {
      tags: { name: "GET /api/v1/product/search/:keyword" },
    });

    searchDuration.add(res.timings.duration);
    totalReqs.add(1);

    const ok = check(res, {
      "search: status 200":     (r) => r.status === 200,
      "search: returns array":  (r) => {
        try { return Array.isArray(JSON.parse(r.body)); } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

// ─── Scenario: Filters ───────────────────────────────────────────────────────

// Diverse filter combinations to exercise different query patterns
// Mervyn Teo Zi Yan, A0273039A
const FILTER_PAYLOADS = [
  { checked: [], radio: [] },                          // no filters (all products)
  { checked: [], radio: [0, 19] },                     // price range: $0-$19
  { checked: [], radio: [20, 39] },                    // price range: $20-$39
  { checked: [], radio: [40, 59] },                    // price range: $40-$59
  { checked: [], radio: [60, 79] },                    // price range: $60-$79
  { checked: [], radio: [80, 99] },                    // price range: $80-$99
  { checked: [], radio: [100, 9999] },                 // price range: $100+
  { checked: [], radio: [], page: 1 },                 // page 1
  { checked: [], radio: [], page: 2 },                 // page 2
  { checked: [], radio: [], page: 3 },                 // page 3
];

/**
 * Volume test: Product filters under sustained load.
 *
 * Continuously applies diverse filter combinations (price ranges, pagination)
 * to exercise the product filter pipeline. Under sustained load, this verifies:
 *  - MongoDB compound queries ($gte/$lte, category matching) remain fast
 *  - Pagination with skip/limit handles concurrent requests
 *  - countDocuments() remains responsive under volume
 *
 * Endpoints: POST /api/v1/product/product-filters
 */
// Mervyn Teo Zi Yan, A0273039A
export function filtersScenario() {
  group("filters", () => {
    // Mervyn Teo Zi Yan, A0273039A
    const filterData = FILTER_PAYLOADS[(__VU + __ITER) % FILTER_PAYLOADS.length];
    const payload = JSON.stringify(filterData);

    const res = http.post(`${BASE_URL}/api/v1/product/product-filters`, payload, {
      headers: JSON_HEADERS,
      tags: { name: "POST /api/v1/product/product-filters" },
    });

    filtersDuration.add(res.timings.duration);
    totalReqs.add(1);

    const ok = check(res, {
      "product-filters: status 200":   (r) => r.status === 200,
      "product-filters: has products": (r) => {
        try { return Array.isArray(JSON.parse(r.body).products); } catch { return false; }
      },
      "product-filters: success true": (r) => {
        try { return JSON.parse(r.body).success === true; } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

// ─── Scenario: Single Product ────────────────────────────────────────────────

/**
 * Volume test: Single product fetch under sustained load.
 *
 * Continuously fetches a single product by slug. Under sustained load, this
 * verifies:
 *  - MongoDB .findOne() with .populate("category") remains consistent
 *  - No connection pool exhaustion from repeated single-document reads
 *  - Response time stability over the sustained period
 *
 * Endpoints: GET /api/v1/product/get-product/:slug
 *
 * Configure via: -e TEST_PRODUCT_SLUG=my-product-slug
 */
// Mervyn Teo Zi Yan, A0273039A
export function singleProductScenario() {
  group("single_product", () => {
    // Mervyn Teo Zi Yan, A0273039A
    const slug = __ENV.TEST_PRODUCT_SLUG || "test-product";

    const res = http.get(`${BASE_URL}/api/v1/product/get-product/${slug}`, {
      tags: { name: "GET /api/v1/product/get-product/:slug" },
      ...ACCEPT_404,
    });

    singleProductDuration.add(res.timings.duration);
    totalReqs.add(1);

    const ok = check(res, {
      "single product: status 200 or 404": (r) => r.status === 200 || r.status === 404,
      "single product: response is JSON":  (r) => {
        try { JSON.parse(r.body); return true; } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

// ─── Scenario: Related Products ──────────────────────────────────────────────

/**
 * Volume test: Related products under sustained load.
 *
 * Continuously fetches related products for a given product/category pair.
 * Under sustained load, this verifies:
 *  - The exclusion query ($ne) combined with category filter stays fast
 *  - .populate("category") on related products handles sustained access
 *  - No slow query accumulation over the 5-minute window
 *
 * Endpoints: GET /api/v1/product/related-product/:pid/:cid
 *
 * Configure via: -e TEST_PRODUCT_ID=<id> -e TEST_CATEGORY_ID=<id>
 */
// Mervyn Teo Zi Yan, A0273039A
export function relatedProductsScenario() {
  group("related_products", () => {
    // Mervyn Teo Zi Yan, A0273039A
    const pid = __ENV.TEST_PRODUCT_ID  || "000000000000000000000001";
    const cid = __ENV.TEST_CATEGORY_ID || "000000000000000000000001";

    const res = http.get(`${BASE_URL}/api/v1/product/related-product/${pid}/${cid}`, {
      tags: { name: "GET /api/v1/product/related-product/:pid/:cid" },
      ...ACCEPT_404,
    });

    relatedProductsDuration.add(res.timings.duration);
    totalReqs.add(1);

    const ok = check(res, {
      "related-product: status 200 or 404": (r) => r.status === 200 || r.status === 404,
      "related-product: response is JSON":  (r) => {
        try { JSON.parse(r.body); return true; } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

// ─── Scenario: Category Products ─────────────────────────────────────────────

/**
 * Volume test: Category products under sustained load.
 *
 * Continuously fetches all products belonging to a category slug. Under
 * sustained load, this verifies:
 *  - Two-step query (find category by slug, then find products by category)
 *   remains efficient under volume
 *  - No degradation from repeated full-collection scans within a category
 *
 * Endpoints: GET /api/v1/product/product-category/:slug
 *
 * Configure via: -e TEST_CATEGORY_SLUG=my-category-slug
 */
// Mervyn Teo Zi Yan, A0273039A
export function categoryProductsScenario() {
  group("category_products", () => {
    // Mervyn Teo Zi Yan, A0273039A
    const slug = __ENV.TEST_CATEGORY_SLUG || "test-category";

    const res = http.get(`${BASE_URL}/api/v1/product/product-category/${slug}`, {
      tags: { name: "GET /api/v1/product/product-category/:slug" },
      ...ACCEPT_404,
    });

    categoryProductsDuration.add(res.timings.duration);
    totalReqs.add(1);

    const ok = check(res, {
      "product-category: status 200 or 404": (r) => r.status === 200 || r.status === 404,
      "product-category: response is JSON":  (r) => {
        try { JSON.parse(r.body); return true; } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

// ─── Scenario: User Orders ───────────────────────────────────────────────────

/**
 * Volume test: Authenticated user orders under sustained load.
 *
 * Continuously fetches orders for an authenticated user. Under sustained
 * load, this verifies:
 *  - JWT token validation handles sustained concurrent requests
 *  - MongoDB .populate("products") and .populate("buyer") remain efficient
 *  - The authenticated middleware does not become a bottleneck under volume
 *
 * Endpoints: GET /api/v1/auth/orders (requires auth token)
 *
 * A token is obtained once in setup() and shared across all VUs.
 */
// Mervyn Teo Zi Yan, A0273039A
export function userOrdersScenario(data) {
  group("user_orders", () => {
    // Fall back to per-VU login if setup() did not produce a token
    // Mervyn Teo Zi Yan, A0273039A
    const token = (data && data.token) ? data.token : login();

    if (!token) {
      errorRate.add(1);
      return;
    }

    const res = http.get(`${BASE_URL}/api/v1/auth/orders`, {
      headers: authHeader(token),
      tags: { name: "GET /api/v1/auth/orders" },
    });

    ordersDuration.add(res.timings.duration);
    totalReqs.add(1);

    const ok = check(res, {
      "orders: status 200":       (r) => r.status === 200,
      "orders: response is JSON": (r) => {
        try { JSON.parse(r.body); return true; } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });

  sleep(1);
}
