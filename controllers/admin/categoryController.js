const category = require("../../models/categorySchema");


const categoryinfo = async (req, res) => {

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const categoryData = await category.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);


    const totalCategories = await category.countDocuments();
    const totalPages = Math.ceil(totalCategories / limit);



    res.render("category", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategories: totalCategories,

    });

  } catch (error) {
    console.error(error);
    req.redirect("/pageError");

  }

};



const addCategory = async (req, res) => {

  const { name: categoryName, description,offer } = req.body;

  try {
    const existingCategory = await category.findOne({ categoryName });
    if (existingCategory) {

      return res.status(400).json({success: false, message: "Category already exists" });

    }
    const newCategory = new category({
      categoryName: categoryName,
      description: description,
      categoryOffer:offer,

    });

    await newCategory.save();
    return res.status(200).json({success: true, message: "Category added successfully" });  
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ success: false, message: "Internal server error" });

  }

};



const listCategory = async (req, res) => {

  try {

    let id = req.query.id;
    await category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.redirect("/admin/category");

  } catch (error) {
    res.redirect("/pageError");
  }

};



const unlistCategory = async (req, res) => {
  try {
    let id = req.query.id;
    await category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.redirect("/admin/category");

  } catch (error) {
    res.redirect("/pageError");

  }

};







const editCategory = async (req, res) => {

  try {
    const { id } = req.params;
    const { categoryName, description,offer } = req.body;

    const existingCategory = await category.findOne({categoryName,_id: { $ne: id } });

    if (existingCategory) {
      return res.status(400).json({ error: 'Category with this name already exists.' });
    }

    const updatedCategory = await category.findByIdAndUpdate(
      id,
      { categoryName: categoryName, description ,categoryOffer:offer},
      { new: true, runValidators: true }
    );  

    if (!updatedCategory) {
      return res.status(404).json({ error: 'Category not found.' });
    }
    res.status(200).json({ message: 'Category updated successfully.', updatedCategory });

  } catch (error) {
    console.error('Error updating category:', error);
   res.status(500).json({ error: 'Internal server error.' });
  }

};





module.exports = {
  categoryinfo,
  addCategory,
  listCategory,
  unlistCategory,
  editCategory,
};

  
