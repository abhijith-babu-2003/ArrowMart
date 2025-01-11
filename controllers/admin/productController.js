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
    const page = parseInt(req.query.page) || 1; 
    const limit = 7; 

    const productData = await Product.find({})
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .populate({
        path: "category",
        match: { isListed: true }, 
      })
      .exec();

   
    const count = await Product.countDocuments({});

 
    const category = await Category.find({ isListed: true });

    const totalPages = Math.ceil(count / limit); 

    if (category) {
      res.render("products", {
        data: productData,
        currentPage: page,
        totalPages: totalPages,
        cat: category,
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
    if (req.fileValidationError) {
      return res.status(400).json({ success: false, message: req.fileValidationError });
    }

    const products = req.body;

    const productExists = await Product.findOne({
      productName: products.productName,
    });

    if (productExists) {
      return res.status(400).json({ success: false, message: "Product already exists" });
    }

    // Handle image upload and resizing
    const images = [];
    
    
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const originalImagePath = req.files[i].path;
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
      return res.status(400).json({ message: "Invalid category name" });
    }
    
    const newProduct = new Product({
      productName: products.productName,
      description: products.description,
      category: category._id,
      regularPrice: products.regularPrice,
      salePrice:products.salePrice,
      quantity: products.quantity,
      color: products.color,
      productImage: images,
      status: "Available",
    });

    await newProduct.save();

    return res.status(200).json({ success: true, message: "Product added successfully!", product: newProduct });
  } catch (error) {
    console.error("Error in saving products", error);
    return res.status(500).json({ success: false, message: "An error occurred while saving the product" });
  }
};



//block and unblock 
const blockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:true}});
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("pageError");
  }
};

const unblockProduct = async (req, res) => {
  try {
    let id = req.query.id;
    await Product.updateOne({_id:id},{$set:{ isBlocked: false } });
    res.redirect("/admin/products");
  } catch (error) {
    res.redirect("pageError");
  }
};
 //view all products
 const getEditProducts = async (req, res) => {
  try {
    const id = req.query.id;
    if (!id) {
      return res.redirect("/admin/products");
    }

    const product = await Product.findById(id);
    const category = await Category.find({ isListed: true });

    if (!product) {
      console.error("Product not found.");
      return res.redirect("/admin/products");
    }

    res.render("editProducts", {
      product: product,
      cat: category,
    });
  } catch (error) {
    console.error("Error in getEditProducts:", error);
    res.redirect("/admin/products");
  }
};

// edit product 
const editproduct = async (req, res) => {
  try {
    const id = req.query.id;
   
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found!" });
    }

   
    const updateData = {
      productName: req.body.productName || product.productName,
      description: req.body.description || product.description,
      regularPrice: req.body.regularPrice || product.regularPrice,
      salePrice: req.body.salePrice || product.salePrice,
      quantity: req.body.quantity || product.quantity,
      color: req.body.color || product.color,
    };

  
    if (req.body.category) {
      const category = await Category.findOne({ categoryName: req.body.category });
      if (category) {
        updateData.category = category._id;
      }
    }

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.filename);
      updateData.productImage = [
        ...product.productImage, 
        ...newImages
      ];
    }
    



    const updatedProduct = await Product.findByIdAndUpdate(
      id, 
      { $set: updateData }, 
      { new: true }
    );



    if (!updatedProduct) {
      return res.status(500).json({ error: "Failed to update product", product: updatedProduct });
    }

    res.status(200).json({success:true, message: "Product updated successfully!",    product: updatedProduct  });

  } catch (error) {
    console.error("Full error in editproduct:", error);
    res.status(500).json({  error: "Something went wrong!",  details: error.message 
    });
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

    if (!imageNameToServer || !productIdToServer) {
      return res.status(400).send({ status: false, message: "Invalid input" });
    }
    
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
