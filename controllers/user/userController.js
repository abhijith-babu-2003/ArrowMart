const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const Category=require("../../models/categorySchema")
const Product=require("../../models/ProductSchema")
const env = require("dotenv").config();
const bcrypt = require("bcrypt");
const fs = require("fs");
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
   
    const user=req.session.user
    const categories=await Category.find({isListed:true})
    let productData=await Product.find(
     {isBlocked:false,
       category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
     }
    )

    productData.sort((a,b)=>new Date(b.createdOn) - new Date(a.createdOn))
    productData=productData.slice(0,4)


    if(user){
      const userData=await User.findOne({ _id:user})
     res.render("home", { user:userData ,products:productData });
    }else{
       return res.render("home",{ user:null,products:productData});
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
    if(!req.session.userId){
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
    const user=req.session.user
     const userData=await User.findOne({_id:user})
     const categories=await Category.find({isListed:true}) 
     const categoryIds=categories.map((category)=>category._id.toString())
     const page=parseInt(req.query.page) || 1
     const limit=20
     const skip=(page-1)*limit

     const products=await Product.find({
      isBlocked:false,
      category:{$in:categoryIds},
      quantity:{$gt:0},

     }).sort({createdOn:-1}).skip(skip).limit(limit)
     const totalProducts=await Product.countDocuments({
       isBlocked:false,
       category:{$in:categoryIds},
       quantity:{$gt:0}
     })

     const totalPages=Math.ceil(totalProducts / limit)
     const categoriesWithIds=categories.map(category=>({_id:category._id, categoryName:category.categoryName}))


     res.render("shop", {
      user: userData,
      products: products,
      categories: categoriesWithIds, 
      totalProducts: totalProducts,
      currentPage: page,
      totalPages: totalPages
    });
    
  } catch (error) {
     res.status(500).send("Internal server error")
      
  }
}

const filterProduct = async (req, res) => {
  try {
    const category = req.query.category;
    const query = {
      isBlocked: false,
      quantity: { $gt: 0 },
    };

    if (category) {
      const isValidCategory = mongoose.Types.ObjectId.isValid(category);
      if (isValidCategory) {
        query.category = new mongoose.Types.ObjectId(category); 
      } else {
        console.log("Invalid category ID");
      }
    }

    const products = await Product.find(query).lean();
   const categories = await Category.find({ isListed: true }).lean();


    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(products.length / itemsPerPage);

    const paginatedProducts = products.slice(startIndex, endIndex);



    
    res.render("shop", {
      user: req.session.user || null,
      products: paginatedProducts,
      categories:categories,
      currentPage,
      totalPages,
      selectedCategory: category || null,
    });
  } catch (error) {
    console.error("Error filtering products:", error);
    res.redirect("/pageNotFound");
  }
};


const filterPrice = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true }).lean();

  
    const gt = parseFloat(req.query.gt) || 0; 
    const lt = parseFloat(req.query.lt) || 1000000; 

    let findProduct = await Product.find({
      salePrice: { $gt: gt, $lt: lt },
      isBlocked: false,
      quantity: { $gt: 0 }
    }).lean();

    findProduct.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(findProduct.length / itemsPerPage);
    const currentProduct = findProduct.slice(startIndex, endIndex);

    req.session.filterProduct = findProduct;

    res.render('shop', {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage
    });

  } catch (error) {
    console.error("Error:", error);
    res.redirect("/pageNotFound");
  }
};


const searchProducts = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });

    let search = req.query.search ? req.query.search.trim() : ''; // Trim extra spaces
    const categories = await Category.find({ isListed: true }).lean();

    const categoryIds = categories.map((category) => category._id.toString());
    let searchResults = [];

    if (req.session.filterProduct && req.session.filterProduct.length > 0) {
      searchResults = req.session.filterProduct.filter((product) =>
        product.productName.toLowerCase().includes(search.toLowerCase())
      );
    } else {
      searchResults = await Product.find({
        productName: { $regex: `.*${search}.*`, $options: 'i' }, 
        isBlocked: false,
        quantity: { $gt: 0 },
        category: { $in: categoryIds },
      });
    }

    searchResults.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(searchResults.length / itemsPerPage);
    const currentProduct = searchResults.slice(startIndex, endIndex);

    res.render('shop', {
      user: userData,
      products: currentProduct,
      categories: categories,
      totalPages,
      currentPage,
      count: searchResults.length,
      query: search || '',
    });
    
  } catch (error) {
    console.error('error', error);
    res.redirect('pageNotFound');
  }
};


const sorting = async (req, res) => {
  const sortOption=req.query.sort || 'default'

  let sortCriteria

  switch (sortOption) {
    case '  popularity':
        sortCriteria ={ popularity: -1}
      break;
      case 'az':
        sortCriteria = { productName: 1 }; 
        break;
    case 'za':
        sortCriteria = { productName: -1 }; 
        break;
    case 'priceLow':
        sortCriteria = { salePrice: 1 }; 
        break;
    case 'priceHigh':
        sortCriteria = { salePrice: -1 }; 
        break;   
  
    default:
      sortCriteria = {}; 
      
  }
  try {
    const products=await Product.find().sort(sortCriteria)
    res.json(products)
   
  } catch (error) {
    res.status(500).json({error:"failed to fetch products"})
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
  filterProduct,
  filterPrice,
  searchProducts,
  sorting,
 
};
