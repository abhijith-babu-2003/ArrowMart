const User = require("../../models/userSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt");
const status_codes = require("../../config/httpStatus");
const Order=require("../../models/orderSchema")
const Product=require("../../models/ProductSchema")
const Category=require("../../models/categorySchema")

const loadLogin = (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect("/admin/dashboard");
        }
        res.render("adminLogin", { message: null });
    } catch (error) {
        console.log(error.message);
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body
        const admin = await User.findOne({ email, isAdmin: true })
        if (!admin) {
            return res.status(status_codes.SUCCESS).render("adminLogin", { message: "admin not found" })
        }
        const passwordMatch = await bcrypt.compare(password, admin.password);
        
        if (!passwordMatch) {
            return res.render("adminLogin", { message: "invalid password" })
        }

        req.session.admin = true
        return res.redirect("/admin/dashboard")
    } catch (error) {
        console.log("login error:", error.message);
        return res.redirect("/pageError")
    }
}

const dashboard = async (req, res) => {
    try {
        if (req.session.admin) {
            const users = await User.countDocuments();
            const products = await Product.countDocuments();
            const orders = await Order.countDocuments();
            const totalProducts = await Product.countDocuments({ isBlocked: false });

            // Calculate total sales amount
            const totalSalesResult = await Order.aggregate([
                {
                    $match: {
                        status: 'Delivered' 
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$totalPrice' }
                    }
                }
            ]);

            const totalSalesAmount = totalSalesResult[0]?.totalAmount || 0;

            // Get most selling products
            const topProducts = await Order.aggregate([
                {
                    $match: {
                        status: 'Delivered'
                    }
                },
                {
                    $unwind: '$orderedItems'
                },
                {
                    $group: {
                        _id: '$orderedItems.product',
                        totalQuantitySold: { $sum: '$orderedItems.quantity' },
                        totalRevenue: { $sum: { $multiply: ['$orderedItems.quantity', '$orderedItems.price'] } }
                    }
                },
                {
                    $sort: { totalQuantitySold: -1 }
                },
                {
                    $limit: 5
                }
            ]);

            // Get product details
            const productIds = topProducts.map(p => p._id);
            const productDetails = await Product.find({ _id: { $in: productIds } }, 'productName regularPrice salePrice');
            
            const finalProducts = topProducts.map(product => {
                const details = productDetails.find(p => p._id.toString() === product._id.toString());
                return {
                    name: details?.productName || 'Unknown Product',
                    price: details?.salePrice || details?.regularPrice || 0,
                    totalQuantitySold: product.totalQuantitySold || 0,
                    totalRevenue: product.totalRevenue || 0
                };
            });

            // Get category data
            const categoryData = await Category.aggregate([
                {
                    $lookup: {
                        from: 'products',
                        localField: '_id',
                        foreignField: 'category',
                        as: 'products'
                    }
                },
                {
                    $project: {
                        name: 1,
                        productCount: { $size: '$products' }
                    }
                },
                {
                    $sort: { productCount: -1 }
                }
            ]);

            const totalProductCount = categoryData.reduce((sum, cat) => sum + cat.productCount, 0);
            const categoriesWithPercentage = categoryData.map(cat => ({
                ...cat,
                percentage: totalProductCount ? ((cat.productCount / totalProductCount) * 100).toFixed(1) : 0
            }));

            // Get initial sales data
            const initialSalesData = await getTotalSales('daily');
            // console.log('Initial Sales Data:', initialSalesData); // Debug log
            
            res.render("dashboard", {
                users,
                products,
                orders,
                categories: categoriesWithPercentage,
                totalProducts,
                products: finalProducts,
                salesData: {
                    ...initialSalesData,
                    totalSalesAmount
                }
            });
        } else {
            res.redirect('/admin');
        }
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.redirect("/admin/pageError");
    }
};

async function getTotalSales(filter = 'daily') {
    try {
        const currentDate = new Date();
        let startDate, labels, groupBy;

        switch (filter) {
            case 'yearly':
                startDate = new Date(currentDate.getFullYear() - 4, 0, 1);
                labels = Array.from({ length: 5 }, (_, i) => 
                    (currentDate.getFullYear() - 4 + i).toString()
                );
                groupBy = { year: { $year: '$createdAt' } };
                break;

            case 'monthly':
                startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 11, 1);
                labels = Array.from({ length: 12 }, (_, i) => {
                    const date = new Date(currentDate);
                    date.setMonth(currentDate.getMonth() - (11 - i));
                    return date.toLocaleString('default', { month: 'short' });
                });
                groupBy = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                };
                break;

            case 'weekly':
                startDate = new Date(currentDate);
                startDate.setDate(currentDate.getDate() - 6);
                labels = Array.from({ length: 7 }, (_, i) => {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    return date.toLocaleDateString('default', { weekday: 'short' });
                });
                groupBy = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
                break;

            default: // daily
                startDate = new Date(currentDate);
                startDate.setDate(currentDate.getDate() - 29);
                labels = Array.from({ length: 30 }, (_, i) => {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                });
                groupBy = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
        }

        // console.log('Filter:', filter); // Debug log
        // console.log('Start Date:', startDate); // Debug log

        const salesData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    status: { $ne: 'Cancelled' }
                }
            },
            {
                $group: {
                    _id: groupBy,
                    totalAmount: { $sum: '$totalPrice' }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        // console.log('Raw Sales Data:', salesData); // Debug log

        // Initialize data array with zeros
        const data = new Array(labels.length).fill(0);

        // Fill in the actual data
        salesData.forEach(sale => {
            let index;
            switch (filter) {
                case 'yearly':
                    index = sale._id.year - (currentDate.getFullYear() - 4);
                    break;
                case 'monthly':
                    const monthIndex = sale._id.month - 1;
                    const yearDiff = sale._id.year - currentDate.getFullYear();
                    index = monthIndex + (yearDiff * 12) + 11;
                    break;
                case 'weekly':
                case 'daily':
                    const saleDate = new Date(sale._id.year, sale._id.month - 1, sale._id.day);
                    index = Math.floor((saleDate - startDate) / (1000 * 60 * 60 * 24));
                    break;
            }
            if (index >= 0 && index < data.length) {
                data[index] = sale.totalAmount || 0;
            }
        });

        // console.log('Processed Data:', { labels, data }); // Debug log

        return {
            labels,
            data
        };
    } catch (error) {
        console.error('Error getting sales data:', error);
        return {
            labels: [],
            data: []
        };
    }
}

// async function getMostSellingProducts() {
//     try {
//         const result = await Order.aggregate([
//             {
//                 $match: {
//                     status: 'Delivered'
//                 }
//             },
//             { $unwind: "$orderedItems" },
//             {
//                 $lookup: {
//                     from: "products",
//                     localField: "orderedItems.product",
//                     foreignField: "_id",
//                     as: "productDetails"
//                 }
//             },
//             { $unwind: "$productDetails" },
//             {
//                 $group: {
//                     _id: "$orderedItems.product",
//                     productName: { $first: "$productDetails.productName" },
//                     totalQuantitySold: { $sum: "$orderedItems.quantity" }
//                 }
//             },
//             { $sort: { totalQuantitySold: -1 } },
//             { $limit: 10 }
//         ]);

//         // console.log("Products Sales Data:", result);
//         return result;
//     } catch (error) {
//         console.error("Error finding most selling products:", error);
//         return [];
//     }
// }

// async function getMostSellingCategories() {
//     try {
//         const result = await Order.aggregate([
//             { 
//                 $match: { 
//                     status: 'Delivered'
//                 } 
//             },
//             { $unwind: "$orderedItems" },
//             {
//                 $lookup: {
//                     from: "products",
//                     localField: "orderedItems.product",
//                     foreignField: "_id",
//                     as: "productDetails"
//                 }
//             },
//             { $unwind: "$productDetails" },
//             {
//                 $lookup: {
//                     from: "categories",
//                     localField: "productDetails.category",
//                     foreignField: "_id",
//                     as: "categoryDetails"
//                 }
//             },
//             { $unwind: "$categoryDetails" },
//             {
//                 $group: {
//                     _id: "$categoryDetails._id",
//                     categoryName: { $first: "$categoryDetails.categoryName" },
//                     totalQuantitySold: { $sum: "$orderedItems.quantity" }
//                 }
//             },
//             { $sort: { totalQuantitySold: -1 } },
//             { $limit: 5 }
//         ]);

//         // console.log("Categories Data:", result);
//         return result;
//     } catch (error) {
//         console.error("Error finding most selling category:", error);
//         return [];
//     }
// }

const pageerror = async (req, res) => {
    res.render("pageError")
}

const adminLogout = async (req, res) => {
    try {
        req.session.destroy(() => {
            res.redirect("/admin")
        })
    } catch (error) {
        console.log("error during logout", error);
        res.redirect("/pageError")
    }
}

const salesReport = async (req, res) => {
    if (req.session.admin) {
        try {
            res.render("salesReport")
        } catch (error) {
            res.redirect("pageError")
        }
    }
}

const getSalesData = async (req, res) => {
    try {
        const filter = req.query.filter || 'daily';
        const data = await getTotalSales(filter);
        res.json(data);
    } catch (error) {
        console.error('Error fetching sales data:', error);
        res.status(500).json({ error: 'Failed to fetch sales data' });
    }
};

module.exports = {
    loadLogin,
    login,
    dashboard,
    pageerror,
    adminLogout,
    salesReport,
    getTotalSales,
    getSalesData
};