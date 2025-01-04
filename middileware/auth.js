const User=require("../models/userSchema")


const userAuth=(req,res,next)=>{
    if(req.session.user){ 
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
         
                next()
            }else{
                res.redirect("/login")
            }
        })
        .catch(error=>{
            console.log("error in user auth middileware",error);
            res.status(500).send("internal server error")
        })
    }else{
     res.redirect("/login")
    }
}



const adminAuth = async (req, res, next) => {
    if (req.session.admin) {
        try {
            const data = await User.findOne({ isAdmin: true });
            if (data) {
                next();
            } else {
                res.redirect("/admin/login");
            }
        } catch (error) {
            console.log("Error in adminAuth middleware", error);
            res.status(500).send("Internal server error");
        }
    } else {
        res.redirect("/admin");
    }
};


module.exports={
    userAuth,
    adminAuth
}