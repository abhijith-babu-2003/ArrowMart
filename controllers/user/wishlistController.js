const User=require("../../models/userSchema")
const Product=require("../../models/ProductSchema")
const Wishlist=require("../../models/wishlistSchema")   

const getWishlist = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            console.error("User ID not found in session");
            return res.render('wishlist', { user: null, wishlist: [] });
        }

        // Fetch user wishlist
        const wishlist = await Wishlist.findOne({ userId });
    

        if (!wishlist || wishlist.products.length === 0) {
            console.log("Wishlist is empty or not found");
            return res.render('wishlist', { user: req.session.user, wishlist: [] });
        }

    
        const productIds = wishlist.products.map(product => product.productId);
    

        // Fetch  products
        const products = await Product.find({ _id: { $in: productIds } }).populate('category');
    

        res.render('wishlist', {
            user: req.session.user,
            wishlist: products
        });
    } catch (error) {
        console.error("Error in getWishlist:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user; 
        const productId = req.body.productId; 

        if (!userId || !productId) {
            return res.status(400).json({ status: false, message: "User ID or Product ID is missing" });
        }

        // Find the user wishlist
        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            //  no wishlist , create a new one
            wishlist = new Wishlist({
                userId,
                products: []
            });
        }

        // Check if the product is already in the wishlist
        const productExists = wishlist.products.some(
            (product) => product.productId.toString() === productId
        );


        if (productExists) {
            return res.status(400).json({ status: false, message: "Product already in wishlist" });
        }

        
        wishlist.products.push({ productId });
        await wishlist.save();

        res.status(200).json({ status: true, message: "Product added to wishlist" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};



const removeFromWishlist = async (req, res) => {
    try {
        const productId = req.query.productId;
        const userId = req.session.user;

        if (!productId || !userId) {
            return res.status(400).json({ status: false, message: "Product ID or User ID is missing" });
        }

        // Find wishlist for the user
        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist || wishlist.products.length === 0) {
            return res.status(404).json({ status: false, message: "Wishlist is empty or not found" });
        }

        const index = wishlist.products.findIndex(item => item.productId.toString() === productId.toString());

        if (index === -1) {
            return res.status(404).json({ status: false, message: "Product not found in wishlist" });
        }

        wishlist.products.splice(index, 1);
        await wishlist.save();
        res.redirect('/wishlist');  
    } catch (error) {
        console.error("Error in removeFromWishlist:", error);
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
};


module.exports={
    getWishlist,
    addToWishlist,
    removeFromWishlist
}