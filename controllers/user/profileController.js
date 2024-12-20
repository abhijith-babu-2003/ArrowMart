const User=require("../../models/userSchema")
const Address=require("../../models/addressSchema")
const nodemailer=require("nodemailer")
const env=require("dotenv").config()
const bcrypt = require('bcrypt');
const session=require("express-session")
const mongoose = require('mongoose');



function generateotp(){
    const otp=Math.floor(100000+ Math.random()*900000).toString()
        console.log("generated OTP:",otp)
        return otp       
}

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log(error.message);
  }
};


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
        const findUser=await User.findOne({email:email})

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
        const enterdOtp = req.body.otp;

        if (enterdOtp.trim() === req.session.userOtp?.toString().trim()) { 
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

const resendOtp=async(req,res)=>{
    try {
        const otp=generateotp()
        req.session.userOtp=otp
        const email= req.session.UserEmail
        console.log('Resending OTP to email:',email);
        
        const emailSent=await sendVerificationEmail(email,otp)
        if(emailSent){
            console.log('Resend OTP:',otp);
            res.status(200).json({success:true,message:'Resend OTP Successfull'})
            
        }
    } catch (error) {
         console.error('error in resend otp',error)
         res.status(500).json({success:false,message:"internal server error"})
         
    }
}

const newPassword=async(req,res)=>{
    try {
        const {newPass1,newPass2}=req.body
        const email=req.session.UserEmail

        if(newPass1===newPass2){
          const passwordHash = await securePassword(newPass1);
          const result = await User.updateOne(
            { email: email },
            { $set: { password: passwordHash } }
          );
         
          req.session.message = "Password successfully changed";
         res.redirect('/login',{message:"Password successfully changed"});

        }else{
            req.session.message = "Error updating password. Please try again.";
            res.redirect("/resetPassword",{message});
        }
    } catch (error) {
        console.error("Error in newPassword function:", error.message);
        res.redirect("/pageNotFound")
    }
}


const userProfile =async (req,res)=>{
    try {
        const userId=req.session.user
        const userData= await User.findById(userId)
        const addressData=await Address.findOne({userId:userId})
        res.render("userProfile",{
            user:userData,
            userAddress:addressData

        })
    } catch (error) {
        
        console.error(error);
        res.redirect("/pageNotFound")
        
    }
}



const updateDetails =async(req,res)=>{
    try {
        const { id } = req.params;

        const {username, email, phone }=req.body
        const  updatedDetails=await User.updateOne({_id:id},{username, email, phone})

        if (updatedDetails.modifiedCount > 0) {
            res.json({ success: true, message: "User details updated successfully!" });
        } else {
            res.status(400).json({ success: false, message: "Failed to update user details" });
        }
    } catch (error) {
        console.error(error.message);
        
        res.json({success:false,message:"Failed to update user details"})
    }
}



const changePassword =async(req,res)=>{
    try {
        const userId=req.session.user
       
        const {currentPassword,newPassword }=req.body


        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user=await User.findById(userId)
        if(!user){
            return res.status(404).json({ success:false,message:'user not found'})
        }

        const isMatchCurrent=await bcrypt.compare(currentPassword, user.password)
        if(!isMatchCurrent){
            return res.status(400).json({success:false, message:"Current password is incorrect"})
        }

        const hashedPassword=await bcrypt.hash(newPassword ,10)

        user.password=hashedPassword
       
        
        await user.save()
        res.status(200).json({success:true, message: "Password changed successfully" });
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ success:false,message: "Internal server error" });
    }
}



const postAddAddresss=async(req,res)=>{
    try {
        const userId=req.session.user
        const UserData=await User.findOne({_id:userId})

     const {addressType,name,city,landMark,state,pincode,phone,altPhone}=req.body
 
     const userAddress=await Address.findOne({userId: UserData._id})

     if(!userAddress){
        const newAddress= new Address({
            userId:  UserData._id,
            address:[{addressType,name,city,landMark,state,pincode,phone,altPhone}]
        })
        await newAddress.save()
     }else{
        userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone})
        await userAddress.save()
     }
     res.json({ success: true, message: "Address added successfully" });
    } catch (error) {
        console.error("error adding address",error);
        res.redirect("/pageNotFound")
        
    }
}

const editAddress =async(req,res)=>{
    try {
        const { id } = req.params;
        const user=req.session.id   
        const data=req.body
    
   const findAddress=await Address.findOne({
    "address._id":id
   })
    
   if(!findAddress){
    return res.redirect("/pageNotFound")
   }
   
    await Address.updateOne(
        {"address._id":id},
        {$set:{"address.$":{
         _id:id,
         addressType:data.addressType,
         name:data.name,
         city:data.city,
         landMark:data.landMark,
         state:data.state,
         pincode:data.pincode,
         phone:data.phone,
         altPhone:data.altPhone
        }
    }}
    )
    res.json({success:true,message:"Address edited successfully"})

    } catch (error) {
        console.error(error.message);
        
        res.json({success:false,message:"Failed to update address"})
    }
}


const deleteAddress=async(req,res)=>{
    try {
       const addressId=req.params.id 
       const findAddress=await Address.findOne({"address._id":addressId})
       if(!findAddress){
        res.status(404).json({success:false,message:"address not found"})
       }
       await Address.updateOne({
        "address._id":addressId
       },
       {
        $pull:{address:{_id:addressId}}
       }
    )

    res.status(200).json({success:true,message:"address deleted successfully"})
    } catch (error) {
         console.error("error in delete addresss",error);
         res.redirect("/pageNotFound")
         
    }
}







module.exports={
    userProfile, 
    updateDetails,
    forgotPassword,
    forgetValidate,
    forgotOtp,
    resetPassword,
    resendOtp,
    newPassword,
    changePassword,
    postAddAddresss,
    editAddress,
    deleteAddress
}












