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

user_Router.get("/login",userController.loadLogin)
user_Router.post("/login",userController.login)

user_Router.get("/",userController.loadHomePage)
user_Router.get("/logout",userController.logout)

//product management
user_Router.get("/productDetails",productController.productDetails)
user_Router.get("/shop",productController.getShopPage)

module.exports=user_Router

