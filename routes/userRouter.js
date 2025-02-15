const express = require("express");
const user_Router = express.Router();
const { userAuth } = require("../middileware/auth");
const userController = require("../controllers/user/userController");
const productController = require("../controllers/user/productContoller");
const profileController = require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartContoller");
const checkoutController = require("../controllers/user/checkoutController");
const wishlistController = require("../controllers/user/wishlistController");
const walletController = require("../controllers/user/walletController");
const orderController = require("../controllers/user/orderController");
const paymentController = require("../controllers/user/paymentController");
const passport = require("passport");

//signup
user_Router.get("/signup", userController.loadSignup);
user_Router.post("/signup", userController.signup);

user_Router.get("/pageNotFound", userController.pageNotFound);

//otp page
user_Router.get("/verifyOtp", userController.loadingOtp);
user_Router.post("/verifyOtp", userController.verifyOtp);
user_Router.post("/resend-otp", userController.resendOtp);

//gooleauth
user_Router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
user_Router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.session.user = req.user;
    return res.redirect("/");
   
  }
);

//loginpage
user_Router.get("/login", userController.loadLogin);
user_Router.post("/login", userController.login);

//product and home page
user_Router.get("/", userAuth, userController.loadHomePage);
user_Router.get("/logout", userController.logout);
user_Router.get("/productDetails", userAuth, productController.productDetails);
//shop manegement

user_Router.get("/shop", userAuth, userController.getShopPage);

//userProfile management
user_Router.get("/userprofile", userAuth, profileController.userProfile);

user_Router.put("/userdetails/:id", userAuth, profileController.updateDetails);

user_Router.post("/changePassword", userAuth, profileController.changePassword);
//forgot password
user_Router.get("/forgotPassword", profileController.forgotPassword);
user_Router.post("/forgetValidate", profileController.forgetValidate);
user_Router.post("/forgotOtp", profileController.forgotOtp);
user_Router.get("/resetPassword", profileController.resetPassword);
user_Router.post("/resendOtp", profileController.resendOtp);
user_Router.post("/resetPassword", profileController.newPassword);

//address management

user_Router.post("/addAddress", userAuth, profileController.postAddAddresss);
user_Router.put("/editAddress/:id", userAuth, profileController.editAddress);
user_Router.delete(
  "/deleteAddress/:id",
  userAuth,
  profileController.deleteAddress
);

//cart management
user_Router.get("/cart", userAuth, cartController.getCart);
user_Router.post("/addCart", userAuth, cartController.addToCart);
user_Router.delete("/removeitem", userAuth, cartController.removeFromCart);
user_Router.put(
  "/cart/update-quantity",
  userAuth,
  cartController.updateQuantity
);

// checkout and order routes
user_Router.get("/checkout", userAuth, checkoutController.loadCheckout);
user_Router.post("/place-order", userAuth, checkoutController.placeOrder);
user_Router.get("/order-success", userAuth, checkoutController.getOrderSuccess);
user_Router.get("/orders", userAuth, checkoutController.getOrderHistory);
user_Router.get("/order/:orderId",userAuth,checkoutController.getOrderDetails);
user_Router.get("/order/:orderId/invoice",userAuth,orderController.downloadInvoice);
user_Router.delete("/order/cancel/:orderId",userAuth,checkoutController.cancelOrder);

// Order return
user_Router.post(
  "/order/return",
  userAuth,
  checkoutController.submitReturnRequest
);

// wishlist management

user_Router.get("/wishlist", userAuth, wishlistController.getWishlist);
user_Router.post("/addWishlist", userAuth, wishlistController.addToWishlist);
user_Router.get("/removeitem", userAuth, wishlistController.removeFromWishlist);

// Wallet routes
user_Router.get("/wallet", userAuth, walletController.getWallet);
user_Router.post("/add-money", userAuth, walletController.addMoney);
// Coupon routes
user_Router.post("/apply-coupon", userAuth, checkoutController.applyCoupon);
user_Router.post("/remove-coupon", userAuth, checkoutController.removeCoupon);
user_Router.get("/coupons", userAuth, checkoutController.listAvailableCoupons);
// Razorpay routes
user_Router.post(
  "/create-razorpay-order",
  userAuth,
  checkoutController.createRazorpayOrder
);
user_Router.post("/verify-payment", userAuth, checkoutController.verifyPayment);

// Payment failure and retry routes
user_Router.post('/payment/failure', userAuth, paymentController.handlePaymentFailure);
user_Router.get('/retry-payment/:orderId', userAuth, paymentController.retryPayment);

module.exports = user_Router;