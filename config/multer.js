const multer = require("multer");
const path=require('path')

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Define the folder where you want to store the files
    console.log(__dirname,"directoryname")
    cb(null, path.join(__dirname,"../public/uploads")); // 'uploads/' is the folder where files will be saved
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
},
});
const upload = multer({ storage: storage });

module.exports=upload
