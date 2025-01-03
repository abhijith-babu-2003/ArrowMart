const mongoose = require('mongoose');
const Order = require("../../models/orderSchema.js");
const Cart = require("../../models/cartSchema.js");
const Product = require("../../models/ProductSchema.js");
const Address = require("../../models/addressSchema.js");
const Coupon = require("../../models/couponSchema.js");
const Wallet = require("../../models/walletSchema.js");
const User = require("../../models/userSchema.js");
const razorpay = require('../../config/razorpay.js');

const crypto = require('crypto');

const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user;
        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .populate('couponApplied');

        const addresses = await Address.findOne({ userId });
        const wallet = await Wallet.findOne({ userId });
        const user = await User.findById(userId);

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
            wallet,
            user,
            razorpayKey: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error in loadCheckout:', error);
        res.status(500).json({ 
            success: false, 
            message: "Failed to load checkout page" 
        });
    }
};

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, paymentMethod, razorpayOrderId } = req.body;
        
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
        
        // Validate products and calculate total
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

            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: price
            });
        }

        const tax = subtotal * 0.05;
        const discountAmount = cart.discountAmount || 0;
        const total = subtotal + tax - discountAmount;

        // Handle wallet payment
        if (paymentMethod === 'WALLET') {
            const wallet = await Wallet.findOne({ userId });
            if (!wallet || wallet.balance < total) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient wallet balance"
                });
            }

            // Deduct from wallet
            await Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: -total },
                    $push: {
                        transactions: {
                            type: 'debit',
                            amount: total,
                            description: `Order payment`
                        }
                    }
                }
            );
        }

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
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'WALLET' ? 'Paid' : 
                         (paymentMethod === 'COD' ? 'Pending' : 
                         (paymentMethod === 'RAZORPAY' ? 'Paid' : 'Pending')),
            status: 'Pending',
            paymentDetails: paymentMethod === 'RAZORPAY' ? {
                orderId: razorpayOrderId
            } : undefined
        });

        await order.save();

        // Update wallet transaction with order ID if it was wallet payment
        if (paymentMethod === 'WALLET') {
            await Wallet.findOneAndUpdate(
                { userId, 'transactions.description': 'Order payment' },
                {
                    $set: {
                        'transactions.$.description': `Order payment - Order ID: ${order._id}`
                    }
                }
            );
        }

        // Update product quantities
        for (const item of orderItems) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { quantity: -item.quantity } }
            );
        }
        
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

        // Find and update order status directly
        const order = await Order.findOneAndUpdate(
            { _id: orderId, userId, status: { $nin: ['Delivered', 'Cancelled'] } },
            { 
                $set: { 
                    status: 'Cancelled',
                    paymentStatus: 'WALLET' ? 'Refunded' : 'Failed'
                } 
            },
            { new: true }
        ).populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Order not found or cannot be cancelled" 
            });
        }

        // Restore quantities
        for (const item of order.orderedItems) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { quantity: item.quantity } }
            );
        }

        // Refund to wallet if paid by wallet
        if (order.paymentMethod === 'WALLET' && order.paymentStatus === 'Refunded') {
            const wallet = await Wallet.findOne({ userId });
            
            if (!wallet) {
                // Create new wallet with refund
                const newWallet = new Wallet({
                    userId,
                    balance: order.finalAmount,
                    transactions: [{
                        type: 'credit',
                        amount: order.finalAmount,
                        description: `Refund for cancelled order - Order ID: ${order._id}`
                    }]
                });
                await newWallet.save();
            } else {
                // Add refund to existing wallet
                await Wallet.findOneAndUpdate(
                    { userId },
                    {
                        $inc: { balance: order.finalAmount },
                        $push: {
                            transactions: {
                                type: 'credit',
                                amount: order.finalAmount,
                                description: `Refund for cancelled order - Order ID: ${order._id}`
                            }
                        }
                    }
                );
            }
        }
        res.status(200).json({
            success: true,
            message: "Order cancelled successfully" + (order.paymentMethod === 'WALLET' ? ". Amount refunded to wallet." : "")
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
        const orderId = req.query.orderId;
        const order = await Order.findById(orderId)
            .populate('orderedItems.product');

        if (!order) {
            return res.status(404).redirect('/orders');
        }

        res.render('order-success', {
            order,
            message: 'Order placed successfully!'
        });
    } catch (error) {
        console.error('Error in getOrderSuccess:', error);
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

const createRazorpayOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId } = req.body;

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
        cart.items.forEach(item => {
            const price = item.productId.salePrice || item.productId.regularPrice;
            subtotal += price * item.quantity;
        });

        const tax = subtotal * 0.05;
        const discountAmount = cart.discountAmount || 0;
        const total = Math.round((subtotal + tax - discountAmount) * 100); // Convert to paise

        const options = {
            amount: total,
            currency: "INR",
            receipt: `order_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({
            success: false,
            message: "Failed to create payment order"
        });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment verification"
            });
        }

        // Update the order status
        await Order.findOneAndUpdate(
            { "paymentDetails.orderId": razorpay_order_id },
            {
                $set: {
                    "paymentStatus": "Paid",
                    "paymentDetails.paymentId": razorpay_payment_id,
                    "paymentDetails.signature": razorpay_signature
                }
            }
        );

        res.status(200).json({
            success: true,
            message: "Payment verified successfully"
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: "Payment verification failed"
        });
    }
};


const  submitReturnRequest=async(req,res)=>{
    try {
        const { orderId, reason, details } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

      
        if (order.status !== 'Delivered') {
            return res.status(400).json({ message: 'Only delivered orders can be returned' });
        }

        if (order.status === 'Cancelled') {
            return res.status(400).json({ message: 'Cancelled orders cannot be returned' });
        }

        //  return request already exists
        if (order.returnRequest && order.returnRequest.status !== 'None') {
            return res.status(400).json({ message: 'Return request already exists for this order' });
        }

        // Update order with return request
        order.returnRequest = {
            status: 'Pending',
            reason: `${reason}: ${details}`,
            requestDate: new Date()
        };

        await order.save();

        res.status(200).json({ message: 'Return request submitted successfully' });
    } catch (error) {
        console.error('Error in submitReturnRequest:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}


module.exports = {
    loadCheckout,
    placeOrder,
    cancelOrder,
    getOrderSuccess,
    getOrderHistory,
    getOrderDetails,
    applyCoupon,
    removeCoupon,
    createRazorpayOrder,
    verifyPayment,
    submitReturnRequest
};