const Cart = require("../../models/cartSchema.js");
const User = require("../../models/userSchema.js");
const Product = require("../../models/ProductSchema.js");
const { default: mongoose } = require("mongoose");
const HttpStatus = require('../../config/httpStatus');
const { userAuth } = require("../../middileware/auth.js");


const getCart = async (req, res) => {
  try {
    const user = req.session.user;
      const cart = await Cart.findOne({userId:user}).populate({
        path:"items.productId",
        populate:{path:"category" }
      })


    if (!cart) {
      return res.render("cart", {
        cart: { items: [] },
      });
    }

    cart.items.forEach(item => {
      const product = item.productId;
      const categoryOfferAmount = (product.category.categoryOffer / 100) * product.regularPrice;
      const productOfferAmount = product.salePrice ? (product.regularPrice - product.salePrice) : 0;
      const greaterOfferAmount = Math.max(categoryOfferAmount, productOfferAmount);

      if (categoryOfferAmount > productOfferAmount) product.categoryOfferApplied = true;
      product.effectiveSalePrice = (product.regularPrice - greaterOfferAmount).toFixed(2);
    });
   
   
    res.render("cart", { cart, user });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get cart",
    });
  }
};

// Add to cart
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const user = req.session.user;

  
    if (!user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: "User not logged in. Please log in to add items to the cart.",
      });
    }
    
    const product = await Product.findById(productId);
  
    
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Product not found.",
      });
    }

    if (product.quantity < quantity) {    
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Not enough stock available.",
      });
    }

    let cart = await Cart.findOne({ userId: user});

    if (!cart) {
      cart = new Cart({ userId: user, items: [] });
    }
   
    

    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > 5) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: `You can only add up to 5 units of this product.`,
        });
      }

      if (newQuantity > product.quantity) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: "Exceeds available stock.",
        });
      }
    
      existingItem.quantity = newQuantity;
      existingItem.totalPrice = existingItem.quantity * product.salePrice;
    } else {
      cart.items.push({
        productId,
        quantity,
        price: product.salePrice,
        totalPrice: product.effectiveSalePrice * quantity,
      });
    }

    await cart.save();

    return res.json({
      success: true,
      message: "Product added to cart successfully.",
      cartCount: cart.items.length,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal Server Error. Please try again later.",
    });
  }
};

const removeFromCart = async (req, res) => {      
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Product ID is required" });
    }

    const user = req.session.user;
    const cart = await Cart.findOne({ userId: user });

    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Cart not found" });
    }
   //locate index base product in cart
    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

  
  
    if (itemIndex !== -1) {
      cart.items.splice(itemIndex, 1);
  
      await cart.save();  
      return res.json({ success: true, message: "Item removed successfully" });
    } else {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Item not found in cart" });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};





const updateQuantity = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user;

       
        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid quantity"
            });
        }

        //  maximum quantity 
        if (quantity > 5) {
            return res.status(400).json({
                success: false,
                message: "Maximum 5 items allowed per product"
            });
        }

        //fetch all products details in cart
        const [cart, product] = await Promise.all([
            Cart.findOne({ userId }),
            Product.findById(productId)
        ]);
       
      
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (quantity > product.quantity) {
            return res.status(400).json({
                success: false,
                message: "Not enough stock available"
            });
        }

       
        const cartItem = cart.items.find(item => item.productId.toString() === productId);
        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart"
            });
        }

       
        cartItem.quantity = quantity;
        cartItem.totalPrice = quantity * product.salePrice;

    
        await cart.save();

    
        const cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        return res.json({
            success: true,
            message: "Quantity updated successfully",
            newQuantity: quantity,
            newTotalPrice: cartItem.totalPrice,
            cartTotal: cartTotal,
            maxQuantity: 5
        });

    } catch (error) {
        console.error('Cart quantity update error:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to update quantity"
        });
    }
};

module.exports = {
    getCart,
    addToCart,
    removeFromCart,
    updateQuantity
};
