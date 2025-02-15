const mongoose = require("mongoose");
const Order = require("../../models/orderSchema.js");
const Cart = require("../../models/cartSchema.js");
const Product = require("../../models/ProductSchema.js");
const Address = require("../../models/addressSchema.js");
const Coupon = require("../../models/couponSchema.js");
const Wallet = require("../../models/walletSchema.js");
const User = require("../../models/userSchema.js");
const razorpay = require("../../config/razorpay.js");
const {generateOrderId}=require("../../utils/orderIdGenerator.js")
const crypto = require("crypto");
const HttpStatus = require('../../config/httpStatus');
const { path } = require("pdfkit");


// Load checkout page
const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }) 
      .populate({
        path: "items.productId",
        populate: { path: "category" }
      })
      .populate("couponApplied");

    cart.items.forEach(item => {
      const product = item.productId;
      const categoryOfferAmount = (product.category.categoryOffer / 100) * product.regularPrice;
      const productOfferAmount = product.salePrice ? (product.regularPrice - product.salePrice) : 0;
      const greaterOfferAmount = Math.max(categoryOfferAmount, productOfferAmount);

      if (categoryOfferAmount > productOfferAmount) product.categoryOfferApplied = true;
      product.effectiveSalePrice = (product.regularPrice - greaterOfferAmount).toFixed(2);
    });

    const addresses = await Address.findOne({ userId });
    const wallet = await Wallet.findOne({ userId });
    const user = await User.findById(userId);

    if (!cart || cart.items.length === 0) {
      req.session.warning = "Your cart is empty";
      return res.redirect("/cart");
    }  
    let subtotal = 0;
    let itemCount = 0;

    cart.items.forEach((item) => {
      const price = item.productId.effectiveSalePrice || item.productId.regularPrice;
      subtotal += price * item.quantity;
      itemCount += item.quantity;
    });

    const tax = subtotal * 0.05;
    const discountAmount = cart.discountAmount || 0;
    const total = subtotal + tax - discountAmount;

    const cartData = {
      items: cart.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        total:
          (item.productId.effectiveSalePrice|| item.productId.regularPrice) *
          item.quantity,
      })),
      subtotal,
      tax,
      discountAmount,
      total,
      itemCount,
      appliedCoupon: cart.couponApplied,
    };

    res.render("checkout", {
      cart: cartData,
      addresses: addresses ? addresses.address : [],
      wallet,
      user,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error in loadCheckout:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load checkout page",
    });
  }
};

const placeOrder = async (req, res) => {
  try {

    const COD_LIMIT = 5000; 
    const userId = req.session.user;
    const { addressId, paymentMethod, razorpayOrderId , paymentFailed} = req.body;

    // Find address
    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc || !addressDoc.address) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "No addresses found",
      });
    }

    const selectedAddress = addressDoc.address.find(
      (addr) => addr._id.toString() === addressId
    );
    if (!selectedAddress) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid address selected",
      });
    }
    

    // Get cart with coupon details
    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        populate: { path: "category" }
      }) 
      .populate("couponApplied").lean();

    if (!cart || cart.items.length === 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Cart is empty",
      });
    }  

    let subtotal = 0;
    const orderItems = [];

    // Validate products and calculate total
    
    for (const item of cart.items) {  
      const product = await Product.findById(item.productId._id);

      if (!product) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message:` Product not found: ${item.productId.productName}`,
        }); 
      }
     
      if (product.quantity < item.quantity) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: `Insufficient stock for ${product.productName}. Available: ${product.quantity}`,
        });
      }

      const categoryOfferAmount = (item.productId.category.categoryOffer / 100) * item.productId.regularPrice;
      const productOfferAmount = item.productId.salePrice ? (item.productId.regularPrice - item.productId.salePrice) : 0;
      const greaterOfferAmount = Math.max(categoryOfferAmount, productOfferAmount);
      
     
      const effectivePrice = parseFloat((item.productId.regularPrice - greaterOfferAmount).toFixed(2));
      
  
      subtotal += effectivePrice * item.quantity;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: effectivePrice,
      });
    }

  

    const tax = subtotal * 0.05;
    const discountAmount = cart.discountAmount || 0;
    const total = subtotal + tax - discountAmount;

  
    let finalTotal = total;
    if (cart.couponApplied) {
      finalTotal -= cart.couponApplied.offerPrice;
    }

  
    if (paymentMethod === 'COD' && finalTotal > COD_LIMIT) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Cash on Delivery is not available for orders above ₹${COD_LIMIT}. Please choose a different payment method.`
      });
    }

    const orderId = generateOrderId()
  
    
    
    // Create order
    const order = new Order({
      orderId,
      userId,
      orderedItems: orderItems,
      totalPrice: subtotal,
      tax: tax,
      discountAmount: discountAmount,
      finalAmount: finalTotal,
      couponApplied: cart.couponApplied,
      shippingAddress: selectedAddress,
      paymentMethod: paymentMethod,
      paymentStatus:
        paymentMethod === "COD"
          ? "Pending"
          : paymentMethod === "RAZORPAY"
          ? 
          paymentFailed
          ? "Failed"
          : "Paid"
          : "Pending",
      status: "Pending",
      paymentDetails:
        paymentMethod === "RAZORPAY" && !paymentFailed
          ? {
              orderId: razorpayOrderId,
            }
          : undefined,
    });

    await order.save();

    // Update product quantities
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: -item.quantity },
      });
    }

    // Clear cart
    await Cart.findOneAndUpdate(
      { userId },
      {
        $set: {
          items: [],
          couponApplied: null,
          discountAmount: 0,
        },
      }
    );
    if(paymentFailed){
      return res.status(HttpStatus.OK).json({
        success: false,
        message: "Payment failed",    
      });
    }
    res.status(HttpStatus.OK).json({
      success: true,
      message: "Order placed successfully",
      orderId: order.orderId
    });
  } catch (error) {
    console.error("Error in placeOrder:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to place order. Please try again.",
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user;
  

    // Find the order to cancel
    const order = await Order.findOne({
      orderId: orderId,
      userId,
      status: { $nin: ["Cancelled", "Delivered", "Returned"] }
    }).populate("orderedItems.product");

    if (!order) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Order not found or cannot be cancelled",
      });
    }

    // Handle COD orders
    if (order.paymentMethod === "COD") {
      order.status = "Cancelled";
      await order.save();

      // Restore product quantities
      for (const item of order.orderedItems) {
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { quantity: item.quantity },
        });
      }

      return res.status(HttpStatus.OK).json({
        success: true,
        message: "Order cancelled successfully.",
      });
    }
 
    // Handle Razorpay refund and add to wallet
    if (order.paymentMethod === "RAZORPAY") {  
      
      if (order.paymentDetails?.paymentId) {
        try {
          const refund = await razorpay.payments.refund(order.paymentDetails.paymentId, {
            amount: order.finalAmount * 100,
          });
          console.log("Razorpay refund response:", refund);
        } catch (error) {
          console.error("Error processing Razorpay refund:", error);
        }
      }

      // Add refund amount to wallet
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
    
        const newWallet = new Wallet({
          userId,
          balance: order.finalAmount,
          transactions: [{
            type: "credit",
            amount: order.finalAmount,
            description: `Refund for cancelled order #${order.orderId}`,
          }]
        });
        await newWallet.save();
      } else {
        await Wallet.findOneAndUpdate(
          { userId },
          {
            $inc: { balance: order.finalAmount },
            $push: {
              transactions: {
                type: "credit",
                amount: order.finalAmount,
                description: `Refund for cancelled order #${order.orderId}`,
              }
            }
          }
        );
      }
    }

    // Update order status
    order.status = "Cancelled";
    await order.save();

    // Restore product quantities
    for (const item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { quantity: item.quantity },
      });
    }

    console.log("Order cancellation completed successfully");
    res.status(HttpStatus.OK).json({
      success: true,
      message: order.paymentMethod === "RAZORPAY" 
        ? "Order cancelled successfully. Refund amount will be added to your wallet"
        : "Order cancelled successfully"
    });
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to cancel order. Please try again later.",
    });
  }
};

// Load order success page
const getOrderSuccess = async (req, res) => {
  try {
    const orderId = req.query.orderId;
    const userId = req.session.user;
    const order = await Order.findOne({ orderId: orderId, userId }).populate(
      "orderedItems.product"
    );

    if (!order) {
      req.session.error = "Order not found";
      return res.redirect("/orders");
    }
    

    res.render("order-success", {
      order,
      user: req.session.user,
      message: "Order placed successfully!"
    });
  } catch (error) {
    console.error("Error in getOrderSuccess:", error);
    req.session.error = "Error loading order details";
    res.redirect("/orders");
  }
};

// Load order history page
const getOrderHistory = async (req, res) => {
  try {
    const userId = req.session.user;

    const page=parseInt(req.query.page)|| 1
    const limit=7
    const skip=(page-1)*limit

    const totalOrder=await Order.countDocuments({userId})

    const orders = await Order.find({ userId })
      .populate("orderedItems.product")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

      const totalPages=Math.ceil(totalOrder/limit)

    res.render("order-history", {
      orders,
      user: req.session.user,
      title: "Order History",
      currentPage:page,
      totalPages
    });
  } catch (error) {
    console.error("Error in getOrderHistory:", error);
    req.session.error = "Failed to load order history";
    res.redirect("/");
  }
};

// Load order details page
const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params; 
    const userId = req.session.user;

  
    const order = await Order.findOne({ orderId, userId }).populate({
      path: "orderedItems.product",
      select: "productName productImage price",
    });
    
    if (!order) {
      return res.redirect("/orders");
    }

    res.render("order-details", {
      order,
      user: req.session.user,
      title: "Order Details",
    });
  } catch (error) {
    console.error("Error in getOrderDetails:", error);
    res.redirect("/orders");
  }
};


// Apply coupon
const applyCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    const { couponCode } = req.body;

    // Find the coupon
    const coupon = await Coupon.findOne({
      name: couponCode,
      isList: true,
      expireOn: { $gt: new Date() },
    });

    if (!coupon) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid or expired coupon code",
      });
    }


    const previousOrder = await Order.findOne({
      userId,
      'couponApplied': coupon._id
    });
    
    if (previousOrder) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "You have already used this coupon",
      });
    }


    // FIND user cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Cart is empty",
      });
    }

    //  cart total
    let subtotal = 0;
    cart.items.forEach((item) => {
      const price = item.productId.salePrice || item.productId.regularPrice;
      subtotal += price * item.quantity;
    });

    // Check minimum purchase requirement
    if (subtotal < coupon.minimumPrice) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minimumPrice} required for this coupon`,
      });
    }

    // Apply discount
    const discountAmount = Math.min(coupon.offerPrice, subtotal);
    const tax = subtotal * 0.05;
    const newTotal = subtotal + tax - discountAmount;

    // Update cart with coupon
    await Cart.findOneAndUpdate(
      { userId },
      {
        $set: {
          couponApplied: coupon._id,
          discountAmount: discountAmount,
        },
      }
    );

    res.json({
      success: true,
      message: "Coupon applied successfully!",
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      newTotal: newTotal.toFixed(2),
      couponCode: coupon.name,
    });
  } catch (error) {
    console.error("Error in applyCoupon:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to apply coupon",
    });
  }
};

// Remove coupon
const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user;

    // Find cart and remove coupon
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Calculate cart totals without coupon
    let subtotal = 0;
    cart.items.forEach((item) => {
      const price = item.productId.salePrice || item.productId.regularPrice;
      subtotal += price * item.quantity;
    });

    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    // Update cart removing coupon and discount
    await Cart.findOneAndUpdate(
      { userId },
      {
        $set: {
          couponApplied: null,
          discountAmount: 0,
        },
      }
    );

    res.status(HttpStatus.OK).json({
      success: true,
      message: "Coupon removed successfully",
      cart: {
        items: cart.items,
        subtotal,
        tax,
        total,
        discountAmount: 0,
        appliedCoupon: null,
      },
    });
  } catch (error) {
    console.error("Error in removeCoupon:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to remove coupon",
    });
  }
};

// List available coupons
const listAvailableCoupons = async (req, res) => {
  try {

    const userId = req.session.user;
    const usedCoupons = await Order.find({ userId })
      .select("couponApplied")
      .lean();

    const usedCouponIds = usedCoupons.map((order) => order.couponApplied);

    const coupons = await Coupon.find({
      isList: true,
      expireOn: { $gt: new Date() },
      _id: { $nin: usedCouponIds },
    }).select("name offerPrice minimumPrice");

    if (!coupons.length) {
      console.log("No coupons found.");
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "No available coupons found",
      });
    }

    res.json({
      success: true,
      coupons,
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch coupons",
    });
  }
};

// Create Razorpay order
const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId } = req.body;

    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        populate: { path: "category" }
      })
      .populate("couponApplied");

    if (!cart || cart.items.length === 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Cart is empty",
      });
    }
    for (const item of cart.items) {  
      const product = await Product.findById(item.productId._id);

      if (!product) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message:` Product not found: ${item.productId.productName}`,
        }); 
      }
     
      if (product.quantity < item.quantity) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: `Insufficient stock for ${product.productName}. Available: ${product.quantity}`,
        });
      }
    }

    let subtotal = 0;
    cart.items.forEach((item) => {
      const price = item.productId.salePrice || item.productId.regularPrice;
      subtotal += price * item.quantity;
    });

    const tax = subtotal * 0.05;
    const discountAmount = cart.discountAmount || 0;
    const total = Math.round((subtotal + tax - discountAmount) * 100); // Convert to paise

    const options = {
      amount: total,
      currency: "INR",
      receipt: `order_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.status(HttpStatus.OK).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create payment order",
    });
  }
};

// Verify payment
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid payment verification",
      });
    }

    // Update the order status
    await Order.findOneAndUpdate(
      { "paymentDetails.orderId": razorpay_order_id },
      {
        $set: {
          paymentStatus: "Paid",
          "paymentDetails.paymentId": razorpay_payment_id,
          "paymentDetails.signature": razorpay_signature,
        },
      }
    );

    res.status(HttpStatus.OK).json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};

// Submit return request
const submitReturnRequest = async (req, res) => {
  try {
    const { orderId, reason, details } = req.body;
    const userId = req.session.user;

    // Validate input
    if (!orderId || !reason || !details) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "All fields are required" });
    }

    // Find the order
    const order = await Order.findOne({ orderId: orderId, userId });

    if (!order) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Order not found" });
    }

    if (order.status !== "Delivered") {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Only delivered orders can be returned" });
    }

    if (order.status === "Cancelled") {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Cancelled orders cannot be returned" });
    }

    if (order.returnRequest && order.returnRequest.status !== "None") {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Return request already exists for this order" });
    }

    
    const deliveryDate = order.updatedAt;
    const returnWindow = 7 * 24 * 60 * 60 * 1000; 
    if (Date.now() - deliveryDate > returnWindow) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Return window has expired (7 days from delivery)" });
    }

    // Update order return request
    order.returnRequest = {
      status: "Pending",
      reason: reason,
      details: details,
      requestDate: new Date()
    };

    await order.save();

    res.status(HttpStatus.OK).json({ message: "Return request submitted successfully" });
  } catch (error) {
    console.error("Error in submitReturnRequest:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
  }
};

module.exports = {
  loadCheckout,
  placeOrder,
  cancelOrder,
  getOrderSuccess,
  getOrderHistory,
  getOrderDetails,
  applyCoupon,
  removeCoupon,
  createRazorpayOrder,
  verifyPayment,
  submitReturnRequest,
  listAvailableCoupons,
}
  