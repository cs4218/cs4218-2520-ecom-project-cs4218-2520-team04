# CS4218 Project - Virtual Vault

[![Node.js CI](https://github.com/cs4218/cs4218-2520-ecom-project-cs4218-2520-team04/actions/workflows/node.js.yml/badge.svg?branch=main)](https://github.com/cs4218/cs4218-2520-ecom-project-cs4218-2520-team04/actions/workflows/node.js.yml)

[Node.js CI Workflow](https://github.com/cs4218/cs4218-2520-ecom-project-cs4218-2520-team04/actions/workflows/node.js.yml)

# Workload Distribution - 5 Member

| Done by            | Features            | Client Related Files (`/client/src/`)                                                                                                                | Server Related Files (`./`)                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mervyn Teo Zi Yan  | Protected Routes    | `context/auth.js`                                                                                                                                    | `helpers/authHelper.js`<br>`middlewares/authMiddleware.js`                                                                                                                                                                                                                                                                                       |
| Mervyn Teo Zi Yan  | Registration        | `pages/Auth/Register.js`                                                                                                                             | **`controllers/authController.js`**<br>1. registerController<br>2. loginController<br>3. forgotPasswordController<br>4. testController                                                                                                                                                                                                           |
| Mervyn Teo Zi Yan  | Login               | `pages/Auth/Login.js`                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                  |
| Mervyn Teo Zi Yan  | Admin Dashboard     | `components/AdminMenu.js`<br>`pages/admin/AdminDashboard.js`                                                                                         |                                                                                                                                                                                                                                                                                                                                                  |
| Tan Wei Lian       | Admin Actions       | `components/Form/CategoryForm.js`<br>`pages/admin/CreateCategory.js`<br>`pages/admin/CreateProduct.js`<br>`pages/admin/UpdateProduct.js`             | **`controllers/categoryController.js`**<br>1. createCategoryController<br>2. updateCategoryController<br>3. deleteCategoryController                                                                                                                                                                                                             |
| Tan Wei Lian       | Admin View Orders   | `pages/admin/AdminOrders.js`                                                                                                                         |                                                                                                                                                                                                                                                                                                                                                  |
| Tan Wei Lian       | Admin View Products | `pages/admin/Products.js`                                                                                                                            | **`controllers/productController.js`**<br>1. createProductController<br>2. deleteProductController<br>3. updateProductController                                                                                                                                                                                                                 |
| Tan Wei Lian       | General             | `components/Routes/Private.js`<br>`components/UserMenu.js`<br>`pages/user/Dashboard.js`                                                              | `models/userModel.js`                                                                                                                                                                                                                                                                                                                            |
| Lu Yixuan, Deborah | Order               | `pages/user/Orders.js`                                                                                                                               | **`controllers/authController.js`**<br>1. updateProfileController<br>2. getOrdersController<br>3. getAllOrdersController<br>4. orderStatusController<br>`models/orderModel.js`                                                                                                                                                                   |
| Lu Yixuan, Deborah | Profile             | `pages/user/Profile.js`                                                                                                                              |                                                                                                                                                                                                                                                                                                                                                  |
| Lu Yixuan, Deborah | Admin View Users    | `pages/admin/Users.js`                                                                                                                               |                                                                                                                                                                                                                                                                                                                                                  |
| Lu Yixuan, Deborah | Search              | `components/Form/SearchInput.js`<br>`context/search.js`<br>`pages/Search.js`                                                                         |                                                                                                                                                                                                                                                                                                                                                  |
| Yeo Yi Wen         | Product             | `pages/ProductDetails.js`<br>`pages/CategoryProduct.js`                                                                                              | **`controllers/productController.js`**<br>1. getProductController<br>2. getSingleProductController<br>3. productPhotoController<br>4. productFiltersController<br>5. productCountController<br>6. productListController<br>7. searchProductController<br>8. relatedProductController<br>9. productCategoryController<br>`models/productModel.js` |
| Yeo Yi Wen         | Contact             | `pages/Contact.js`                                                                                                                                   |                                                                                                                                                                                                                                                                                                                                                  |
| Yeo Yi Wen         | Policy              | `pages/Policy.js`                                                                                                                                    |                                                                                                                                                                                                                                                                                                                                                  |
| Yeo Yi Wen         | General             | `components/Footer.js`<br>`components/Header.js`<br>`components/Layout.js`<br>`components/Spinner.js`<br>`pages/About.js`<br>`pages/Pagenotfound.js` | `config/db.js`                                                                                                                                                                                                                                                                                                                                   |
| Teo Kai Xiang      | Home                | `pages/Homepage.js`                                                                                                                                  |                                                                                                                                                                                                                                                                                                                                                  |
| Teo Kai Xiang      | Cart                | `context/cart.js`<br>`pages/CartPage.js`                                                                                                             |                                                                                                                                                                                                                                                                                                                                                  |
| Teo Kai Xiang      | Category            | `hooks/useCategory.js`<br>`pages/Categories.js`                                                                                                      | **`controllers/categoryController.js`**<br>1. categoryController<br>2. singleCategoryController<br>`models/categoryModel.js`                                                                                                                                                                                                                     |
| Teo Kai Xiang      | Payment             |                                                                                                                                                      | **`controllers/productController.js`**<br>1. braintreeTokenController<br>2. brainTreePaymentController                                                                                                                                                                                                                                           |

## Testing Workload Distribution (MS2)

| Done by            | Test Type                                                    | Scope                                                                                                                                                                                                                                                                                                       | Test Files                                                                                                                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tan Wei Lian       | Integration (Jest + Supertest + MongoMemoryServer)           | - Category CRUD endpoints<br>- Product CRUD endpoints<br>- Registration and login endpoints                                                                                                                                                                                                                 | `tests/integration/backend/admin/categoryController.integration.test.js`<br>`tests/integration/backend/admin/productController.integration.test.js`<br>`tests/integration/backend/auth/userModel.integration.test.js`                                                                                                                                                   |
| Tan Wei Lian       | Integration (Jest + React Testing Library)                   | - CreateCategory page and CategoryForm interactions<br>- CreateProduct page interactions<br>- UpdateProduct page interactions                                                                                                                                                                               | `client/src/pages/admin/CreateCategory.integration.test.js`<br>`client/src/pages/admin/CreateProduct.integration.test.js`<br>`client/src/pages/admin/UpdateProduct.integration.test.js`                                                                                                                                                                                 |
| Tan Wei Lian       | UI / E2E (Playwright)                                        | - Admin category management flow<br>- Admin orders management flow<br>- Admin product CRUD flow<br>- User dashboard access flow                                                                                                                                                                             | `tests/ui/admin/admin-category.spec.js`<br>`tests/ui/admin/admin-orders.spec.js`<br>`tests/ui/admin/admin-product.spec.js`<br>`tests/ui/user/user-dashboard.spec.js`                                                                                                                                                                                                    |
| Lu Yixuan, Deborah | Integration (Jest + Supertest + MongoMemoryServer)           | - Orders endpoints<br>- Profile update endpoint<br>- Admin users endpoint                                                                                                                                                                                                                                   | `tests/integration/admin/adminUsers.integration.test.js`<br>`tests/integration/auth/orders.integration.test.js`<br>`tests/integration/auth/profile.integration.test.js`                                                                                                                                                                                                 |
| Lu Yixuan, Deborah | UI / E2E (Playwright)                                        | - User orders page flow<br>- User profile update flow<br>- Admin users authorization                                                                                                                                                                                                                        | `tests/ui/user/user-orders.spec.js`<br>`tests/ui/user/user-profile.spec.js`<br>`tests/ui/admin/admin-users.spec.js`                                                                                                                                                                                                                                                     |
| Lu Yixuan, Deborah | UI / E2E (Playwright)                                        | - Search flow                                                                                                                                                                                                                                                                                               | `tests/ui/public/search.spec.js`                                                                                                                                                                                                                                                                                                                                        |
| Mervyn Teo Zi Yan  | Integration (Jest + Supertest + MongoMemoryServer)           | - Auth middleware & RBAC endpoints<br>- Registration endpoint<br>- Login endpoint<br>- Forgot password endpoint                                                                                                                                                                                             | tests/integration/auth/authMiddleware.integration.test.js<br>tests/integration/auth/register.integration.test.js<br>tests/integration/auth/login.integration.test.js<br>tests/integration/auth/forgotPassword.integration.test.js                                                                                                                                       |
| Mervyn Teo Zi Yan  | Integration (Jest + React Testing Library)                   | - Login/Register auth flow with AuthContext & Router<br>- AdminDashboard context consumption & menu routing                                                                                                                                                                                                 | client/src/pages/Auth/authFlow.integration.test.js<br>client/src/pages/admin/adminDashboard.integration.test.js                                                                                                                                                                                                                                                         |
| Mervyn Teo Zi Yan  | UI / E2E (Playwright)                                        | - Login flow<br>- Register flow<br>- Auth context persistence<br>- Admin dashboard workflows                                                                                                                                                                                                                | tests/ui/auth/login.spec.js<br>tests/ui/auth/register.spec.js<br>tests/ui/auth/auth-context.spec.js<br>tests/ui/admin/admin-dashboard.spec.js                                                                                                                                                                                                                           |
| Teo Kai Xiang      | Integration - Frontend (Jest)                                | - Home page interactions: Filtering by price, filtering by category and load more products<br/>- Homepage-Cart Interactions: Add to cart and check states are correct<br/>- Cart Page specific flows: Remove from cart, flows to redirect the user if user is not logged in or address has not been updated | `tests/integration/frontend/home-category-cart.integration.test.js`<br/>`tests/integration/frontend/login-checkout.integration.test.js`                                                                                                                                                                                                                                 |
| Teo Kai Xiang      | Integration - Backend (Jest + MongoMemoryServer + Supertest) | - Braintree flows: `/token` and `/payment` tested in isolation, and a full mock payment from from `token` to receiving a valid response from Braintree<br/>- Category listing flows: Returning of category lists, single category access + edge cases such as 0 categories                                  | `tests/integration/backend/productController.test.js`(`braintree` endpoints)<br/>`tests/integration/backend/categoryController.test.js`(`get-category` and `single-category`)                                                                                                                                                                                           |
| Teo Kai Xiang      | UI Testing (Playwright E2E + UI only)                        | - HomePage flows: User filters by price, category and adds to cart<br/>- CartPage flows: User removes from cart, gets redirected to login page if not logged in, and update address flows<br/>- Categories: A simple UI only test                                                                           | `tests/ui/pages/HomePage.spec.js`<br/>`tests/ui/CartPage.spec.js`<br/>`tests/ui/Categories.spec.js`                                                                                                                                                                                                                                                                     |
| Yeo Yi Wen         | Integration - Frontend (MemoryRouter + Context Providers)    | - UI shell components (Layout, Header, Footer)</br>-Content Injection (Children)</br>-Metadata (Helmet)                                                                                                                                                                                                     | `client\src\components\Footer.integration.test.js`</br>`client\src\components\Header.integration.test.js`</br>`client\src\components\Layout.integration.test.js`</br>`client\src\pages\CategoryProduct.integration.test.js`</br>`client\src\pages\ProductDetails.integration.test.js`                                                                                   |
| Yeo Yi Wen         | Integration - Backend (Jest + MongoMemoryServer)             | -Mongoose & MondoDB connection</br>-Mongoose Product Schema                                                                                                                                                                                                                                                 | `tests\integration\backend\database\db.integration.test.js` </br>`tests\integration\backend\database\productModel.integration.test.js`                                                                                                                                                                                                                                  |
| Yeo Yi Wen         | UI - PlayWright                                              | -User Session Flows (Guest, Normal, Admin)</br>-User flows (Navigation, Authentication, Role-based Access, Error Handling, Product Journey)                                                                                                                                                                 | `tests\ui\components\Footer.spec.js`</br>`tests\ui\components\Header.spec.js`</br>`tests\ui\components\Layout.spec.js`</br> `tests\ui\pages\About.spec.js`</br>`tests\ui\pages\Contact.spec.js`</br>`tests\ui\pages\Policy.spec.js`</br> `tests\ui\pages\Pagenotfound.spec.js`</br>`tests\ui\pages\CategoryProduct.spec.js`</br>`tests\ui\pages\ProductDetails.spec.js` |

## Testing Workload Distribution (MS3)

| Done by           | Test Type           | Scope                                                                                                                                                                                                                                                                                                                                              | Test Files                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yeo Yi Wen        | Unit Tests          | - Ensures components renders and key links/text appears</br>- Add unit tests missing from MS1                                                                                                                                                                                                                                                      | `client/src/components/Footer.test.js`</br>`client/src/pages/About.test.js`</br>`client/src/pages/Contact.test.js`</br>`client/src/pages/Pagenotfound.test.js`</br>`client/src/pages/Policy.test.js`                                                                                                                                                                                                                                           |
| Yeo Yi Wen        | Spike Tests         | - `run-all-scenarios.sh` runs each spike scenario individually using `spike.test.js` to distribute workload and creates the 9 k6 reports                                                                                                                                                                                                           | `tests/spike/spike.test.js`</br>`test/spike/run-all-scenarios.sh`                                                                                                                                                                                                                                                                                                                                                                              |
| Yeo Yi Wen        | Spike Test Reports  | - k6 reports generated by Grafana k6 for 9 spike scenarios                                                                                                                                                                                                                                                                                         | `test/spike/report-after-auth.html`</br>`test/spike/report-after-categories.html`</br>`test/spike/report-after-category_products.html`</br>`test/spike/report-after-filters.html`</br>`test/spike/report-after-products.html`</br>`test/spike/report-after-related_products.html`</br>`test/spike/report-after-search.html`</br>`test/spike/report-after-single_product.html`</br>`test/spike/report-after-user_orders.html`                   |
| Mervyn Teo Zi Yan | Volume Tests        | - `run-all-scenarios.sh` runs each volume scenario individually using `volume.test.js` to distribute workload and creates 9 k6 reports</br>- Sustained high-volume traffic (200 VUs for 5 min) across 9 scenarios: `auth`, `products`, `categories`, `search`, `filters`, `single_product`, `related_products`, `category_products`, `user_orders` | `tests/volume/volume.test.js`</br>`tests/volume/run-all-scenarios.sh`                                                                                                                                                                                                                                                                                                                                                                          |
| Mervyn Teo Zi Yan | Volume Test Reports | - k6 reports generated by Grafana k6 for 9 volume scenarios                                                                                                                                                                                                                                                                                        | `tests/volume/report-after-auth.html`</br>`tests/volume/report-after-categories.html`</br>`tests/volume/report-after-category_products.html`</br>`tests/volume/report-after-filters.html`</br>`tests/volume/report-after-products.html`</br>`tests/volume/report-after-related_products.html`</br>`tests/volume/report-after-search.html`</br>`tests/volume/report-after-single_product.html`</br>`tests/volume/report-after-user_orders.html` |
| Tan Wei Lian      | Stress Tests        | - `stress.test.js` implements Grafana k6 stress scenarios for auth, catalog, and orders workloads</br>- `run-all-scenarios.sh` runs the stress scenarios individually</br>- `run-ladder.sh` runs the same scenarios across a stress ladder of peak VU levels to identify stable, degraded, and unacceptable operating regions                      | `tests/stress/stress.test.js`</br>`tests/stress/run-stress.sh`</br>`tests/stress/run-all-scenarios.sh`</br>`tests/stress/run-ladder.sh`                                                                                                                                                                                                                                                                                                        |
| Tan Wei Lian      | Stress Test Reports | - Representative k6 stress-test reports generated at peak 1200 VUs for the three stress scenarios                                                                                                                                                                                                                                                  | `tests/stress/report-auth-peak-1200.html`</br>`tests/stress/report-catalog-peak-1200.html`</br>`tests/stress/report-orders-peak-1200.html`                                                                                                                                                                                                                                                                                                     |
| Teo Kai Xiang     | Security Tests      | - Role-based authorisation tests ensuring user/admins have the correct scope of permissions                                                                                                                                                                                                                                                        | `tests\security\authorization-testing.test.js`                                                                                                                                                                                                                                                                                                                                                                                                 |
| Teo Kai Xiang     | Security Tests      | - Checkout validation tests ensuring tampered prices/quantities are not accepted by the backend                                                                                                                                                                                                                                                    | `tests\security\checkout-validation.test.js`                                                                                                                                                                                                                                                                                                                                                                                                   |
| Teo Kai Xiang     | Security Tests      | - noSQL, XSS and path traversal tests. Tests for common attack vectors and ensure the backend/frontend is not vulnerable                                                                                                                                                                                                                           | `tests\security\noSQL-injection.test.js`, `tests\security\path-traversal-attacks.test.js` and `tests\security\XSS-attack.test.js`                                                                                                                                                                                                                                                                                                              |
| Teo Kai Xiang     | Security Tests      | - Password bruteforce and strength test. Ensure there is proper throttling to prevent bruteforcing and minimum password strength is enforced                                                                                                                                                                                                       | `tests\security\password-bruteforce-attack.test.js`                                                                                                                                                                                                                                                                                                                                                                                            |
| Teo Kai Xiang     | Security Tests (CI) | - Static Code Analysis, Dependency Change Review and Secret scans for PRs via Github Actions                                                                                                                                                                                                                                                       | `.github\workflows\secret-scan.yml`, `.github\workflows\dependency-review.yml`, `.github\workflows\codeql.yml`                                                                                                                                                                                                                                                                                                                                 |

## 1. Project Introduction

Virtual Vault is a full-stack MERN (MongoDB, Express.js, React.js, Node.js) e-commerce website, offering seamless connectivity and user-friendly features. The platform provides a robust framework for online shopping. The website is designed to adapt to evolving business needs and can be efficiently extended.

## 2. Website Features

- **User Authentication**: Secure user authentication system implemented to manage user accounts and sessions.
- **Payment Gateway Integration**: Seamless integration with popular payment gateways for secure and reliable online transactions.
- **Search and Filters**: Advanced search functionality and filters to help users easily find products based on their preferences.
- **Product Set**: Organized product sets for efficient navigation and browsing through various categories and collections.

## 3. Your Task

- **Unit and Integration Testing**: Utilize Jest for writing and running tests to ensure individual components and functions work as expected, finding and fixing bugs in the process.
- **UI Testing**: Utilize Playwright for UI testing to validate the behavior and appearance of the website's user interface.
- **Code Analysis and Coverage**: Utilize SonarQube for static code analysis and coverage reports to maintain code quality and identify potential issues.
- **Load Testing**: Leverage JMeter for load testing to assess the performance and scalability of the ecommerce platform under various traffic conditions.

## 4. Setting Up The Project

### 1. Installing Node.js

1. **Download and Install Node.js**:
   
   - Visit [nodejs.org](https://nodejs.org) to download and install Node.js.

2. **Verify Installation**:
   
   - Open your terminal and check the installed versions of Node.js and npm:
     ```bash
     node -v
     npm -v
     ```

### 2. MongoDB Setup

1. **Download and Install MongoDB Compass**:
   
   - Visit [MongoDB Compass](https://www.mongodb.com/products/tools/compass) and download and install MongoDB Compass for your operating system.

2. **Create a New Cluster**:
   
   - Sign up or log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
   
   - After logging in, create a project and within that project deploy a free cluster.

3. **Configure Database Access**:
   
   - Create a new user for your database (if not alredy done so) in MongoDB Atlas.
   
   - Navigate to "Database Access" under "Security" and create a new user with the appropriate permissions.

4. **Whitelist IP Address**:
   
   - Go to "Network Access" under "Security" and whitelist your IP address to allow access from your machine.
   
   - For example, you could whitelist 0.0.0.0 to allow access from anywhere for ease of use.

5. **Connect to the Database**:
   
   - In your cluster's page on MongoDB Atlas, click on "Connect" and choose "Compass".
   
   - Copy the connection string.

6. **Establish Connection with MongoDB Compass**:
   
   - Open MongoDB Compass on your local machine, paste the connection string (replace the necessary placeholders), and establish a connection to your cluster.

### 3. Application Setup

To download and use the MERN (MongoDB, Express.js, React.js, Node.js) app from GitHub, follow these general steps:

1. **Clone the Repository**
   
   - Go to the GitHub repository of the MERN app.
   
   - Click on the "Code" button and copy the URL of the repository.
   
   - Open your terminal or command prompt.
   
   - Use the `git clone` command followed by the repository URL to clone the repository to your local machine:
     ```bash
     git clone <repository_url>
     ```
   
   - Navigate into the cloned directory.
   
   - Copy .env.example to .env:
   
   ```
   cp .env.example .env
   ```

2. **Install Frontend and Backend Dependencies**
   
   - Run the following command in your project's root directory:
   
     ```
     npm install && cd client && npm install && cd ..
     ```

3. **Add database connection string to `.env`**
   
   - Add the connection string copied from MongoDB Atlas to the `.env` file inside the project directory (replace the necessary placeholders):
     ```env
     MONGO_URL = <connection string>
     ```

4. **Adding sample data to database**
   
   - Download “Sample DB Schema” from Canvas and extract it.
   
   - In MongoDB Compass, create a database named `test` under your cluster.
   
   - Add four collections to this database: `categories`, `orders`, `products`, and `users`.
   
   - Under each collection, click "ADD DATA" and import the respective JSON from the extracted "Sample DB Schema".

5. **Running the Application**
   
   - Open your web browser.
   
   - Use `npm run dev` to run the app from root directory, which starts the development server.
   
   - Navigate to `http://localhost:3000` to access the application.

6. **Generating Report with SonarQube**
   
   ```
   cp sonar-project.example.properties sonar-project.properties
   ```
   
   - Fill it in with ur own token

## 5. Unit Testing with Jest

Unit testing is a crucial aspect of software development aimed at verifying the functionality of individual units or components of a software application. It involves isolating these units and subjecting them to various test scenarios to ensure their correctness.  
Jest is a popular JavaScript testing framework widely used for unit testing. It offers a simple and efficient way to write and execute tests in JavaScript projects.

### Getting Started with Jest

To begin unit testing with Jest in your project, follow these steps:

1. **Install Jest**:  
   Use your preferred package manager to install Jest. For instance, with npm:
   
   ```bash
   npm install --save-dev jest
   ```

2. **Write Tests**  
   Create test files for your components or units where you define test cases to evaluate their behaviour.

3. **Run Tests**  
   Execute your tests using Jest to ensure that your components meet the expected behaviour.  
   You can run the tests by using the following command in the root of the directory:
   
   - **Frontend tests**
   
     ```bash
     npm run test:frontend
     ```
   
   - **Backend tests**
   
     ```bash
     npm run test:backend
     ```
   
   - **All the tests**
     ```bash
     npm run test
     ```
   
   - **Run a Single Test File/Folder**
   
     ```bash
     npm run test:frontend -- path/to/file.test.js
     npm run test:frontend -- path/to/folder
     ```

## 6. Integration Testing with Jest

### Run Integration Tests

- **All integration tests** (frontend + backend)
  
  ```bash
  npm run test:integration
  ```

- **Backend integration tests only**
  
  ```bash
  npm run test:integration:backend
  ```

- **Frontend integration tests only**
  
  ```bash
  npm run test:integration:frontend
  ```

- **Run a Single Integration Test File/Folder**
  
  ```bash
  npm run test:integration:backend -- path/to/file.test.js
  npm run test:integration:frontend -- path/to/file.test.js
  ```

## 7. UI / E2E Testing with Playwright

### Prerequisites

Install Playwright and its browsers:

```bash
npx playwright install
```

### Run UI Tests

- **Run all UI tests**
  
  ```bash
  npm run test:ui
  ```

- **Run a specific test file**
  
  ```bash
  npx playwright test tests/ui/pages/HomePage.spec.js
  ```

- **View the HTML report** after a test run
  
  ```bash
  npm run test:ui:report
  ```

## 8. Performance Testing with Grafana k6

### Spike Testing

Spike tests simulate sudden traffic surges against the ecommerce API. Each of the 9 scenarios is run individually to avoid overloading the server, and a separate HTML report is generated per scenario.

**Scenarios:** `auth`, `products`, `categories`, `search`, `filters`, `single_product`, `related_products`, `category_products`, `user_orders`

#### Prerequisites

- MongoDB is running
- k6 is installed — see [k6 installation guide](https://k6.io/docs/get-started/installation/)

#### Steps

1. **Start the server**
   
   ```bash
   npm run server
   ```

2. **Run all spike scenarios**
   
   ```bash
   ./tests/spike/run-all-scenarios.sh
   ```
   
   This runs each scenario sequentially (with a 10s cooldown between them) and saves reports to `tests/spike/report-after-<scenario>.html`.

3. **Run a single scenario** (optional)
   
   ```bash
   k6 run -e SCENARIO=auth tests/spike/spike.test.js
   ```

#### View Reports

Open any generated HTML report in a browser:

```
tests/spike/report-after-<scenario>.html
```

### Volume Testing

Volume tests simulate sustained high-volume traffic against the ecommerce API over an extended period. Unlike spike tests (sudden bursts), volume tests verify that the system can handle a large, steady number of concurrent users for a prolonged duration without performance degradation, memory leaks, or rising error rates. Each of the 9 scenarios is run individually, and a separate HTML report is generated per scenario.

**Scenarios:** `auth`, `products`, `categories`, `search`, `filters`, `single_product`, `related_products`, `category_products`, `user_orders`

**Load Profile:** Ramp up to 50 VUs (30s) → Sustain 200 VUs (5 min) → Ramp down to 0 (30s)

#### Prerequisites

- MongoDB is running
- k6 is installed — see [k6 installation guide](https://k6.io/docs/get-started/installation/)

#### Steps

1. **Start the server**
   
   ```bash
   npm run server
   ```

2. **Run all volume scenarios**
   
   ```bash
   ./tests/volume/run-all-scenarios.sh
   ```
   
   This runs each scenario sequentially (with a 15s cooldown between them) and saves reports to `tests/volume/report-after-<scenario>.html`.

3. **Run a single scenario** (optional)
   
   ```bash
   k6 run -e SCENARIO=auth tests/volume/volume.test.js
   ```

#### View Reports

Open any generated HTML report in a browser:

```
tests/volume/report-after-<scenario>.html
```
