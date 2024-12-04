const { log } = require('console')
const Product=require('../../models/ProductSchema')
const Category=require('../../models/categorySchema')
const path=require("path")
const sharp=require("sharp")


const getaddProducts= async(req,res)=>{

    try {
        const category=await Category.find({isListed:true})
        res.render("addProducts",{
            cat:category
        })

    } catch (error) {
        
     console.error(error);
     
    }

}

const getAllProduct=async(req,res)=>{
    console.log('req reached');
    
    try {
        const search=req.query.search || ""
        const page = parseInt(req.query.page) || 1;
        const limit=4

        const productData=await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}}
                
            ],

        }).limit(limit).skip((page-1)*limit).populate('category').exec()

        const count=await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}}
            ],
        }).countDocuments()

        const category=await Category.find({isListed:true})

        if(category){
           
            res.render("products",{
                data:productData,
                currentPage:page,
                totalPages: Math.ceil(count/limit),
                cat:category,
                search: search
            })
        }else{
            
            res.render("pageError", { message: "Category data not found." });
        }

    } catch (error) {
      
        console.error("Error in getAllProduct:", error);
        res.render("pageError", { message: "Failed to load products." });
    }
}


const addProducts = async (req, res) => {
    try {
        const products = req.body;
        const productExists = await Product.findOne({
            productName: products.productName,
        });

        if (!productExists) {
            const images = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join(
                        "public",
                        "uploads",
                        "product-images",
                        req.files[i].filename
                    );
                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);
                    images.push(req.files[i].filename);
                }
            }

        
        
            
        const category=await Category.findOne({isListed:true, categoryName:products.category})
            if (!category) {
                return res.status(400).send("Invalid category name");
            }
            console.log(category._id);

            const newProduct = new Product({
                productName:products.productName ,
                description:products.description,
                category:category._id,
                regularPrice:products.regularPrice,
                salePrice:products.regularPrice,
                quantity:products.quantity,
                color:products.color,
                productImage: images,
                status: 'Available',
            });

            await newProduct.save();
            console.log("Product saved successfully");
            res.status(201).redirect("/admin/products");
        } else {
            res.status(400).json({ error: 'Product already exists' });
        }
    } catch (error) {
        console.error("Error in saving products", error);
        res.status(500).json({ error: "An error occurred while saving the product" });
    }
};


module.exports={
    addProducts,
    getAllProduct,
    getaddProducts
}