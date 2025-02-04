const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const Category=require("../../models/categorySchema")
const Product=require("../../models/ProductSchema")
const Wishlist = require("../../models/wishlistSchema")
const env = require("dotenv").config();
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const mongoose=require("mongoose");

// secure passsword

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log(error.message);
  }
};



const loadHomePage = async (req, res) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({isListed: true});
    
    // Get user's wishlist if logged in
    let wishlistProductIds = [];
    if (user) {
      const wishlist = await Wishlist.findOne({ userId: user });
      wishlistProductIds = wishlist ? wishlist.products.map(item => item.productId.toString()) : [];
    }

    let productData = await Product.find(
      {
        isBlocked: false,
        category: {$in: categories.map(category => category._id)},
        quantity: {$gt: 0}
      }
    ).populate('category');

   
    productData.forEach(product => {
      const categoryOfferAmount = (product.category.categoryOffer / 100) * product.regularPrice;
      const productOfferAmount = (product.regularPrice - product.salePrice) || 0;
      const greaterOfferAmount = Math.max(categoryOfferAmount, productOfferAmount);
      
      if (categoryOfferAmount > productOfferAmount) {
        product.categoryOfferApplied = true;
        product.offerPercentage = product.category.categoryOffer;
      }
      product.effectiveSalePrice = (product.regularPrice - greaterOfferAmount).toFixed(2);
      
     
      product.isInWishlist = wishlistProductIds.includes(product._id.toString());
    });

  
    productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
    productData = productData.slice(0, 4);

    if (user) {
      const userData = await User.findOne({_id: user});
      res.render("home", { user: userData, products: productData });
    } else {
      return res.render("home", { user: null, products: productData });
    }
  } catch (error) {
    console.log("home page not found");
    res.status(500).send("server error");
  }
};



const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("home page not loading:", error);
    res.status(500).send("server error");
  }
};



const signup = async (req,res) => {
  try {
    const { username, phone, email, password, cpassword } = req.body;

    if (password !== cpassword) {
      return res.render("signup", { message: "Passwords don't match" });
    }
    
    const findUser = await User.findOne({ email });
    if (findUser) {
      console.log("Email already exists");
      return res.status(400).json({ message: "Email already exists" });
    }
    // Generate OTP
    let otp;
    try {
      otp = generateotp(); 
     
    } catch (err) {
      console.error("Error generating OTP:", err);
      return res.render("signup", { message: "Error generating OTP" });
    }
    // Send OTP via email
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      console.error("Error sending verification email");
      // return res.render("signup", { message: "Error sending verification email" });
      return res.json("email.error");
    }

    // Save OTP and user data in session before rendering
    req.session.userOtp = otp;
    req.session.userData = { username, phone, email, password };

    // Redirect to OTP verification page
    return res.status(200).json({ message: "otp generated successfully" });
   
  } catch (error) {
    console.error("Signup error:", error);
    return res.redirect("/pageNotFound");
  }
};

//otp page loading

const loadingOtp = async (req, res) => {
  try {
    return res.render("verifyOtp");
  } catch (error) {
    console.log("error is", error);
  }
};



//create random otp
function generateotp() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated OTP:", otp);
  return otp;
}


//send verification email
async function sendVerificationEmail(email, otp) {
  try {
   
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



// otp verification

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body; //---destructure

    if (!otp) {
      return res
        .status(400)
        .json({ success: false, message: "OTP is required" });
    }
    
    if (otp.toString() === req.session.userOtp?.toString()) {
      const user = req.session.userData;

    
      const passwordHash = await securePassword(user.password);

     
      const saveUserData = new User({
        username: user.username,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      });

      await saveUserData.save();

      req.session.user = saveUserData._id;

      return res.json({ success: true, redirectUrl: "/login" });   
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP. Please try again." });
    }
  } catch (error) {
    console.error("Error during OTP verification:", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};



//otp resending
const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res.status(400).json({ success: false, message: "email not found in session" });
    }

    const otp = generateotp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      console.log("Resend OTP :", otp);
      res.status(200).json({ success: true, message: "OTP has been resent successfully." });
    } else {
      res.status(500).json({  success: false,  message: "Failed to resend OTP. please try again",});
    }
  } catch (error) {
    console.error("error resending OTP:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "internal server error. please tyr again",
      });
  }
};



//error page
const pageNotFound = async (req, res) => {
  try {
     return res.render("pageNotFound");
  } catch (error) {
    res.redirect("/pageNotFound");
  }
};


//login 

const loadLogin=async(req,res)=>{
  try {
    if(!req.session.user){
      return res.render("login")
    }else{
       res.redirect("/")
    }
  } catch (error) {
    console.error("Error in loadLogin:", error);
    res.redirect("/login");
  }
}

const login =async(req,res)=>{
  try {
    
    const {email,password}=req.body
 
  
  const findUser=await User.findOne({isAdmin:0,email})
 
  if(!findUser){
    return res.status(400).json({ message: "User not found" ,success:false});
  }
  if(findUser.isBlocked){

    return res.status(400).json({message:"User is blocked by admin" ,success:false})
  }
  
  const passwordMatch= await bcrypt.compare(password,findUser.password)
 
  
  if(!passwordMatch){
    return res.status(400).json({ message: "Incorrect password" ,success:false});
  }
  
  req.session.user=findUser._id

    
    console.log("User logged in successfully:");
   
    res.status(200).json({ message: "Login successful",success:true });

  } catch (error) {
    console.log("login error",error);
    res.status(500).json({ message: "Login failed. Please try again later." });  
  
  }
}

const logout =async (req,res)=>{
  try {
      
    req.session.destroy((err)=>{
      if(err){
        console.log("session destruction error",err.message);
        return res.redirect("pageNotFound")
      }
      return res.redirect("/login")
    })

  } catch (error) {
     console.log("logout error",error);
     res.redirect("/pageNotFound")
     
  }
}


const getShopPage=async(req,res)=>{
  
  try {
    const user=req.session.user;
    const userData=await User.findOne({_id:user});
    const categories=await Category.find({isListed:true});
    
    // Get user's wishlist
    const wishlist = await Wishlist.findOne({ userId: user });
    const wishlistProductIds = wishlist ? wishlist.products.map(item => item.productId.toString()) : [];

    const page=parseInt(req.query.page) || 1;
    const limit=12;
    const skip=(page-1)*limit;

    // Build query object based on filters
    const query = {
      isBlocked: false,
    };
    
    // Search text
    if (req.query.search) {
      query.$or = [
        { productName: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Category filter
    if (req.query.category) {
      query.category = req.query.category;
    } else {
      query.category = { $in: categories.map(category => category._id) };
    }

    // Price range filter
    if (req.query.priceRange) {
      const [min, max] = req.query.priceRange.split('-').map(Number);
      query.salePrice = { $gte: min };
      if (max) {
        query.salePrice.$lte = max;
      }
    }

  
    if (req.query.availability === 'inStock') {
      query.quantity = { $gt: 0 };
    } else if (req.query.availability === 'outOfStock') {
      query.quantity = 0;
    }
   

    // Sort options
    let sortOption = { createdOn: -1 }; 
    if (req.query.sortBy) {
      switch (req.query.sortBy) {
        case 'nameAsc':
          sortOption = { productName: 1 };
          break;
        case 'nameDesc':
          sortOption = { productName: -1 };
          break;
        case 'priceLow':
          sortOption = { salePrice: 1 };
          break;
        case 'priceHigh':
          sortOption = { salePrice: -1 };
          break;
      }
    }

  

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch products with populated category data
    const products = await Product.find(query)
      .populate('category')  
      .skip(skip)
      .limit(limit)
      .sort(sortOption);

      products.forEach(product => {
        const categoryOfferAmount = (product.category.categoryOffer / 100) * product.regularPrice;
        const productOfferAmount = (product.regularPrice -  product.salePrice) || 0;
        const greaterOfferAmount = Math.max(categoryOfferAmount, productOfferAmount);
        
        if(categoryOfferAmount > productOfferAmount)product.categoryOfferApplied = true
        product.effectiveSalePrice = (product.regularPrice - greaterOfferAmount).toFixed(2);
        
        // Add wishlist status
        product.isInWishlist = wishlistProductIds.includes(product._id.toString());
      });
      
      // Build search parameters for pagination links
      let searchParams = '';
      if (req.query.search) searchParams += `&search=${req.query.search}`;
      if (req.query.category) searchParams += `&category=${req.query.category}`;
      if (req.query.priceRange) searchParams += `&priceRange=${req.query.priceRange}`;
      if (req.query.sortBy) searchParams += `&sortBy=${req.query.sortBy}`;
      if (req.query.availability) searchParams += `&availability=${req.query.availability}`;
      
    res.render("shop", {
      user: userData,
      products: products,
      categories: categories,
      totalProducts: totalProducts,
      currentPage: page,
      totalPages,
      searchParams,
      query: req.query.search || '',
      selectedCategory: req.query.category || '',
      selectedPriceRange: req.query.priceRange || '',
      selectedSort: req.query.sortBy || '',
      selectedAvailability: req.query.availability || ''
    });

  } catch (error) {
    console.log("error in shop page", error);
    res.redirect("/pageNotFound");
  }
};



module.exports = {
  loadHomePage,
  pageNotFound,
  loadSignup,
  signup,
  verifyOtp,
  loadingOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  getShopPage,
 
 
};
