import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";
import orderModel from "../models/orderModel.js";

import fs from "fs";
import slugify from "slugify";
import braintree from "braintree";
import dotenv from "dotenv";
import { exceedsMaxLength, INPUT_LIMITS } from "../helpers/inputValidation.js";

dotenv.config();

//payment gateway
var gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

const buildCheckoutSummary = async (cart = []) => {
  const normalizedEntries = Array.isArray(cart)
    ? cart
        .map((item) => {
          const productId = item?._id?.toString?.() || item?._id;
          const quantity = Number.isInteger(Number(item?.quantity)) && Number(item.quantity) > 0
            ? Number(item.quantity)
            : 1;

          return productId ? { productId, quantity } : null;
        })
        .filter(Boolean)
    : [];

  if (!normalizedEntries.length) {
    return {
      error: { status: 400, body: { success: false, message: "Cart is empty" } },
    };
  }

  const requestedQuantities = normalizedEntries.reduce((acc, entry) => {
    acc[entry.productId] = (acc[entry.productId] || 0) + entry.quantity;
    return acc;
  }, {});

  const productIds = Object.keys(requestedQuantities);
  const products = await productModel.find({ _id: { $in: productIds } }).select(
    "_id price quantity"
  );

  if (products.length !== productIds.length) {
    return {
      error: {
        status: 400,
        body: { success: false, message: "One or more products are invalid" },
      },
    };
  }

  const productById = new Map(
    products.map((product) => [product._id.toString(), product])
  );

  for (const [productId, quantity] of Object.entries(requestedQuantities)) {
    const product = productById.get(productId);

    if (!product || product.quantity < quantity) {
      return {
        error: {
          status: 409,
          body: {
            success: false,
            message: "One or more products are out of stock",
          },
        },
      };
    }
  }

  const total = products.reduce(
    (sum, product) =>
      sum + product.price * requestedQuantities[product._id.toString()],
    0
  );

  const expandedProductIds = normalizedEntries.flatMap((entry) =>
    Array.from({ length: entry.quantity }, () => entry.productId)
  );

  return {
    expandedProductIds,
    products,
    requestedQuantities,
    total,
  };
};

const reserveStock = async (products, requestedQuantities) => {
  const reserved = [];

  try {
    for (const product of products) {
      const quantityToReserve = requestedQuantities[product._id.toString()];
      const updatedProduct = await productModel.findOneAndUpdate(
        {
          _id: product._id,
          quantity: { $gte: quantityToReserve },
        },
        {
          $inc: { quantity: -quantityToReserve },
        },
        { new: true }
      );

      if (!updatedProduct) {
        throw new Error("OUT_OF_STOCK");
      }

      reserved.push({
        productId: product._id,
        quantity: quantityToReserve,
      });
    }

    return { reserved };
  } catch (error) {
    if (reserved.length) {
      await Promise.all(
        reserved.map((entry) =>
          productModel.findByIdAndUpdate(entry.productId, {
            $inc: { quantity: entry.quantity },
          })
        )
      );
    }

    if (error.message === "OUT_OF_STOCK") {
      return {
        error: {
          status: 409,
          body: {
            success: false,
            message: "One or more products are out of stock",
          },
        },
      };
    }

    throw error;
  }
};

const releaseReservedStock = async (reserved = []) => {
  if (!reserved.length) {
    return;
  }

  await Promise.all(
    reserved.map((entry) =>
      productModel.findByIdAndUpdate(entry.productId, {
        $inc: { quantity: entry.quantity },
      })
    )
  );
};

export const createProductController = async (req, res) => {
  try {
    const { name, description, price, category, quantity, shipping } =
      req.fields;
    const { photo } = req.files;

    // validation
    if (!name || !name.trim()) {
      return res.status(400).send({ success: false, message: "Name is Required" });
    }
    if (!description || !description.trim()) {
      return res.status(400).send({ success: false, message: "Description is Required" });
    }
    if (price == null || price === "" || isNaN(price) || Number(price) < 0) {
      return res.status(400).send({ success: false, message: "Price is Required and must be a non-negative number" });
    }
    if (!category) {
      return res.status(400).send({ success: false, message: "Category is Required" });
    }
    if (quantity == null || quantity === "" || isNaN(quantity) || Number(quantity) < 0) {
      return res.status(400).send({ success: false, message: "Quantity is Required and must be a non-negative number" });
    }
    if (!photo) {
      return res.status(400).send({ success: false, message: "Photo is Required" });
    }
    if (photo.size > 1000000) {
      return res.status(400).send({ success: false, message: "Photo should be less than 1mb" });
    }

    // Check if category exists
    const categoryExists = await categoryModel.findById(category);
    if (!categoryExists) {
      return res.status(404).send({ success: false, message: "Category not found" });
    }

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const products = new productModel({
      ...req.fields,
      name: trimmedName,
      description: trimmedDescription,
      slug: slugify(trimmedName),
    });

    products.photo.data = fs.readFileSync(photo.path);
    products.photo.contentType = photo.type;

    await products.save();
    res.status(201).send({
      success: true,
      message: "Product Created Successfully",
      products,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      error,
      message: "Error in creating product",
    });
  }
};

//get all products
export const getProductController = async (req, res) => {
  try {
    const products = await productModel
      .find({})
      .populate("category")
      .select("-photo") // exclude photo field
      .limit(12)
      .sort({ createdAt: -1 });
    res.status(200).send({
      success: true,
      countTotal: products.length,
      message: "All Products",
      products,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error in getting products",
      error: error.message,
    });
  }
};

// get single product
export const getSingleProductController = async (req, res) => {
  try {
    const product = await productModel
      .findOne({ slug: req.params.slug })
      .select("-photo")
      .populate("category");

    // Handle if product not found
    if (!product) {
      return res.status(404).send({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).send({
      success: true,
      message: "Single Product Fetched",
      product,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while getting single product",
      error,
    });
  }
};

// get photo
export const productPhotoController = async (req, res) => {
  try {
    const product = await productModel.findById(req.params.pid).select("photo");
    if (product.photo.data) {
      res.set("Content-type", product.photo.contentType);
      return res.status(200).send(product.photo.data);
    }
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while getting photo",
      error,
    });
  }
};

//delete controller
export const deleteProductController = async (req, res) => {
  try {
    const { pid } = req.params;

    // Check if product is in any orders
    const order = await orderModel.findOne({ products: pid });
    if (order) {
      return res.status(400).send({
        success: false,
        message: "Cannot delete product associated with orders",
      });
    }

    const product = await productModel.findByIdAndDelete(pid).select("-photo");
    if (!product) {
      return res.status(404).send({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).send({
      success: true,
      message: "Product Deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      message: "Error while deleting product",
      error,
    });
  }
};

//update product
export const updateProductController = async (req, res) => {
  try {
    const { name, description, price, category, quantity, shipping } =
      req.fields;
    const { photo } = req.files;

    // validation
    if (!name || !name.trim()) {
      return res.status(400).send({ success: false, message: "Name is Required" });
    }
    if (!description || !description.trim()) {
      return res.status(400).send({ success: false, message: "Description is Required" });
    }
    if (price == null || price === "" || isNaN(price) || Number(price) < 0) {
      return res.status(400).send({ success: false, message: "Price is Required and must be a non-negative number" });
    }
    if (!category) {
      return res.status(400).send({ success: false, message: "Category is Required" });
    }
    if (quantity == null || quantity === "" || isNaN(quantity) || Number(quantity) < 0) {
      return res.status(400).send({ success: false, message: "Quantity is Required and must be a non-negative number" });
    }
    if (photo && photo.size > 1000000) {
      return res.status(400).send({ success: false, message: "Photo should be less than 1mb" });
    }

    // Check if category exists
    const categoryExists = await categoryModel.findById(category);
    if (!categoryExists) {
      return res.status(404).send({ success: false, message: "Category not found" });
    }

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const products = await productModel.findByIdAndUpdate(
      req.params.pid,
      {
        ...req.fields,
        name: trimmedName,
        description: trimmedDescription,
        slug: slugify(trimmedName),
      },
      { new: true }
    );

    if (!products) {
      return res.status(404).send({
        success: false,
        message: "Product not found",
      });
    }

    if (photo) {
      products.photo.data = fs.readFileSync(photo.path);
      products.photo.contentType = photo.type;
    }

    await products.save();
    res.status(200).send({
      success: true,
      message: "Product Updated Successfully",
      products,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      success: false,
      error,
      message: "Error in Update product",
    });
  }
};

// filters
export const productFiltersController = async (req, res) => {
  try {
    const perPage = 6;
    const { checked = [], radio = [], page = 1 } = req.body;
    const normalizedPage = Number(page) > 0 ? Number(page) : 1;
    let args = {};
    if (checked.length > 0) args.category = checked;
    if (radio.length == 2) args.price = { $gte: radio[0], $lte: radio[1] };
    const total = await productModel.countDocuments(args);
    const products = await productModel
      .find(args)
      .select("-photo")
      .skip((normalizedPage - 1) * perPage)
      .limit(perPage)
      .sort({ createdAt: -1 });
    res.status(200).send({
      success: true,
      products,
      total,
    });
  } catch (error) {
    console.log(error);
    res.status(400).send({
      success: false,
      message: "Error While Filtering Products",
      error,
    });
  }
};

// product count
export const productCountController = async (req, res) => {
  try {
    const total = await productModel.find({}).estimatedDocumentCount();
    res.status(200).send({
      success: true,
      total,
    });
  } catch (error) {
    console.log(error);
    res.status(400).send({
      message: "Error in product count",
      error,
      success: false,
    });
  }
};

// product list base on page
export const productListController = async (req, res) => {
  try {
    const perPage = 6;
    const page = req.params.page ? req.params.page : 1;
    const products = await productModel
      .find({})
      .select("-photo")
      .skip((page - 1) * perPage)
      .limit(perPage)
      .sort({ createdAt: -1 });
    res.status(200).send({
      success: true,
      products,
    });
  } catch (error) {
    console.log(error);
    res.status(400).send({
      success: false,
      message: "error in per page ctrl",
      error,
    });
  }
};

// search product
export const searchProductController = async (req, res) => {
  try {
    const { keyword } = req.params;
    if (exceedsMaxLength(keyword, INPUT_LIMITS.searchKeyword)) {
      return res.status(400).send({
        success: false,
        message: "Search keyword is too long",
      });
    }
    const results = await productModel
      .find({
        $or: [
          { name: { $regex: keyword, $options: "i" } },
          { description: { $regex: keyword, $options: "i" } },
        ],
      })
      .select("-photo");
    res.json(results);
  } catch (error) {
    console.log(error);
    res.status(400).send({
      success: false,
      message: "Error In Search Product API",
      error,
    });
  }
};

// similar products
export const relatedProductController = async (req, res) => {
  try {
    const { pid, cid } = req.params;
    const products = await productModel
      .find({
        category: cid,
        _id: { $ne: pid },
      })
      .select("-photo")
      .limit(3)
      .populate("category");
    res.status(200).send({
      success: true,
      products,
    });
  } catch (error) {
    console.log(error);
    res.status(400).send({
      success: false,
      message: "Error while getting related product",
      error,
    });
  }
};

// get products by category
export const productCategoryController = async (req, res) => {
  try {
    const category = await categoryModel.findOne({ slug: req.params.slug });
    if (!category) {
      return res.status(404).send({
        success: false,
        category: null,
        message: "Category not found",
        products: []
      });
    }
    // Removed .populate("category") — category data is already available
    // from the first query, avoiding redundant per-product JOIN queries
    const products = await productModel.find({ category });
    res.status(200).send({
      success: true,
      category,
      products,
    });
  } catch (error) {
    console.log(error);
    res.status(400).send({
      success: false,
      error,
      message: "Error While Getting products",
    });
  }
};

//payment gateway api
//token
export const braintreeTokenController = async (req, res) => {
  try {
    gateway.clientToken.generate({}, function (err, response) {
      if (err) {
        res.status(500).send(err);
      } else {
        res.send(response);
      }
    });
  } catch (error) {
    console.log(error);
  }
};

//payment
export const braintreePaymentController = async (req, res) => {
  let reservedStock = [];

  try {
    const { nonce, cart } = req.body;
    const checkoutSummary = await buildCheckoutSummary(cart);
    if (checkoutSummary.error) {
      return res
        .status(checkoutSummary.error.status)
        .send(checkoutSummary.error.body);
    }

    const stockReservation = await reserveStock(
      checkoutSummary.products,
      checkoutSummary.requestedQuantities
    );
    if (stockReservation?.error) {
      return res
        .status(stockReservation.error.status)
        .send(stockReservation.error.body);
    }
    reservedStock = stockReservation.reserved || [];

    gateway.transaction.sale(
      {
        amount: checkoutSummary.total,
        paymentMethodNonce: nonce,
        options: {
          submitForSettlement: true,
        },
      },
      async function (error, result) {
        try {
          if (result) {
            await new orderModel({
              products: checkoutSummary.expandedProductIds,
              payment: result,
              buyer: req.user._id,
            }).save();
            reservedStock = [];
            return res.json({ ok: true });
          }

          await releaseReservedStock(reservedStock);
          reservedStock = [];
          return res.status(500).send(error);
        } catch (callbackError) {
          await releaseReservedStock(reservedStock);
          reservedStock = [];
          return res.status(500).send({
            success: false,
            message: "Error while processing payment",
            error: callbackError,
          });
        }
      }
    );
  } catch (error) {
    console.log(error);
    await releaseReservedStock(reservedStock);
    res.status(500).send({
      success: false,
      message: "Error while processing payment",
      error,
    });
  }
};
