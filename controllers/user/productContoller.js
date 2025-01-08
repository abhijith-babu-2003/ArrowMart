const Product=require("../../models/ProductSchema")
const Category=require("../../models/categorySchema")
const User=require("../../models/userSchema")


const productDetails=async(req,res)=>{
    try {
        const UserId=req.session.user
        const userData=await User.findById(UserId)
        const productId=req.query.id
      
        const category=await Category.find({isBlocked:false})
        const product = await Product.findById(productId).populate('category');
        if(!product){
            throw new Error("product not found")
        }
        const findCategory = product.category|| {};
        const categoryOffer = findCategory?.categoryOffer || 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;

      

        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: productId },
        });
    
        

        res.render("productDetails",{
            user:userData,
            product:product,
            category:category,
            quantity:product.quantity,
            totalOffer:totalOffer,
            category:findCategory,
            relatedProduct: relatedProducts
        })
    } catch (error) {
        console.error("Error fetching product details:",error);
        res.redirect("/pageNotFound")
        
    }
}




module.exports={
    productDetails


}