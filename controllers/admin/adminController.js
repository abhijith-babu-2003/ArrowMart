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
            const orders = await Order.countDocuments({ status: 'Delivered' });
            const totalProducts = await Product.countDocuments({ isBlocked: false });

            // Calculate total sales amount from delivered orders
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

            // Get most selling products from delivered orders
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const topProducts = await Order.aggregate([
                {
                    $match: {
                        status: 'Delivered',
                        createdAt: { $gte: thirtyDaysAgo }
                    }
                },
                {
                    $unwind: '$orderedItems'
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'orderedItems.product',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $unwind: '$product'
                },
                {
                    $group: {
                        _id: '$product._id',
                        name: { $first: '$product.productName' },
                        price: { $first: '$product.regularPrice' },
                        totalQuantitySold: { $sum: '$orderedItems.quantity' },
                        totalRevenue: { $sum: { $multiply: ['$orderedItems.quantity', '$orderedItems.price'] } }
                    }
                },
                {
                    $sort: { totalRevenue: -1 }
                },
                {
                    $limit: 5
                }
            ]);

            const finalProducts = topProducts.map(product => ({
                name: product.name,
                price: product.price,
                totalQuantitySold: product.totalQuantitySold,
                totalRevenue: product.totalRevenue
            }));

            // Get category data with sales information
            const categoryData = await Order.aggregate([
                {
                    $match: {
                        status: 'Delivered'
                    }
                },
                {
                    $unwind: '$orderedItems'
                },
                {
                    $lookup: {
                        from: 'products',
                        localField: 'orderedItems.product',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $unwind: '$product'
                },
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'product.category',
                        foreignField: '_id',
                        as: 'category'
                    }
                },
                {
                    $unwind: '$category'
                },
                {
                    $group: {
                        _id: '$category._id',
                        name: { $first: '$category.categoryName' },
                        totalQuantity: { $sum: '$orderedItems.quantity' },
                        totalRevenue: { $sum: { $multiply: ['$orderedItems.quantity', '$orderedItems.price'] } },
                        orderCount: { $addToSet: '$_id' }
                    }
                },
                {
                    $project: {
                        name: 1,
                        totalQuantity: 1,
                        totalRevenue: 1,
                        orderCount: { $size: '$orderCount' }
                    }
                },
                {
                    $sort: { totalRevenue: -1 }
                }
            ]);

            const totalRevenue = categoryData.reduce((sum, cat) => sum + cat.totalRevenue, 0);
            const categoriesWithPercentage = categoryData.map(cat => ({
                ...cat,
                percentage: totalRevenue ? Math.round((cat.totalRevenue / totalRevenue) * 100) : 0
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
        let startDate, endDate, labels, groupBy;

        switch (filter) {
            case 'yearly':
                startDate = new Date(currentDate.getFullYear() - 4, 0, 1);
                endDate = new Date(currentDate.getFullYear(), 11, 31);
                labels = Array.from({ length: 5 }, (_, i) => 
                    (currentDate.getFullYear() - 4 + i).toString()
                );
                groupBy = { year: { $year: '$createdAt' } };
                break;

            case 'monthly':
                startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 11, 1);
                endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                labels = Array.from({ length: 12 }, (_, i) => {
                    const date = new Date(startDate);
                    date.setMonth(startDate.getMonth() + i);
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
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(currentDate);
                endDate.setHours(23, 59, 59, 999);
                labels = Array.from({ length: 7 }, (_, i) => {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    return date.toLocaleDateString('default', { weekday: 'short', day: 'numeric' });
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
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(currentDate);
                endDate.setHours(23, 59, 59, 999);
                labels = Array.from({ length: 30 }, (_, i) => {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    return date.toLocaleDateString('default', { day: 'numeric', month: 'short' });
                });
                groupBy = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
        }

        const result = await Order.aggregate([
            {
                $match: {
                    createdAt: { 
                        $gte: startDate,
                        $lte: endDate 
                    },
                    status: 'Delivered'
                }
            },
            {
                $group: {
                    _id: groupBy,
                    total: { $sum: '$totalPrice' }
                }
            },
            {
                $sort: { 
                    '_id.year': 1, 
                    '_id.month': 1, 
                    '_id.day': 1 
                }
            }
        ]);

        // Initialize data array with zeros
        const data = new Array(labels.length).fill(0);

        // Fill in the actual values
        result.forEach(item => {
            let index;
            switch (filter) {
                case 'yearly':
                    index = item._id.year - (currentDate.getFullYear() - 4);
                    break;
                case 'monthly':
                    const monthDiff = (item._id.year - startDate.getFullYear()) * 12 + (item._id.month - 1 - startDate.getMonth());
                    index = monthDiff;
                    break;
                case 'weekly':
                    const itemDate = new Date(item._id.year, item._id.month - 1, item._id.day);
                    index = Math.floor((itemDate - startDate) / (1000 * 60 * 60 * 24));
                    break;
                default: // daily
                    const date = new Date(item._id.year, item._id.month - 1, item._id.day);
                    index = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
            }
            if (index >= 0 && index < data.length) {
                data[index] = item.total;
            }
        });

        return { labels, data };
    } catch (error) {
        console.error('Error in getTotalSales:', error);
        return { labels: [], data: [] };
    }
}

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