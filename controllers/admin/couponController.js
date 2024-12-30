const Coupon = require("../../models/couponSchema");
const mongoose = require("mongoose");

const getCoupon = async (req, res) => {
  try {
    const findCoupons = await Coupon.find({});
    return res.render("coupon", { coupons: findCoupons });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return res.redirect("/pageError");
  }
};

const createCoupon = async (req, res) => {
  try {
    const data = {
      couponName: req.body.couponName,
      startDate: req.body.startDate + "T00:00:00",
      endDate: req.body.endDate + "T23:59:59",
      offerPrice: parseInt(req.body.offerPrice),
      minimumPrice: parseInt(req.body.minimumPrice),
    };

    const newCoupon = new Coupon({
      name: data.couponName,
      createdOn: data.startDate,
      expireOn: data.endDate,
      offerPrice: data.offerPrice,
      minimumPrice: data.minimumPrice,
      isList: true,
    });

 
    await newCoupon.save();
    console.log("Coupon saved successfully!");
    return res.redirect("/admin/coupon");
  } catch (error) {
    res.redirect("/pageError");
  }
};

const getEditCoupon = async (req, res) => {
  try {
    const id = req.query.id;
    const findCoupon = await Coupon.findById(id);
    res.render("editCoupon", { coupon: findCoupon });
  } catch (error) {
    res.redirect("/pageError");
  }
};

const updateCoupon = async (req, res) => {
  try {
    couponId = req.body.couponId;
    const oid = new mongoose.Types.ObjectId(couponId);
    const selectedCoupon = await Coupon.findById({ _id: oid });
    if (selectedCoupon) {
      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);
      const updatedCoupon = await Coupon.findByIdAndUpdate(
        { _id: oid },

        {
          $set: {
            name: req.body.couponName,
            createdOn: startDate,
            expireOn: endDate,
            offerPrice: req.body.offerPrice,
            minimumPrice: req.body.minimumPrice,
          },
        },{new:true}
      );
      if(updatedCoupon!==null){
        return res.send("Coupon updated successfully!");
      }else{
        return res.send("Coupon not updated!");
      }
    }
  } catch (error) {
    res.redirect("/pageError");
  }
};


const deleteCoupon = async (req, res) => {
  try {
    const id = req.query.id;
    await Coupon.findByIdAndDelete(id);
    res.status(200).send({ success:true,message:"Coupon deleted successfully!"});
  } catch (error) {
    console.error("error deleting coupon:", error);
    res.status(500).send({ success:false,message:"Coupon not deleted!"});
  }
};
module.exports = {
  getCoupon,
  createCoupon,
  getEditCoupon,
  updateCoupon,
  deleteCoupon
};
