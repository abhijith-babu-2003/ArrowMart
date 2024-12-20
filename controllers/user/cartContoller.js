const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/ProductSchema");

const getCart = async (req, res) => {
  try {
    const user = req.session.user; 
   
    const cart = await Cart.findOne({ user: user._id }).populate(
      "items.productId",
      "productName productImage salePrice"
    );

    if (!cart) {
      return res.render("cart", {
        cart: { items: [] },
      });
    }

    res.render("cart", { cart ,user:user});
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
    const { productId } = req.body;
    const userId = req.session.user;
    const quantity = parseInt(req.body.quantity) || 1;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not logged in" });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (product.quantity < quantity) {
      return res
        .status(400)
        .json({ success: false, message: "Not enough stock available" });
    }

    const totalPrice = product.salePrice * quantity;
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;

      if (newQuantity > product.quantity) {
        return res
          .status(400)
          .json({ success: false, message: "Exceeds available stock" });
      }

      existingItem.quantity = newQuantity;
      existingItem.totalPrice = existingItem.quantity * existingItem.price;
    } else {
      cart.items.push({
        productId,
        quantity,
        price: product.salePrice,
        totalPrice,
        name: product.productName,
        image: product.productImage[0],
      });
    }

    await cart.save();

    return res.json({
      success: true,
      message: "Product added to cart",
      cartCount: cart.items.length,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const removeFromCart = async (req, res) => {      
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

  
  
    if (itemIndex !== -1) {
      cart.items.splice(itemIndex, 1);
  
      await cart.save();  
      return res.json({ success: true, message: "Item removed successfully" });
    } else {
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};







  
module.exports = {
  getCart,
  removeFromCart,
  // updateCart,
  addToCart,        
 
};
