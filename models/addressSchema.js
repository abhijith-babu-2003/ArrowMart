const mongoose=require("mongoose")
const {Schema}=mongoose

const addressSchema=new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    address:[{
        addressType:{
            type:String,
            required:true
        },
        name:{
            type:String,
            required:true
        },
        city:{
            type:String,
            required:true
        },
        landMark:{
            type:String,
            required:true
        },
        state:{
            type:String,
            required:true
        },
        pincode:{
            type:String,
            required:true
        },
        phone:{
            type:String,
            required:true
        },
        altPhone:{
            type:String,
            required:true
        }
    }]
}, {
    validateBeforeSave: false // Disable automatic validation
})

// Custom validation middleware
addressSchema.pre('save', function(next) {
    if (this.isModified('address')) {
        // Only validate the last address if we're adding a new one
        const lastAddress = this.address[this.address.length - 1];
        if (lastAddress) {
            const requiredFields = ['addressType', 'name', 'city', 'landMark', 'state', 'pincode', 'phone', 'altPhone'];
            const missingFields = requiredFields.filter(field => !lastAddress[field]);
            if (missingFields.length > 0) {
                next(new Error(`Missing required fields in new address: ${missingFields.join(', ')}`));
                return;
            }
        }
    }
    next();
});

const Address=mongoose.model("Address",addressSchema)

module.exports=Address