const mongoose=require("mongoose")
const {Schema}=mongoose

const productSchema=new Schema ({
     productName:{
         type:String,
         required:true
     },
     description:{
        type:String,
        required:true
     },
     brand:{
        type:String,
        required:false
     },
     category:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Category",
        required:true
     },
     regularPrice:{
        type:Number,
        required:true
     },
     salePrice:{
        type:Number,
        required:true
     },
     productOffer:{
        type:Number,
        default:true
     },
     quantity:{
        type:Number,
        default:true
     },
     color:{
        type:String,
        required:true
     },
     productImage:{
        type:[String],
        required:true
     },
     isBlocked:{
        type:Boolean,
        default:false
     },
     status:{
        type:String,
        enum:["Available","out of stock","Discountinued"],
        required:true,
        default:"Avaliable"
     },
     popularity:{
        type:Number,
        required:true,
        default:0
     }

},{timestamps:true})

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

module.exports=Product