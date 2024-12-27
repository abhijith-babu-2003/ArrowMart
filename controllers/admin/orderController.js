const Order = require('../../models/orderSchema');
const Product = require("../../models/ProductSchema");

// List all orders
const listOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('userId', 'name email phone')
            .populate('orderedItems.product', 'productName productImage price')
            .sort({ createdAt: -1 });

        res.render('orders', { orders });
    } catch (error) {
        console.error('Error in listOrders:', error);
        res.redirect('/admin/dashboard');
    }
};

// Update order status
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (status === 'Cancelled' && order.status !== 'Cancelled') {
            for (const item of order.orderedItems) {
                await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { quantity: item.quantity } }
                );
            }
        }
    
        if (order.status === 'Cancelled' && status !== 'Cancelled') {
            for (const item of order.orderedItems) {
                await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { quantity: -item.quantity } }
                );
            }
        }

        order.status = status;
        await order.save();

        res.json({ 
            success: true, 
            message: 'Order status updated successfully' 
        });
    } catch (error) {
        console.error('Error in updateOrderStatus:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update order status' 
        });
    }
};

// Cancel order
const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (['Delivered', 'Cancelled'].includes(order.status)) {
            return res.status(400).json({ 
                success: false, 
                message: "Cannot cancel order in current status" 
            });
        }

        // Restore product quantities
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

// Get order details
const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await Order.findById(orderId)
            .populate('userId', 'name email phone')
            .populate('orderedItems.product', 'productName productImage price');

        if (!order) {
            return res.redirect('/admin/orders');
        }

        res.render('orderDetails', { order });
    } catch (error) {
        console.error('Error in getOrderDetails:', error);
        res.redirect('/admin/orders');
    }
};

module.exports = {
    listOrders,
    updateOrderStatus,
    cancelOrder,
    getOrderDetails
};
