const User=require("../../models/userSchema")
const Product=require("../../models/ProductSchema")


const getWishlist=async(req,res)=>{
    try {
        const userId=req.session.user
        const user=await User.findById(userId)

        const products=await Product.find({_id:{$in:user.wishlist}}).populate('category')
        res.render('wishlist',{
            user,
            wishlist:products
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({message:"Internal Server Error"})
    }
}




module.exports={
    getWishlist
}