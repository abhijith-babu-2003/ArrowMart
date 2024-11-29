const express=require("express");
const user_Router=express.Router();
const userController=require("../controllers/user/userController");
const passport = require("passport");

//signup
user_Router.get('/signup',userController.loadSignup)
user_Router.post('/signup',userController.signup)

user_Router.get("/pageNotFound",userController.pageNotFound)
user_Router.get("/",userController.loadHomePage)

user_Router.get('/verifyOtp',userController. loadingOtp)
user_Router.post("/verifyOtp",userController.verifyOtp)
user_Router.post('/resend-otp',userController.resendOtp)

user_Router.get('/auth/google',passport.authenticate("google",{scope:['profile',"email"]}))
user_Router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res)=>{
    res.redirect("/")
})

user_Router.get("/login",userController.loadLogin)
user_Router.post("/login",userController.login)



module.exports=user_Router