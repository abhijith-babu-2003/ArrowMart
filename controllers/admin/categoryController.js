const category=require("../../models/categorySchema")


const categoryinfo=async(req,res)=>{
  try {
    const page=parseInt(req.query.page)|| 1;
    const limit=4;
    const skip = (page - 1) * limit;

    const categoryData=await category.find({})
    .sort({createdAt:-1})
    .skip(skip)
    .limit(limit)

     const totalCategories=await category.countDocuments()
     const totalPages=Math.cell(totalCategories/limit)
     res.render("category"),{
      cat:categoryData,
      currentPage:page,
      totalPages:totalPages,
      totalCategories:totalCategories
     }

  } catch (error) {
    console.error(error);
    req.redirect("/pageError")
    
  }
        
}


const addCategory=async(req,res)=>{
    const {name,description}=req.body
    try {
        
     const existingCategory=await category.findOne({name})
     if(existingCategory){

        return res.status(400).json({error:"Category already exist"})

     }

     const newCategory=new category({
        name,
        description,
     })
     await newCategory.save()
     return res.json({message:"Category added successfully"})
    } catch (error) {
        
     return res.status(500).json({error:"internal server error"})

    }
}


module.exports={
    categoryinfo,
    addCategory
}