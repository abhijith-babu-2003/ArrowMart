const Product = require("../../models/ProductSchema");
const Category = require("../../models/categorySchema");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");


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
//get all products
const getAllProduct = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.currentPage) || 1;
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
//products adding
const addProducts = async (req, res) => {
  try {
    const products = req.body;

    const productExists = await Product.findOne({
      productName: products.productName,
    });

    if (!productExists) {
      const images = [];
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const originalImagePath = req.files[i].path; // Original uploaded image
          const resizedImageName = `resized-${Date.now()}-${req.files[i].filename}`;
          const resizedImagePath = path.join("public", "uploads", resizedImageName);

          
          const outputDir = path.dirname(resizedImagePath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          
          await sharp(originalImagePath)
            .resize({ width: 440, height: 440 })
            .toFile(resizedImagePath);

          
          images.push(resizedImageName);

       
          fs.unlinkSync(originalImagePath);
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
      res.redirect("/admin/products");
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
//block and unblock 
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
 //view all products
const getEditProducts = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findById(id);
    const category = await Category.find({});

    console.log("product get:",product);
    

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

// edit product 
const editproduct = async (req, res) => {
  try {
    const id = req.query.id;
    const product = await Product.findById(id);
    const {
      productName,
      description,
      regularPrice,
      salePrice,
      quantity,
      color,
      category,
    } = req.body;
    const cat = await Category.findOne({ categoryName: category });
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
      category: cat._id,
      regularPrice,
      salePrice,
      quantity,
      color,
    };

    if (image.length > 0) {
      updateFile.$push = { productImage: { $each: image } };
    }
    await Product.findByIdAndUpdate(id, updateFile, { new: true });
    res.redirect("/admin/editProducts");
  } catch (error) {
    console.error(error);
    res.redirect("/pageError");
  }
};

//delete and update image
const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;

    const product = await Product.findByIdAndUpdate(
      productIdToServer,
      {
        $pull: { productImage: imageNameToServer },
      },
      { new: true }
    );

    if (!product) {
      return res
        .staus(404)
        .send({ staus: false, message: "product not found" });
    }

    const imagePath = path.join(
      __dirname,
      "..",
      "public",
      "uploads",
      "re-image",
      imageNameToServer
    );

    fs.access(imagePath, fs.constants.F_OK, (err) => {
      if (!err) {
        fs.unlink(imagePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error(
              `error deleting image${imageNameToServer}`,
              unlinkErr
            );
          } else {
            console.log(`Image ${imageNameToServer} deleted succesfully`);
          }
        });
      } else {
        console.log(`Image ${imageNameToServer} not found`);
      }
    });

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
