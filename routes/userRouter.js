const express=require("express");
const user_Router=express.Router();
const userController=require("../controllers/user/userController");

//signup
user_Router.get('/signup',userController.loadSignup)
user_Router.post('/signup',userController.signup)

user_Router.get("/pageNotFound",userController.pageNotFound)
user_Router.get("/",userController.loadHomePage)

user_Router.get('/verifyOtp',userController. loadingOtp)
user_Router.post("/verifyOtp",userController.verifyOtp)




module.exports=user_Router