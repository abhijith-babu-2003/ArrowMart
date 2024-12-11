const express=require("express");
const user_Router=express.Router();
const{userAuth}=require("../middileware/auth")
const userController=require("../controllers/user/userController");
const productController=require("../controllers/user/productContoller")
const passport = require("passport");

//signup
user_Router.get('/signup',userController.loadSignup)
user_Router.post('/signup',userController.signup)

user_Router.get("/pageNotFound",userController.pageNotFound)

//otp page
user_Router.get('/verifyOtp',userController. loadingOtp)
user_Router.post("/verifyOtp",userController.verifyOtp)
user_Router.post('/resend-otp',userController.resendOtp)

//gooleauth
user_Router.get('/auth/google',passport.authenticate("google",{scope:['profile',"email"]}))
user_Router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/"}),(req,res)=>{
    res.redirect("/")
})
user_Router.get('/auth/google', (req, res) => {
    if (req.isAuthenticated()) {
      
      res.render('/', { username: req.user.username });
    } else {
   
      res.render('/', { username: 'Guest' });
    }
  });
//loginpage
user_Router.get("/login",userController.loadLogin)
user_Router.post("/login",userController.login)

//product and home page 
user_Router.get("/",userController.loadHomePage)
user_Router.get("/logout",userController.logout)
user_Router.get("/productDetails",userAuth,productController.productDetails)
user_Router.get("/shop",userAuth,userController.getShopPage)
user_Router.get("/filter",userAuth,userController.filterProduct)


user_Router.get('/productDetails',productController.getProductDetails);
module.exports=user_Router

