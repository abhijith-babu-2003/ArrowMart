const Product=require("../../models/ProductSchema")
const Category=require("../../models/categorySchema")
const User=require("../../models/userSchema")


const productDetails=async(req,res)=>{
    try {
        const UserId=req.session.user
        const userData=await User.findById(UserId)
        const productId=req.query.id
      
        
        const product=await Product.findById(productId).populate('category')
        if(!product){
            throw new Error("product not found")
        }
        const findCategory = product.category|| {};
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;

        res.render("productDetails",{
            user:userData,
            product:product,
            quantity:product.quantity,
            totalOffer:totalOffer,
            category:findCategory
        })
    } catch (error) {
        console.error("error for fetching details",error);
        res.redirect("/pageNotFound")
        
    }
}


const getShopPage=async(req,res)=>{
    let user=req.session.user
    try {
        if(user){
            res.render("shop",{user})
        }else{
            res.redirect("/login")
        }
      
    } catch (error) {
       res.status(500).send("Internal server error")
        
    }
}

module.exports={
    productDetails,
    getShopPage
}