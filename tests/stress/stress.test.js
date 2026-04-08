// Tan Wei Lian, A0269750U
//
// Grafana k6 Stress Test Suite
//
// Purpose:
// - Stress-test the ecommerce backend under sustained high load.
// - Focus on the most likely backend bottlenecks in this repo:
//   authentication, catalogue/search/filter flows, and authenticated orders.
//
// Stress profile:
// - Ramp gradually from a light baseline to sustained stress load.
// - Hold the system under pressure long enough to expose latency growth,
//   elevated error rates, and bottlenecks in CPU-heavy / DB-heavy paths.
//
// Scenario selection:
// - Run all scenarios by default.
// - Run one scenario with: k6 run -e SCENARIO=auth tests/stress/stress.test.js
//
// Optional env vars:
// - BASE_URL=http://localhost:6060
// - SCENARIO=auth|catalog|orders
// - TEST_EMAIL=test@admin.com
// - TEST_PASSWORD=test@admin.com
// - SEARCH_KEYWORDS=laptop,phone,book,watch
// - STRESS_BASE_VUS=50
// - STRESS_HIGH_VUS=200
// - STRESS_PEAK_VUS=400
// - STRESS_BASE_HOLD=2m
// - STRESS_HIGH_HOLD=3m
// - STRESS_PEAK_HOLD=2m
// - STRESS_RAMP_UP=1m
// - STRESS_RAMP_DOWN=1m

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:6060";
const JSON_HEADERS = { "Content-Type": "application/json" };

const baseVUs = Number(__ENV.STRESS_BASE_VUS || 50);
const highVUs = Number(__ENV.STRESS_HIGH_VUS || 200);
const peakVUs = Number(__ENV.STRESS_PEAK_VUS || 400);
const rampUp = __ENV.STRESS_RAMP_UP || "1m";
const baseHold = __ENV.STRESS_BASE_HOLD || "2m";
const highHold = __ENV.STRESS_HIGH_HOLD || "3m";
const peakHold = __ENV.STRESS_PEAK_HOLD || "2m";
const rampDown = __ENV.STRESS_RAMP_DOWN || "1m";

const SEARCH_KEYWORDS = (__ENV.SEARCH_KEYWORDS || "laptop,phone,book,watch,keyboard,monitor")
  .split(",")
  .map((keyword) => keyword.trim())
  .filter(Boolean);

const authDuration = new Trend("auth_stress_duration", true);
const catalogDuration = new Trend("catalog_stress_duration", true);
const ordersDuration = new Trend("orders_stress_duration", true);
const scenarioErrors = new Rate("scenario_error_rate");
const totalRequests = new Counter("stress_total_requests");

function buildStressStages() {
  return [
    { duration: rampUp, target: baseVUs },
    { duration: baseHold, target: baseVUs },
    { duration: rampUp, target: highVUs },
    { duration: highHold, target: highVUs },
    { duration: rampUp, target: peakVUs },
    { duration: peakHold, target: peakVUs },
    { duration: rampDown, target: 0 },
  ];
}

export const options = {
  scenarios: buildScenarios(),
  thresholds: {
    http_req_failed: ["rate<0.10"],
    scenario_error_rate: ["rate<0.10"],
    auth_stress_duration: ["p(95)<5000"],
    catalog_stress_duration: ["p(95)<2500"],
    orders_stress_duration: ["p(95)<3000"],
    http_req_duration: ["p(95)<4000"],
  },
};

export function setup() {
  const payload = JSON.stringify({
    email: __ENV.TEST_EMAIL || "test@admin.com",
    password: __ENV.TEST_PASSWORD || "test@admin.com",
  });

  const response = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
    headers: JSON_HEADERS,
    tags: { name: "POST /api/v1/auth/login" },
  });

  let token = null;
  if (response.status === 200) {
    try {
      token = JSON.parse(response.body).token || null;
    } catch {
      token = null;
    }
  }

  return { token };
}

function buildScenarios() {
  const stages = buildStressStages();
  const allScenarios = {
    // Tan Wei Lian, A0269750U
    auth_stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages,
      exec: "authScenario",
      tags: { scenario: "auth" },
    },
    // Tan Wei Lian, A0269750U
    catalog_stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages,
      exec: "catalogScenario",
      tags: { scenario: "catalog" },
    },
    // Tan Wei Lian, A0269750U
    orders_stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages,
      exec: "ordersScenario",
      tags: { scenario: "orders" },
    },
  };

  const selected = __ENV.SCENARIO;
  if (!selected) {
    return allScenarios;
  }

  const key = `${selected}_stress`;
  if (!allScenarios[key]) {
    throw new Error(
      `Unknown SCENARIO "${selected}". Valid values: auth, catalog, orders`
    );
  }

  return { [key]: allScenarios[key] };
}

function addResult(metric, response, assertions) {
  metric.add(response.timings.duration);
  totalRequests.add(1);
  const ok = check(response, assertions);
  scenarioErrors.add(!ok);
  return ok;
}

function loginWithTestAccount() {
  const payload = JSON.stringify({
    email: __ENV.TEST_EMAIL || "test@admin.com",
    password: __ENV.TEST_PASSWORD || "test@admin.com",
  });

  const response = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
    headers: JSON_HEADERS,
    tags: { name: "POST /api/v1/auth/login" },
  });

  addResult(authDuration, response, {
    "login returns 200": (res) => res.status === 200,
    "login returns token": (res) => {
      try {
        return Boolean(JSON.parse(res.body).token);
      } catch {
        return false;
      }
    },
  });

  if (response.status !== 200) {
    return null;
  }

  try {
    return JSON.parse(response.body).token || null;
  } catch {
    return null;
  }
}

function getAuthHeaders(token) {
  return { Authorization: token };
}

// Tan Wei Lian, A0269750U
export function authScenario() {
  group("auth_stress", () => {
    const uniqueId = `${__VU}_${__ITER}_${Date.now()}`;
    const password = "Stress1234!";

    const registerPayload = JSON.stringify({
      name: `Stress User ${uniqueId}`,
      email: `stress_${uniqueId}@example.com`,
      password,
      phone: "12345678",
      address: "123 Stress Street",
      answer: "stress",
    });

    const registerResponse = http.post(
      `${BASE_URL}/api/v1/auth/register`,
      registerPayload,
      {
        headers: JSON_HEADERS,
        tags: { name: "POST /api/v1/auth/register" },
      }
    );

    addResult(authDuration, registerResponse, {
      "register returns success code": (res) => res.status === 200 || res.status === 201,
    });

    const loginPayload = JSON.stringify({
      email: `stress_${uniqueId}@example.com`,
      password,
    });

    const loginResponse = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, {
      headers: JSON_HEADERS,
      tags: { name: "POST /api/v1/auth/login" },
    });

    addResult(authDuration, loginResponse, {
      "fresh login returns 200": (res) => res.status === 200,
      "fresh login returns token": (res) => {
        try {
          return Boolean(JSON.parse(res.body).token);
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}

// Tan Wei Lian, A0269750U
export function catalogScenario() {
  group("catalog_stress", () => {
    const page = (__ITER % 3) + 1;
    const keyword = SEARCH_KEYWORDS[(__VU + __ITER) % SEARCH_KEYWORDS.length];
    const priceBands = [
      [],
      [0, 50],
      [50, 150],
      [150, 500],
    ];
    const radio = priceBands[(__VU + __ITER) % priceBands.length];

    const categoriesResponse = http.get(`${BASE_URL}/api/v1/category/get-category`, {
      tags: { name: "GET /api/v1/category/get-category" },
    });

    addResult(catalogDuration, categoriesResponse, {
      "categories returns 200": (res) => res.status === 200,
      "categories returns array": (res) => {
        try {
          return Array.isArray(JSON.parse(res.body).category);
        } catch {
          return false;
        }
      },
    });

    const productsResponse = http.get(`${BASE_URL}/api/v1/product/get-product`, {
      tags: { name: "GET /api/v1/product/get-product" },
    });

    addResult(catalogDuration, productsResponse, {
      "products returns 200": (res) => res.status === 200,
      "products returns list": (res) => {
        try {
          return Array.isArray(JSON.parse(res.body).products);
        } catch {
          return false;
        }
      },
    });

    const countResponse = http.get(`${BASE_URL}/api/v1/product/product-count`, {
      tags: { name: "GET /api/v1/product/product-count" },
    });

    addResult(catalogDuration, countResponse, {
      "product count returns 200": (res) => res.status === 200,
    });

    const listResponse = http.get(`${BASE_URL}/api/v1/product/product-list/${page}`, {
      tags: { name: "GET /api/v1/product/product-list/:page" },
    });

    addResult(catalogDuration, listResponse, {
      "paged list returns 200": (res) => res.status === 200,
      "paged list returns products": (res) => {
        try {
          return Array.isArray(JSON.parse(res.body).products);
        } catch {
          return false;
        }
      },
    });

    const searchResponse = http.get(`${BASE_URL}/api/v1/product/search/${keyword}`, {
      tags: { name: "GET /api/v1/product/search/:keyword" },
    });

    addResult(catalogDuration, searchResponse, {
      "search returns 200": (res) => res.status === 200,
      "search returns array": (res) => {
        try {
          return Array.isArray(JSON.parse(res.body));
        } catch {
          return false;
        }
      },
    });

    const filtersPayload = JSON.stringify({
      checked: [],
      radio,
      page,
    });

    const filtersResponse = http.post(
      `${BASE_URL}/api/v1/product/product-filters`,
      filtersPayload,
      {
        headers: JSON_HEADERS,
        tags: { name: "POST /api/v1/product/product-filters" },
      }
    );

    addResult(catalogDuration, filtersResponse, {
      "filters returns 200": (res) => res.status === 200,
      "filters returns products": (res) => {
        try {
          return Array.isArray(JSON.parse(res.body).products);
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}

// Tan Wei Lian, A0269750U
export function ordersScenario(data) {
  group("orders_stress", () => {
    const token = data && data.token ? data.token : loginWithTestAccount();
    if (!token) {
      scenarioErrors.add(1);
      return;
    }

    const ordersResponse = http.get(`${BASE_URL}/api/v1/auth/orders`, {
      headers: getAuthHeaders(token),
      tags: { name: "GET /api/v1/auth/orders" },
    });

    addResult(ordersDuration, ordersResponse, {
      "orders returns 200": (res) => res.status === 200,
      "orders returns JSON": (res) => {
        try {
          JSON.parse(res.body);
          return true;
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}
