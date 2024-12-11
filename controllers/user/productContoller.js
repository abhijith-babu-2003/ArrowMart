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



  const getProductDetails = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: productId },
        }).limit(4);
        
        if (relatedProducts.length === 0) {
            console.log('No related products found.');
        }
        limit(4);

       
        res.render('productDetails', { 
            product, 
            relatedProducts 
        });
        
    } catch (error) {
        console.error('Error in getProductDetails:', error);
        res.status(500).json({ message: 'Server error' });
    }
};




module.exports={
    productDetails,
  getProductDetails,

}