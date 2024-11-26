const User= require('../../models/userSchema')


const signup = async (req, res) => {
  console.log('Received data:', req.body); 
  
  const { username, phone, email, password } = req.body;
  try {
    const newUser = new User({ username, email, phone, password });
    await newUser.save();
    return res.redirect('/signup');
  } catch (error) {
    console.error('Error saving user:', error);
    res.status(500).send('Internal server error');
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