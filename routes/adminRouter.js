const express=require("express")
const admin_Router=express.Router()
const adminController=require("../controllers/admin/adminController")
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController")
const productController=require('../controllers/admin/productController')
const {userAuth,adminAuth}=require("../middileware/auth")
const upload =require('../config/multer')


//login management
admin_Router.get("/",adminController.loadLogin )
admin_Router.post("/",adminController.login)
admin_Router.get("/dashboard",adminAuth,adminController.dashboard)
admin_Router.get("/pageError",adminController.pageerror)
admin_Router.get("/logout",adminController.adminLogout)

//cumstomer management

admin_Router.get("/users",adminAuth,customerController.customerInfo)
admin_Router.get('/blockCustomer',adminAuth,customerController.blockCustomer)
admin_Router.get('/unblockCustomer',adminAuth,customerController.unblockCustomer)

//category management

admin_Router.get("/category",adminAuth,categoryController.categoryinfo)
admin_Router.post("/addCategory",adminAuth,upload.single('image'),categoryController.addCategory)
admin_Router.get("/listCategory",adminAuth,categoryController.listCategory)
admin_Router.get("/unlistCategory",adminAuth,categoryController.unlistCategory)
admin_Router.post('/editCategory/:id',adminAuth,categoryController.editCategory)

//porduct management
admin_Router.post("/addProducts", adminAuth, upload.array('images',4), productController.addProducts)
admin_Router.get("/products", adminAuth, productController.getAllProduct);
admin_Router.get('/addProducts',adminAuth,productController.getaddProducts)
admin_Router.get("/editProducts", adminAuth, productController.getEditProducts);
admin_Router.post("/editProducts",adminAuth,upload.array('images',4),productController.editproduct)
admin_Router.post("/deleteImage",adminAuth,productController.deleteSingleImage)

admin_Router.get("/blockProduct",adminAuth,productController.blockProduct)
admin_Router.get("/unblockProduct",adminAuth,productController.unblockProduct)






module.exports =admin_Router