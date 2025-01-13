const Order = require("../../models/orderSchema");
const Product = require("../../models/ProductSchema");

// List all orders
const listOrders = async (req, res) => {
  try {
    
    const page = parseInt(req.query.page) || 1; 
    const limit = 10; 
    const skip = (page - 1) * limit;


    const totalOrders = await Order.countDocuments();

   
    const orders = await Order.find()
      .populate("userId", "name email phone")
      .populate("orderedItems.product", "productName productImage price")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalOrders / limit);

    res.render("orders", {
      orders,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error("Error in listOrders:", error);
    res.redirect("/admin/dashboard");
  }
};


// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (status === "Cancelled" && order.status !== "Cancelled") {
      for (const item of order.orderedItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: item.quantity },
        });
      }
    }

    if (order.status === "Cancelled" && status !== "Cancelled") {
      for (const item of order.orderedItems) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { quantity: -item.quantity },
        });
      }
    }

    // Set deliveredAt timestamp when order is marked as delivered
    if (status === "Delivered" && order.status !== "Delivered") {
      order.deliveredAt = new Date();
    }

    order.status = status;
    await order.save();

    res.json({
      success: true,
      message: "Order status updated successfully",
    });
  } catch (error) {
    console.error("Error in updateOrderStatus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};

// Cancel order
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ _id: orderId });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (["Delivered", "Cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel order in current status",
      });
    }

    // Restore product quantities
    for (const item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product, {
  
        $inc: { quantity: item.quantity },
      });
    }
    
    order.status = "Cancelled";
    await order.save();

    res.json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
    });
  }
};

// Get order details
const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("userId", "name email phone")
      .populate("orderedItems.product", "productName productImage price");

    if (!order) {
      return res.redirect("/admin/orders");
    }

    res.render("orderDetails", { order });
  } catch (error) {
    console.error("Error in getOrderDetails:", error);
    res.redirect("/admin/orders");
  }
};

const processReturnRequest = async (req, res) => {
  try {
    const { orderId, action } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    //  pending return request
    if (!order.returnRequest || order.returnRequest.status !== "Pending") {
      return res
        .status(400)
        .json({ message: "No pending return request found" });
    }

    // Update return request status
    order.returnRequest.status = action === "approve" ? "Approved" : "Rejected";
    order.returnRequest.processedDate = new Date();

    // If approved, update order status to Returned
    if (action === "approve") {
      order.status = "Returned";
    }

    await order.save();

    res.status(200).json({
      message: `Return request ${action}ed successfully`,
      order: order,
    });
  } catch (error) {
    console.error("Error in processReturnRequest:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  listOrders,
  updateOrderStatus,
  cancelOrder,
  getOrderDetails,
  processReturnRequest,
};
