const User=require("../../models/userSchema")
const nodemailer=require("nodemailer")
const bcrypt=require("dotenv").config()
const session=require("express-session")



function generateotp(){
    const otp=Math.floor(100000+ Math.random()*900000).toString()
        console.log("generated OTP:",otp)
        return otp       
}


async function sendVerificationEmail(email,otp){
    try {
        const transporter=nodemailer.createTransport({
            service:"Gmail",
            auth:{
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        })
        const info=await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your OTP for password reset ",
            text:`Your OTP is ${otp}`,
            html: `<p>Your OTP: ${otp}</p>`,

        });
      
    // console.log("email send:",info.messageId);
    return info.accepted.length > 0
    
    } catch (error) {
         console.error("error sending email",error);
         return false;
         
    }
}

const forgotPassword =async(req,res)=>{
    try {
        res.render("forgotPassword")
    } catch (error) {
        res.status(400).json("page not renderig")
    }
}

const forgetValidate=async(req,res)=>{
    try {
        const {email}=req.body
        const findUser=await User.find({email:email})
         
         
        if(findUser){
           const otp= generateotp()
           const emailSent=await sendVerificationEmail(email,otp)
           if(emailSent){
             req.session.userOtp=otp
             req.session.UserEmail=email         
             
             res.render("forgotOtp")
             console.log("OTP:",otp);
             
         }else{
          res.json({success:false,message:"failed to send OTP.please try agian"})
         }
        }else{
            res.render("forgotPassword",{
                message:"User with this email does not exist"
            })
        }
    } catch (error) {
       res.redirect("/pageNotFound") 
    }
}

const forgotOtp=async(req,res)=>{
    try {
       const enterdOtp=req.body.otp
    
       
       if(enterdOtp?.toString()=== req.session.userOtp?.toString()) { 
   
        
        res.json({success:true,redirectUrl:"/resetPassword"})
       }else{
        res.json({success:false,message:"OTP not matching"})
       }
    } catch (error) {
        res.status(500).json({success:false,message:"An error occured"})
        
    }
}

const resetPassword=async(req,res)=>{
    try {
        res.render("resetPassword")
    } catch (error) {
        res.status(400)
    }
}







const userProfile =async (req,res)=>{
    try {
        const userId=req.session.user
        const userData= await User.findById(userId)
        res.render("userProfile",{
            user:userData,

        })
    } catch (error) {
        
        console.error(error);
        res.redirect("/pageNotFound")
        
    }
}
const changeDetails =async(req,res)=>{
    try {
      
        const id=req.session.id
        const userData= await User.findById(id)
        if(userData){
            res.render("editDetails",{user:userData})
        }else{
            res.redirect("/userProfile")
        }
    } catch (error) {
        console.error("error retriving profile data",error);
        res.redirect("/pageNotFound")
        
    }
} 

// const updateDetails=async(req,res)=>{
//     try {
//        const userId=req.query.id
//        const updateData={
//         username:req.body.username,
//         email:req.body.email,
//         phone:req.body.phone
//        }
//        const user=await User.findByIdAndUpdate(userId,{$set:updateData},{new:true})
//        if(!user){
//         return res.status(400).send("user not found")
//        }
//      res.redirect("/userProfile")
//     } catch (error) {
//         console.error("error retriving profile data",error);
//         res.redirect("/pageNotFound")
         
//     }
// }

const updateDetails =async(req,res)=>{
    try {
        const {email,username,phone}=req.body
        const userExists= await User.findOne({email,username,phone})
        if(userExists){
            
        }
    } catch (error) {
        
    }
}


module.exports={
    userProfile,
    changeDetails,
    updateDetails,
    forgotPassword,
    forgetValidate,
    forgotOtp,
    resetPassword
}