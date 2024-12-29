const User=require("../../models/userSchema")
const Product=require("../../models/ProductSchema")
const Wishlist=require("../../models/wishlistSchema")   

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

const addToWishlist=async(req,res)=>{
    try {
        const userId=req.session.user
        const productId=req.body.productId
        const user=await User.findById(userId)
        if(user.wishlist.includes(productId)){
            return res.status(400).json({ status:false,message:"Product already in wishlist"})
        }
        user.wishlist.push(productId)
        await user.save()
        res.status(200).json({ status:true,message:"Product added to wishlist"})
    } catch (error) {
        console.error(error)
        res.status(500).json({ status:false,message:"Internal Server Error"})
    }
}


const removeFromWishlist = async (req, res) => {      
   try {
    const productId = req.query.productId;
    const userId = req.session.user;
    const user = await User.findById(userId);
    const index = user.wishlist.indexOf(productId);
    user.wishlist.splice(index, 1);
    await user.save();
    return res.redirect('/wishlist');
   } catch (error) {
      console.error(error); 
      return res.status(500).json({ status: false, message: "Internal Server Error" });
   }
};


module.exports={
    getWishlist,
    addToWishlist,
    removeFromWishlist
}