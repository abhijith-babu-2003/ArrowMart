const category = require("../../models/categorySchema");

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
     const totalPages=Math.ceil(totalCategories / limit)

     res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,
  });

  } catch (error) {
    console.error(error);
    req.redirect("/pageError")
    
  }
        
}


const addCategory=async(req,res)=>{
    const {name: categoryName,description }=req.body

   

    const image = req.file ? `/${req.file.filename}` : null;

    console.log("File received from multer:", req.file);
    console.log("Image path:", image);
    
    try {
        
     const existingCategory=await category.findOne({categoryName})
     if(existingCategory){

        return res.status(400).json({error:"Category already exist"})
cls
     }

     const newCategory=new category({
        categoryName: categoryName,
        description: description,
        image
     })
     console.log("newCat", newCategory)
     await newCategory.save()
     return res.status(200).json({message:"Category added successfully"})
    } catch (error) {
     console.log('error', error)
     return res.status(500).json({error:"internal server error"})

    }
}




const listCategory=async(req,res)=>{
  try {
    let id=req.query.id
    await category.updateOne({_id:id},{$set:{isListed:false}})
    res.redirect("/admin/category")
  } catch (error) {
    res.redirect("/pageError")
  }
}

const unlistCategory=async(req,res)=>{
 try {

  let id=req.query.id
  await category.updateOne({_id:id},{$set:{isListed:true}})
  res.redirect("/admin/category")

 } catch (error) {
  res.redirect("/pageError")

 }
 
}



const editCategory=async (req,res)=>{
  try {
    const id=req.params.id;
    const {categoryName,description}=req.body
    const existingCategory=await category.findOne({name:categoryName})

    if(existingCategory){
      return res.status(400).json({error:"category exists"})
    }

    const updateCategory=await category.findByIdAndUpdate  (id,{
      name:categoryName,
      description:description,
    },{new:true})

    if(updateCategory){
      res.redirect("/admin/category")
    }else{
      res.status(404).json({error:"category not found"})
    }
   } catch (error) {
    res.status(500).json({error:"internal server error"})
  }
}

module.exports={
    categoryinfo,
    addCategory,
    listCategory,
    unlistCategory,
    editCategory
}