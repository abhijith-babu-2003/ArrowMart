const Order = require("../../models/orderSchema");
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Handle payment failure
const handlePaymentFailure = async (req, res) => {
    try {
        const { razorpayOrderId } = req.body;
        const userId = req.session.user;
        
        // Find order by razorpayOrderId instead of _id
        const order = await Order.findOne({ razorpayOrderId });
        
        if (!order) {
            // Create new order with pending status
            const newOrder = new Order({
                userId,
                razorpayOrderId,
                paymentStatus: 'payment_pending',
                orderStatus: 'pending'
            });
            await newOrder.save();
            
            return res.json({
                success: true,
                orderId: newOrder._id,
                message: 'New pending order created'
            });
        }
        
        // Update existing order status
        order.paymentStatus = 'payment_pending';
        await order.save();

        res.json({
            success: true,
            orderId: order._id,
            message: 'Order status updated to pending'
        });
    } catch (error) {
        console.error('Error handling payment failure:', error);
        res.status(500).json({
            success: false,
            message: 'Error handling payment failure'
        });
    }
};

// Retry payment
const retryPayment = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Convert amount to paise and ensure it's an integer
        const amount = Math.round(order.finalAmount * 100);

        // Create new Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: amount, // Amount in paise
            currency: 'INR',
            receipt: orderId
        });

        // Update order with new Razorpay order ID
        order.paymentDetails = {
            orderId: razorpayOrder.id
        };
        await order.save();

        res.json({
            success: true,
            order: razorpayOrder,
            key_id: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('Error retrying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrying payment'
        });
    }
};

// Verify payment
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

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

        // Find and update order
        const order = await Order.findOne({ "paymentDetails.orderId": razorpay_order_id });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Update payment status
        order.paymentStatus = "Paid";
        order.paymentDetails.paymentId = razorpay_payment_id;
        order.paymentDetails.signature = razorpay_signature;
        await order.save();

        res.json({
            success: true,
            message: "Payment verified successfully"
        });
    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({
            success: false,
            message: "Payment verification failed"
        });
    }
};

module.exports = {
    handlePaymentFailure,
    retryPayment,
    verifyPayment
};
