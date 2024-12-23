const Product=require("../../models/ProductSchema")
const Category=require("../../models/categorySchema")
const User=require("../../models/userSchema")
const Cart=require('../../models/cartSchema')

const productDetails=async(req,res)=>{
    try {
        const UserId=req.session.user
        const userData=await User.findById(UserId)
        const productId=req.query.id
      
        
        const product=await Product.findById(productId).populate('category')
        if(!product){
            throw new Error("product not found")
        }
        const findCategory = product.category|| {};
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;

      

         const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: productId }, 
        });
    
        

        res.render("productDetails",{
            user:userData,
            product:product,
            quantity:product.quantity,
            totalOffer:totalOffer,
            category:findCategory,
            relatedProduct: relatedProducts
        })
    } catch (error) {
        console.error("error for fetching details",error);
        res.redirect("/pageNotFound")
        
    }
}



const MAX_CART_QUANTITY = 5; // Set maximum quantity allowed per product in the cart

const addToCart = async (req, res) => {
    try {
      const { productId, quantity = 1 } = req.body;
      const user = req.session.user;
  
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not logged in. Please log in to add items to the cart.",
        });
      }
  
      const product = await Product.findById(productId);
  
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }
  
      if (product.quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: "Not enough stock available.",
        });
      }
  
      let cart = await Cart.findOne({ user: user._id });
  
      if (!cart) {
        cart = new Cart({ user: user._id, items: [] });
      }
  
      const existingItem = cart.items.find(
        (item) => item.productId.toString() === productId
      );
  
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
  
        if (newQuantity > MAX_CART_QUANTITY) {
          return res.status(400).json({
            success: false,
            message: `You can only add up to ${MAX_CART_QUANTITY} units of this product.`,
          });
        }
  
        if (newQuantity > product.quantity) {
          return res.status(400).json({
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
          totalPrice: product.salePrice * quantity,
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
      res.status(500).json({
        success: false,
        message: "Internal Server Error. Please try again later.",
      });
    }
  };


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




  

module.exports={
    productDetails,
addToCart

}