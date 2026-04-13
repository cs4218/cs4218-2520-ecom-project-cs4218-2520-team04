const path = require("path");
const express = require("express");
const request = require("supertest");

describe("integration: PUT /update-category/:id - requireSignIn -> isAdmin -> updateCategoryController", () => {
  it("blocks unauthenticated, blocks non-admin, allows admin and handles invalid id", async () => {
    // reset module registry to ensure our mocks are used when routes are imported
    jest.resetModules();

    // resolve absolute paths for modules referenced by routes/categoryRoutes.js
    const authPath = path.resolve(__dirname, "../../../../middlewares/authMiddleware.js");
    const controllersPath = path.resolve(__dirname, "../../../../controllers/categoryController.js");
    const routesPath = path.resolve(__dirname, "../../../../routes/categoryRoutes.js");

    // Provide mocks for middlewares so route registration won't receive undefined
    jest.doMock(
      authPath,
      () => ({
        // initial harmless passthrough implementations; tests will override via mockImplementation
        requireSignIn: jest.fn((req, res, next) => next()),
        isAdmin: jest.fn((req, res, next) => next()),
      }),
      { virtual: false }
    );

    // Provide mocks for controllers so route registration won't receive undefined
    jest.doMock(
      controllersPath,
      () => ({
        categoryController: jest.fn((req, res) => res.status(200).json({ ok: true })),
        createCategoryController: jest.fn((req, res) => res.status(200).json({ ok: true })),
        deleteCategoryController: jest.fn((req, res) => res.status(200).json({ ok: true })),
        singleCategoryController: jest.fn((req, res) => res.status(200).json({ ok: true })),
        updateCategoryController: jest.fn((req, res) =>
          res.status(200).json({ ok: true, updatedId: req.params.id })
        ),
      }),
      { virtual: false }
    );

    // require the mocked modules to adjust their implementations during the test
    const authMock = require(authPath);
    const controllersMock = require(controllersPath);

    // import the router after mocks are in place
    const router = require(routesPath).default;

    const app = express();
    app.use(express.json());
    app.use(router);

    // 1) Unauthenticated should be blocked by requireSignIn (401) and controller not invoked
    authMock.requireSignIn.mockImplementation((req, res) =>
      res.status(401).json({ error: "Unauthorized" })
    );
    // Ensure isAdmin would not be reached, but provide safe fallback
    authMock.isAdmin.mockImplementation((req, res, next) => next());

    controllersMock.updateCategoryController.mockClear();

    let res = await request(app).put("/update-category/123").send({ name: "New" });
    expect(res.status).toBe(401);
    expect(controllersMock.updateCategoryController).not.toHaveBeenCalled();

    // 2) Authenticated non-admin should be blocked by isAdmin (403) and controller not invoked
    authMock.requireSignIn.mockImplementation((req, res, next) => next());
    authMock.isAdmin.mockImplementation((req, res) => res.status(403).json({ error: "Forbidden" }));

    controllersMock.updateCategoryController.mockClear();

    res = await request(app).put("/update-category/123").send({ name: "New" });
    expect(res.status).toBe(403);
    expect(controllersMock.updateCategoryController).not.toHaveBeenCalled();

    // 3) Authenticated admin should pass both middlewares and invoke updateCategoryController (200)
    authMock.requireSignIn.mockImplementation((req, res, next) => next());
    authMock.isAdmin.mockImplementation((req, res, next) => next());

    controllersMock.updateCategoryController.mockClear();
    controllersMock.updateCategoryController.mockImplementation((req, res) =>
      res.status(200).json({ ok: true, updatedId: req.params.id })
    );

    res = await request(app).put("/update-category/456").send({ name: "Updated" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("updatedId", "456");
    expect(controllersMock.updateCategoryController).toHaveBeenCalledTimes(1);

    // 4) Invalid id path: after middlewares pass, controller should be able to return 400 for invalid id
    controllersMock.updateCategoryController.mockClear();
    controllersMock.updateCategoryController.mockImplementation((req, res) => {
      if (req.params.id === "bad") return res.status(400).json({ error: "Invalid id" });
      return res.status(200).json({ ok: true });
    });

    res = await request(app).put("/update-category/bad").send({ name: "x" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid id");
    expect(controllersMock.updateCategoryController).toHaveBeenCalledTimes(1);
  });
});
