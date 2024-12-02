const express=require("express")
const admin_Router=express.Router()
const adminController=require("../controllers/admin/adminController")
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController")
const {userAuth,adminAuth}=require("../middileware/auth")


//login management
admin_Router.get("/",adminController.loadLogin )
admin_Router.post("/",adminController.login)
admin_Router.get("/dashboard",adminAuth,adminController.dashboard)
admin_Router.get("/pageError",adminController.pageerror)
admin_Router.get("/logout",adminController.adminLogout)

//cumstomer management

admin_Router.get("/users",adminAuth,customerController.customerInfo)
admin_Router.get('/blockCustomer',customerController.blockCustomer)
admin_Router.get('/unblockCustomer',customerController.unblockCustomer)

//category management

admin_Router.get("/category",categoryController.categoryinfo)
admin_Router.post("/addCategory",categoryController.addCategory)


module.exports =admin_Router