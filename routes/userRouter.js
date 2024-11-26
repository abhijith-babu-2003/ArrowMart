const express=require("express");
const user_Router=express.Router();
const userController=require("../controllers/user/userController");

//signup
user_Router.get('/signup',userController.loadSignup)
user_Router.post('/signup',userController.signup)

user_Router.get("/pageNotFound",userController.pageNotFound)
user_Router.get("/",userController.loadHomePage)





module.exports=user_Router