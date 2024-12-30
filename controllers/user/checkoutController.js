const mongoose = require('mongoose');
const Order = require("../../models/orderSchema.js");
const Cart = require("../../models/cartSchema.js");
const Product = require("../../models/ProductSchema.js");
const Address = require("../../models/addressSchema.js");
const Coupon = require("../../models/couponSchema.js");

const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .populate('couponApplied');

        const addresses = await Address.findOne({ userId });

        if (!cart || cart.items.length === 0) {
            req.session.warning = "Your cart is empty";
            return res.redirect('/cart');
        }

        let subtotal = 0;
        let itemCount = 0;

        cart.items.forEach(item => {
            const price = item.productId.salePrice || item.productId.regularPrice;
            subtotal += price * item.quantity;
            itemCount += item.quantity;
        });

        const tax = subtotal * 0.05;
        const discountAmount = cart.discountAmount || 0;
        const total = subtotal + tax - discountAmount;

        const cartData = {
            items: cart.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                total: (item.productId.salePrice || item.productId.regularPrice) * item.quantity
            })),
            subtotal,
            tax,
            discountAmount,
            total,
            itemCount,
            appliedCoupon: cart.couponApplied
        };

        res.render('checkout', { 
            cart: cartData,
            addresses: addresses ? addresses.address : [],
            user: req.session.user,
            title: 'Checkout'
        });
    } catch (error) {
        console.error('Error in loadCheckout:', error);
        req.session.error = "Failed to load checkout page";
        res.redirect('/cart');
    }
};

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, paymentMethod } = req.body;
        
        // Find address
        const addressDoc = await Address.findOne({ userId });
        if (!addressDoc || !addressDoc.address) {
            return res.status(400).json({ 
                success: false, 
                message: "No addresses found" 
            });
        }

        const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);
        if (!selectedAddress) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid address selected" 
            });
        }

        // Get cart with coupon details
        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .populate('couponApplied');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cart is empty" 
            });
        }

        let subtotal = 0;
        const orderItems = [];
        
        // Iterate each item in cart
        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            
            if (!product) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Product not found: ${item.productId.productName}` 
                });
            }
            
            if (product.quantity < item.quantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient stock for ${product.productName}. Available: ${product.quantity}` 
                });
            }
            
            const price = product.salePrice || product.regularPrice;
            subtotal += price * item.quantity;

            // Update quantity
            await Product.findByIdAndUpdate(
                product._id,
                { $inc: { quantity: -item.quantity } }
            );
            
            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: price
            });
        }

        const tax = subtotal * 0.05;
        const discountAmount = cart.discountAmount || 0;
        const total = subtotal + tax - discountAmount;

        // Create order
        const order = new Order({
            userId,
            orderedItems: orderItems,
            totalPrice: subtotal,
            tax: tax,
            discountAmount: discountAmount,
            finalAmount: total,
            couponApplied: cart.couponApplied,
            shippingAddress: selectedAddress,
            paymentMethod: paymentMethod || 'COD',
            paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Paid',
            status: 'Pending'
        });

        await order.save();
        
        // Clear cart
        await Cart.findOneAndUpdate(
            { userId },
            { 
                $set: { 
                    items: [],
                    couponApplied: null,
                    discountAmount: 0
                } 
            }
        );
        
        res.status(200).json({ 
            success: true, 
            message: "Order placed successfully",
            orderId: order._id
        });
    } catch (error) {
        console.error('Error in placeOrder:', error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to place order. Please try again." 
        });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId, userId });
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Order not found" 
            });
        }

        if (['Delivered', 'Cancelled'].includes(order.status)) {
            return res.status(400).json({ 
                success: false, 
                message: "Cannot cancel order in current status" 
            });
        }

        // Restore product quantities and iterate orderitems in order
        for (const item of order.orderedItems) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { quantity: item.quantity } }
            );
        }

        order.status = 'Cancelled';
        await order.save();

        res.json({ 
            success: true, 
            message: "Order cancelled successfully" 
        });
    } catch (error) {
        console.error('Error in cancelOrder:', error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to cancel order" 
        });
    }
};

const getOrderSuccess = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('orderedItems.product')
            .populate('userId');
        
        if (!order) {
            req.session.error = "Order not found";
            return res.redirect('/orders');
        }

        res.render('order-success', {
            order,
            user: req.session.user,
            title: 'Order Success'
        });
    } catch (error) {
        console.error('Error in getOrderSuccess:', error);
        req.session.error = "Failed to load order success page";
        res.redirect('/orders');
    }
};

const getOrderHistory = async (req, res) => {
    try {
        const userId = req.session.user;
        const orders = await Order.find({ userId })
            .populate('orderedItems.product')
            .sort({ createdAt: -1 });

        res.render('order-history', {
            orders,
            user: req.session.user,
            title: 'Order History'
        });
    } catch (error) {
        console.error('Error in getOrderHistory:', error);
        req.session.error = "Failed to load order history";
        res.redirect('/');
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId, userId })
            .populate({
                path: 'orderedItems.product',
                select: 'productName  productImage price'
            });

        if (!order) {
            return res.redirect('/orders');
        }

        res.render('order-details', {
            order,
            user: req.session.user,
            title: 'Order Details'
        });
    } catch (error) {
        console.error('Error in getOrderDetails:', error);
        res.redirect('/orders');
    }
};

const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user;
        const { couponCode } = req.body;

        // Find the coupon
        const coupon = await Coupon.findOne({ 
            name: couponCode,
            isList: true,
            expireOn: { $gt: new Date() }
        });

        if (!coupon) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired coupon code"
            });
        }

        // FIND user cart
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart is empty"
            });
        }

        //  cart total
        let subtotal = 0;
        cart.items.forEach(item => {
            const price = item.productId.salePrice || item.productId.regularPrice;
            subtotal += price * item.quantity;
        });

        // Check minimum purchase requirement
        if (subtotal < coupon.minimumPrice) {
            return res.status(400).json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minimumPrice} required for this coupon`
            });
        }

        // Apply discount
        const discountAmount = Math.min(coupon.offerPrice, subtotal);
        const tax = subtotal * 0.05;
        const newTotal = subtotal + tax - discountAmount;

        // Update cart with coupon
        await Cart.findOneAndUpdate(
            { userId },
            { 
                $set: { 
                    couponApplied: coupon._id,
                    discountAmount: discountAmount
                }
            }
        );

        res.json({
            success: true,
            message: "Coupon applied successfully!",
            subtotal: subtotal.toFixed(2),
            tax: tax.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            newTotal: newTotal.toFixed(2),
            couponCode: coupon.name
        });

    } catch (error) {
        console.error('Error in applyCoupon:', error);
        res.status(500).json({
            success: false,
            message: "Failed to apply coupon"
        });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user;
        
        // Find cart and remove coupon
        const cart = await Cart.findOne({ userId })
            .populate('items.productId');

        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        // Calculate cart totals without coupon
        let subtotal = 0;
        cart.items.forEach(item => {
            const price = item.productId.salePrice || item.productId.regularPrice;
            subtotal += price * item.quantity;
        });

        const tax = subtotal * 0.05;
        const total = subtotal + tax;

        // Update cart removing coupon and discount
        await Cart.findOneAndUpdate(
            { userId },
            {
                $set: {
                    couponApplied: null,
                    discountAmount: 0
                }
            }
        );

        res.status(200).json({
            success: true,
            message: "Coupon removed successfully",
            cart: {
                items: cart.items,
                subtotal,
                tax,
                total,
                discountAmount: 0,
                appliedCoupon: null
            }
        });

    } catch (error) {
        console.error('Error in removeCoupon:', error);
        res.status(500).json({
            success: false,
            message: "Failed to remove coupon"
        });
    }
};

module.exports = {
    loadCheckout,
    placeOrder,
    cancelOrder,
    getOrderSuccess,
    getOrderHistory,
    getOrderDetails,
    applyCoupon,
    removeCoupon
};