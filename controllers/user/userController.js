const User= require('../../models/userSchema')
const nodemailer=require("nodemailer")
const env=require("dotenv").config()
const bcrypt=require("bcrypt");
const { use } = require('../../routes/userRouter');





//create random otp
function generateotp() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated OTP:", otp); 
  return otp; 
}


//send verification email
async function sendVerificationEmail(email, otp) {
  try {

    // console.log("Creating email transporter...");
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });
    // console.log("Sending email to:", email);
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<p>Your OTP: ${otp}</p>`,
    });
    // console.log("Email sent successfully:", info);
    return info.accepted.length > 0;
  } catch (error) {

    console.error("Error sending email:", error);

    return false;
  }
}


const signup = async (req, res) => {
  try {
    const { username, phone, email, password, cpassword } = req.body;

    // Check if passwords match
    if (password !== cpassword) {
      
      return res.render("signup", { message: "Passwords don't match" });
    }
    // Check if the user already exists
    const findUser = await User.findOne({ email });
    if (findUser) {

      console.log("Email already exists");
      return res.render("signup", { message: "Email already exists" });
    }
    // Generate OTP
    let otp;
    try {

      otp = generateotp(); // Ensure `generateotp` is reliable
      // console.log("Generated OTP:", otp);
    } catch (err) {

      console.error("Error generating OTP:", err);
      return res.render("signup", { message: "Error generating OTP" });
    }
    // Send OTP via email
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {

      console.error("Error sending verification email");
      // return res.render("signup", { message: "Error sending verification email" });
      return res.json("email.error")
    }

    // Save OTP and user data in session before rendering
    req.session.userOtp = otp;
    req.session.userData = { username, phone, email, password };
    
    
    // Redirect to OTP verification page
    return res.status(200).json({message:'otp generated successfully'})
    // return res.render("verifyOtp");
  } catch (error) {

    console.error("Signup error:", error);
    return res.redirect("/pageNotFound");

  }
};


//otp page loading

const  loadingOtp=async(req,res)=>{
  try {

    return res.render('verifyOtp')

  } catch (error) {

    console.log('error is',error)
  }
}




const loadSignup=async (req,res)=>{
  try {

    return res.render("signup")

  } catch (error) {
    
    console.log("home page not loading:",error);
    res.status(500).send("server error")
    
  }
}


// secure passsword

const securePassword=async(password)=>{
  try {
    const passwordHash= await bcrypt.hash(password,10)
    return passwordHash

  } catch (error) {
      console.log(error.message);
      
  }
}


// otp verification

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ success: false, message: "OTP is required" });
    }

    if (otp.toString() === req.session.userOtp?.toString()) {
      const user = req.session.userData;

      // Secure password hashing
      const passwordHash = await securePassword(user.password);

      // Save user data
      const saveUserData = new User({
        username: user.username,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      });

      await saveUserData.save();

      // Update session
      req.session.user = saveUserData._id;
    
      return res.json({ success: true, redirectUrl: "/" });
    } else {
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error during OTP verification:", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};



//error page 
const pageNotFound =async (req,res)=>{
   try {

     res.render("pageNotFound")

   } catch (error) {

     res.redirect("/pageNotFound")

   }
}

//home page rendering

const loadHomePage=async (req,res)=>{
    try {

        return res.render("home")

    } catch (error) {

        console.log("home page not found");
        res.status(500).send("server error")

    }
}
module.exports={
    loadHomePage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    loadingOtp
}