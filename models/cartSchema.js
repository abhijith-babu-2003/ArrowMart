const mongoose=require("mongoose")
const {Schema}=mongoose

const cartSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    items:[{
        productId:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            default:1
        },
        price:{
            type:Number,
            required:true
        },
        totalPrice:{
            type:String,
            required:true
        },
       
    }],
    couponApplied: {
        type: Schema.Types.ObjectId,
        ref: "Coupon"
    },
    discountAmount: {
        type: Number,
        default: 0
    }
})

module.exports = mongoose.model("Cart", cartSchema);
