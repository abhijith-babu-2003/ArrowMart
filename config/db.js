const mongoose=require("mongoose")
const env=require("dotenv").config()

const connectDb=async ()=>{
    try {
        await mongoose.connect(process.env.MONGODBATLAS)
        console.log("DB connected");
        
    } catch (error) {
        console.log("DB connection error",error.message);
        process.exit(1)
        
    }
}
module.exports=connectDb