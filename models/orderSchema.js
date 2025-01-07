const mongoose=require("mongoose")
const {Schema}=mongoose
const {generateOrderId} = require("../utils/orderIdGenerator")

const orderSchema=new Schema({
    orderId:{
        type:String,
        default: generateOrderId,
        unique:true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    orderedItems:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            required:true
        },
        price:{
            type:Number,
            required: true
        }
    }],
    totalPrice:{
        type:Number,
        required:true
    },
    tax: {
        type: Number,
        required: true
    },
    discountAmount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    shippingAddress:{
        type: Schema.Types.Mixed,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['COD', 'RAZORPAY'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed'],
        default: 'Pending'
    },
    status:{
        type:String,
        required:true,
        enum:['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
        default: 'Pending'
    },
    deliveredAt: {
        type: Date,
        default: null
    },
    paymentDetails: {
        orderId: String,
        paymentId: String,
        signature: String
    },
    returnRequest: {
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'None'],
            default: 'None'
        },
        reason: String,
        requestDate: Date,
        processedDate: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;