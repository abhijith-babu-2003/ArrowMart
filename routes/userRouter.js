const express=require("express");
const user_Router=express.Router();
const{userAuth}=require("../middileware/auth")
const userController=require("../controllers/user/userController");
const productController=require("../controllers/user/productContoller")
const profileController=require("../controllers/user/profileController")
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

//loginpage
user_Router.get("/login",userController.loadLogin)
user_Router.post("/login",userController.login)

//product and home page 
user_Router.get("/",userController.loadHomePage)
user_Router.get("/logout",userController.logout)
user_Router.get("/productDetails",userAuth,productController.productDetails)
//shop manegement

user_Router.get("/shop",userAuth,userController.getShopPage)
user_Router.get("/filter",userAuth,userController.filterProduct)

//userProfile management
user_Router.get("/userprofile",userAuth,profileController.userProfile)
user_Router.get('/changeDetails',userAuth,profileController.changeDetails)
user_Router.post('/changeDetails',userAuth,profileController.updateDetails)

user_Router.get("/forgotPassword",profileController.forgotPassword)
user_Router.post("/forgetValidate",profileController.forgetValidate)
user_Router.post("/forgotOtp",profileController.forgotOtp)
user_Router.get("/resetPassword",profileController.resetPassword)
module.exports=user_Router

