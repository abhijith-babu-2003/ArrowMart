const User= require('../../models/userSchema')
const nodemailer=require("nodemailer")
const env=require("dotenv").config()





//create random otp
function generateotp() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated OTP:", otp); 
  return otp; 
}

//send verification email
async function sendVerificationEmail(email, otp) {
  try {
    console.log("Creating email transporter...");
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    console.log("Sending email to:", email);
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`,
    });

    console.log("Email sent successfully:", info);
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}


const signup = async (req, res) => {
  try {
    const { username, email, password, cpassword } = req.body;

    // Password match check
    if (password !== cpassword) {
      console.log("Passwords do not match");
      return res.render("signup", { message: "Passwords don't match" });
    }

    // Check if the user already exists
    const findUser = await User.findOne({ email });
    if (findUser) {
      console.log("Email already exists");
      return res.render("signup", { message: "Email already exists" });
    }

    // Generate OTP
    console.log("Generating OTP...");
    const otp = generateotp();
    console.log("Generated OTP:", otp);

    // Send OTP via email
    console.log("Sending OTP to email:", email);
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      console.error("Error sending email");
      return res.render("signup", { message: "Error sending verification email" });
    }

    // Save OTP and user data in session
    req.session.userOtp = otp;
    req.session.userData = { username, email, password };

    console.log("OTP sent successfully and user data stored in session.");
    return res.json({ message: "User registered successfully!" });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


const loadSignup=async (req,res)=>{
  try {

    return res.render("signup")

  } catch (error) {
    
    console.log("home page not loading:",error);
    res.status(500).send("server error")
    
  }
}

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
    signup
}