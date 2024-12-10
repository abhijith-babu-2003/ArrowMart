const User=require("../../models/userSchema")
const mongoose=require("mongoose")
const bcrypt=require("bcrypt")



const loadLogin = (req, res) => {
   try {
     if (req.session.admin) {
       return res.redirect("/admin/dashboard");
     }
     res.render("adminLogin",{ message: null });
   } catch (error) {
     console.log(error.message);
   }
 };


 
const login =async (req,res)=>{
   try {
      
      const {email,password}=req.body

      const admin=await User.findOne({email, isAdmin:true})
      if(!admin){

         return res.render("adminLogin",{message:"admin not found"})
      }
      const passwordMatch = await bcrypt.compare(password, admin.password);
      
         if(!passwordMatch){
           return res.render("adminLogin",{message:"invalid password"})

      }

      req.session.admin=true
      return res.redirect("/admin/dashboard")
   }catch{
         console.log("login error:",error.message);
         return res.redirect("/pageError")
         
   }
}
const dashboard=async(req,res)=>{

  
  if(req.session.admin){
   try {
      res.render("dashboard")
   } catch (error) {
      res.redirect("/pageError")
   }
  }

 }

 const pageerror =async (req,res)=>{
   res.render("pageError")
 }


 const adminLogout=async(req,res)=>{
   try {
      req.session.destroy(()=>{
         res.redirect("/admin")
         
      })
   } catch (error) {
      console.log("error during logout",error);
      res.redirect("/pageError")
   }
 }

module.exports={
    loadLogin,
    login,
    dashboard,
    pageerror,
    adminLogout
}