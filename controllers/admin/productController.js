
const Product = require("../../models/ProductSchema");
const Category = require("../../models/categorySchema");
const path = require("path");
const fs=require("fs")
const sharp = require("sharp");
const category = require("../../models/categorySchema");


const getaddProducts = async (req, res) => {
  try {
    const category = await Category.find({ isListed: true });
    res.render("addProducts", {
      cat: category,
    });
  } catch (error) {
    console.error(error);
  }
};

const getAllProduct = async (req, res) => {
 

  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const productData = await Product.find({
      $or: [{ productName: { $regex: new RegExp(".*" + search + ".*", "i") } }],
    })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
      .exec();

    const count = await Product.find({
      $or: [{ productName: { $regex: new RegExp(".*" + search + ".*", "i") } }],
    }).countDocuments();

    const category = await Category.find({ isListed: true });

    if (category) {
      res.render("products", {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        search: search,
      });
    } else {
      res.render("pageError", { message: "Category data not found." });
    }
  } catch (error) {
    console.error("Error in getAllProduct:", error);
    res.render("pageError", { message: "Failed to load products." });
  }
};

const addProducts = async (req, res) => {
  try {
    const products = req.body;
    const productExists = await Product.findOne({
      productName: products.productName,
    });

    if (!productExists) {
      
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const originalImagePath = req.files[i].path;
          const resizedImagePath = path.join(
            "public",
            "uploads",
            "product-images",
            req.files[i].filename
          );
          await sharp(originalImagePath)
            .resize({ width: 440, height: 440 })
            .toFile(resizedImagePath);
          images.push(req.files[i].filename);
        }
      }

      const category = await Category.findOne({
        isListed: true,
        categoryName: products.category,
      });
      if (!category) {
        return res.status(400).send("Invalid category name");
      }
     

      const newProduct = new Product({
        productName: products.productName,
        description: products.description,
        category: category._id,
        regularPrice: products.regularPrice,
        salePrice: products.salePrice,
        quantity: products.quantity,
        color: products.color,
        productImage: images,
        status: "Available",
      });

      await newProduct.save();
      console.log("Product saved successfully");
      res
        .status(201)
        .json({ message: "Product saved successfully" })
        .redirect("/admin/products");
    } else {
      res.status(400).json({ error: "Product already exists" });
    }
  } catch (error) {
    console.error("Error in saving products", error);
    res
      .status(500)
      .json({ error: "An error occurred while saving the product" });
  }
};

const blockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("pageError");
  }
};

const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("pageError");
  }
};


const getEditProducts = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findById(id);
    const category = await Category.find({});

    if (!id) {
      return res.redirect("/admin/products");
    }

    res.render("editProducts", {
      product: product,
      cat: category,
    });
  } catch (error) {
    console.error("Error fetching product or category:", error);
    res.redirect("/admin/products");
  }
};

const editproduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findById(id);
    const {productName,description,regularPrice,salePrice,quantity,color,category} = req.body;
    const cat = await Category.findOne({categoryName:category})
    const existingProduct = await Product.findOne({
      productName: productName,
      _id: { $ne: id },
    });

    if (existingProduct) {
        return res.status(400).json({
          error: "Product with this name already exists. Please try again.",
        });
      }
      
      const image = [];
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          image.push(req.files[i].filename);
        }
      }

    const updateFile = {
      productName,
      description,
      category:cat._id,
      regularPrice,
      salePrice,
      quantity,
      color
    };
   
    if (image.length > 0) {
        updateFile.$push = { productImage: { $each: image } };
      }
    await Product.findByIdAndUpdate(id, updateFile, { new: true });
    res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.redirect("/pageError");
  }
};

const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;
    const product = await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { productImage: imageNameToServer },
    });
    const imagePath = path.join(
      "public",
      "uploads",
      "re-image",
      imageNameToServer
    );

    if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);

        console.log(`Image ${imageNameToServer} deleted successfully`);
      } else {
        console.log(`Image ${imageNameToServer} not found`);
      }
    res.send({ status: true });
  } catch (error) {
    res.redirect("/pageError");
  }
};

module.exports = {
  addProducts,
  getAllProduct,
  getaddProducts,
  blockProduct,
  unblockProduct,
  getEditProducts,
  editproduct,
  deleteSingleImage,
};
