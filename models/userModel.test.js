//
// Tan Wei Lian, A0269750U
//
import mongoose from "mongoose";
import userModel from "./userModel.js";

// Valid user data shared across tests
const validUserData = () => ({
  name: "John Doe",
  email: "john@example.com",
  password: "hashedPassword123",
  phone: "1234567890",
  address: "123 Main St",
  answer: "my pet",
});

describe("userModel", () => {
  // ─────────────────────────────────────────────────────────────
  // Schema definition
  // ─────────────────────────────────────────────────────────────
  describe("schema definition", () => {
    const schemaPaths = userModel.schema.paths;

    test("should be registered with model name 'users'", () => {
      // Arrange & Act — model was registered at import time
      // Assert
      expect(userModel.modelName).toBe("users");
    });

    test("should have a name field of type String", () => {
      // Assert
      expect(schemaPaths.name).toBeDefined();
      expect(schemaPaths.name.instance).toBe("String");
    });

    test("should have an email field of type String", () => {
      // Assert
      expect(schemaPaths.email).toBeDefined();
      expect(schemaPaths.email.instance).toBe("String");
    });

    test("should have a password field of type String", () => {
      // Assert
      expect(schemaPaths.password).toBeDefined();
      expect(schemaPaths.password.instance).toBe("String");
    });

    test("should have a phone field of type String", () => {
      // Assert
      expect(schemaPaths.phone).toBeDefined();
      expect(schemaPaths.phone.instance).toBe("String");
    });

    test("should have an address field of type String", () => {
      // Assert
      expect(schemaPaths.address).toBeDefined();
      expect(schemaPaths.address.instance).toBe("String");
    });

    test("should have an answer field of type String", () => {
      // Assert
      expect(schemaPaths.answer).toBeDefined();
      expect(schemaPaths.answer.instance).toBe("String");
    });

    test("should have a role field of type Number", () => {
      // Assert
      expect(schemaPaths.role).toBeDefined();
      expect(schemaPaths.role.instance).toBe("Number");
    });

    test("should mark name as required with trim enabled", () => {
      // Assert
      expect(schemaPaths.name.isRequired).toBe(true);
      expect(schemaPaths.name.options.trim).toBe(true);
    });

    test("should mark email as required and unique", () => {
      // Assert
      expect(schemaPaths.email.isRequired).toBe(true);
      expect(schemaPaths.email.options.unique).toBe(true);
    });

    test("should mark password as required", () => {
      // Assert
      expect(schemaPaths.password.isRequired).toBe(true);
    });

    test("should mark phone as required", () => {
      // Assert
      expect(schemaPaths.phone.isRequired).toBe(true);
    });

    test("should mark address as required", () => {
      // Assert
      expect(schemaPaths.address.isRequired).toBe(true);
    });

    test("should mark answer as required", () => {
      // Assert
      expect(schemaPaths.answer.isRequired).toBe(true);
    });

    test("should not mark role as required", () => {
      // Assert
      expect(schemaPaths.role.isRequired).toBeFalsy();
    });

    test("should set default role to 0", () => {
      // Assert
      expect(schemaPaths.role.defaultValue).toBe(0);
    });

    test("should enable timestamps", () => {
      // Assert
      expect(userModel.schema.options.timestamps).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Validation — happy path
  // ─────────────────────────────────────────────────────────────
  describe("validation - valid documents", () => {
    test("should pass validation with all required fields", () => {
      // Arrange
      const user = new userModel(validUserData());

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeUndefined();
    });

    test("should pass validation when role is omitted (uses default)", () => {
      // Arrange — no role provided
      const user = new userModel(validUserData());

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeUndefined();
      expect(user.role).toBe(0);
    });

    test("should pass validation when role is explicitly set", () => {
      // Arrange
      const user = new userModel({ ...validUserData(), role: 1 });

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeUndefined();
      expect(user.role).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Validation — missing required fields
  // ─────────────────────────────────────────────────────────────
  describe("validation - missing required fields", () => {
    test("should fail when name is missing", () => {
      // Arrange
      const data = validUserData();
      delete data.name;
      const user = new userModel(data);

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.name).toBeDefined();
    });

    test("should fail when email is missing", () => {
      // Arrange
      const data = validUserData();
      delete data.email;
      const user = new userModel(data);

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.email).toBeDefined();
    });

    test("should fail when password is missing", () => {
      // Arrange
      const data = validUserData();
      delete data.password;
      const user = new userModel(data);

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.password).toBeDefined();
    });

    test("should fail when phone is missing", () => {
      // Arrange
      const data = validUserData();
      delete data.phone;
      const user = new userModel(data);

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.phone).toBeDefined();
    });

    test("should fail when address is missing", () => {
      // Arrange
      const data = validUserData();
      delete data.address;
      const user = new userModel(data);

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.address).toBeDefined();
    });

    test("should fail when answer is missing", () => {
      // Arrange
      const data = validUserData();
      delete data.answer;
      const user = new userModel(data);

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.answer).toBeDefined();
    });

    test("should fail with errors for all required fields when document is empty", () => {
      // Arrange
      const user = new userModel({});

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.name).toBeDefined();
      expect(err.errors.email).toBeDefined();
      expect(err.errors.password).toBeDefined();
      expect(err.errors.phone).toBeDefined();
      expect(err.errors.address).toBeDefined();
      expect(err.errors.answer).toBeDefined();
      expect(err.errors.role).toBeUndefined(); // role has default, not required
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Default values
  // ─────────────────────────────────────────────────────────────
  describe("default values", () => {
    test("should default role to 0 when not provided", () => {
      // Arrange
      const user = new userModel(validUserData());

      // Assert
      expect(user.role).toBe(0);
    });

    test("should use provided role instead of default", () => {
      // Arrange
      const user = new userModel({ ...validUserData(), role: 2 });

      // Assert
      expect(user.role).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Trim behavior
  // ─────────────────────────────────────────────────────────────
  describe("trim", () => {
    test("should trim whitespace from name", () => {
      // Arrange
      const user = new userModel({ ...validUserData(), name: "  John Doe  " });

      // Assert
      expect(user.name).toBe("John Doe");
    });

    test("should not trim whitespace from email", () => {
      // Arrange — email does not have trim option
      const user = new userModel({ ...validUserData(), email: "  john@example.com  " });

      // Assert — email is stored as-is (no trim in schema)
      expect(user.email).toBe("  john@example.com  ");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Timestamps
  // ─────────────────────────────────────────────────────────────
  describe("timestamps", () => {
    test("should have createdAt path from timestamps option", () => {
      // Assert
      expect(userModel.schema.paths.createdAt).toBeDefined();
    });

    test("should have updatedAt path from timestamps option", () => {
      // Assert
      expect(userModel.schema.paths.updatedAt).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Edge cases & boundary values
  // ─────────────────────────────────────────────────────────────
  describe("edge cases", () => {
    test("should fail validation when name is empty string", () => {
      // Arrange
      const user = new userModel({ ...validUserData(), name: "" });

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.name).toBeDefined();
    });

    test("should fail validation when email is empty string", () => {
      // Arrange
      const user = new userModel({ ...validUserData(), email: "" });

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.email).toBeDefined();
    });

    test("should fail validation when password is empty string", () => {
      // Arrange
      const user = new userModel({ ...validUserData(), password: "" });

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.password).toBeDefined();
    });

    test("should fail validation when phone is empty string", () => {
      // Arrange
      const user = new userModel({ ...validUserData(), phone: "" });

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.phone).toBeDefined();
    });

    test("should fail validation when address is empty string", () => {
      // Arrange
      const user = new userModel({ ...validUserData(), address: "" });

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.address).toBeDefined();
    });

    test("should fail validation when answer is empty string", () => {
      // Arrange
      const user = new userModel({ ...validUserData(), answer: "" });

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeDefined();
      expect(err.errors.answer).toBeDefined();
    });

    test("should accept role of 0 explicitly", () => {
      // Arrange
      const user = new userModel({ ...validUserData(), role: 0 });

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeUndefined();
      expect(user.role).toBe(0);
    });

    test("should accept single-character name after trim", () => {
      // Arrange
      const user = new userModel({ ...validUserData(), name: " A " });

      // Act
      const err = user.validateSync();

      // Assert
      expect(err).toBeUndefined();
      expect(user.name).toBe("A");
    });
  });
});
