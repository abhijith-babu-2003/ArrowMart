const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");

const loadCheckout = async (req, res) => {
    try {
        const user = req.session.user;
        const cart = await Cart.findOne({ user: user._id }).populate(
            "items.productId",
            "productName productImage salePrice"
        );

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        // Calculate total
        const total = cart.items.reduce((acc, item) => {
            return acc + (item.productId.salePrice * item.quantity);
        }, 0);

        res.render("checkout", { 
            cart,
            user: user,
            total
        });
    } catch (error) {
        console.error("Checkout error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to load checkout page"
        });
    }
};

module.exports = {
    loadCheckout
};
