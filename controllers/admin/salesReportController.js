const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/ProductSchema');
const Category = require('../../models/categorySchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment');

// Get sales report data based on date range
const getSalesReport = async (req, res) => {
    try {
        const data = await getReportData(req.query);
        res.json({ success: true, data});
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating sales report'
        });
    }
};

// Generate and download PDF 
const downloadPDF = async (req, res) => {
    try {
        const { orders, summary } = await getReportData(req.query);
        const doc = new PDFDocument();

       
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');

        doc.pipe(res);

     
        doc.fontSize(20).text('Sales Report', { align: 'center' });
        doc.moveDown();

       
        const period = getReportPeriod(req.query);
        doc.fontSize(12).text(`Report Period: ${period}`, { align: 'center' });
        doc.moveDown();

        // Add summary 
        doc.fontSize(16).text('Summary', { underline: true });
        doc.moveDown();
        doc.fontSize(12)
            .text(`Total Orders: ${summary.totalOrders}`)
            .text(`Total Amount: $${summary.totalAmount.toFixed(2)}`)
            .text(`Total Discount: $${summary.totalDiscount.toFixed(2)}`)
            .text(`Total Returns: ${summary.totalReturns}`)
            .text(`Total Products: ${summary.totalProducts}`)
            .text(`Total Categories: ${summary.totalCategories}`)
            .text(`Total Users: ${summary.totalUsers}`);
        
        doc.moveDown();

      
        doc.fontSize(16).text('Order Details', { underline: true });
        doc.moveDown();

        // Table headers
        const startX = 50;
        const columnWidth = 80;
        let currentY = doc.y;

        const headers = ['Order ID', 'Date', 'Customer', 'Amount', 'Discount', 'Status'];
        headers.forEach((header, i) => {
            doc.text(header, startX + (i * columnWidth), currentY);
        });

        currentY += 20;
        doc.moveTo(50, currentY).lineTo(610, currentY).stroke();
        currentY += 10;

        // Table rows
        orders.forEach(order => {
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
                
                // Add headers to new page
                headers.forEach((header, i) => {
                    doc.text(header, startX + (i * columnWidth), currentY);
                });
                currentY += 20;
                doc.moveTo(50, currentY).lineTo(610, currentY).stroke();
                currentY += 10;
            }

            doc.fontSize(10);
            doc.text(order.orderId.slice(-6), startX, currentY);
            doc.text(moment(order.createdAt).format('DD/MM/YYYY'), startX + columnWidth, currentY);
            doc.text(order.userId?.name || 'N/A', startX + (columnWidth * 2), currentY);
            doc.text(`$${order.finalAmount.toFixed(2)}`, startX + (columnWidth * 3), currentY);
            doc.text(`$${(order.discountAmount || 0).toFixed(2)}`, startX + (columnWidth * 4), currentY);
            doc.text(order.status, startX + (columnWidth * 5), currentY);

            currentY += 20;
        });

        // Add footer
        doc.fontSize(10)
            .text(
                `Generated on ${moment().format('MMMM Do YYYY, h:mm:ss a')}`,
                50,
                doc.page.height - 50,
                { align: 'center' }
            );

        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating PDF report'
        });
    }
};

// Generate and download Excel 
const downloadExcel = async (req, res) => {
    try {
        const { orders, summary } = await getReportData(req.query);
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Add title
        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = 'Sales Report';
        worksheet.getCell('A1').font = { size: 16, bold: true };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        // Add report period
        const period = getReportPeriod(req.query);
        worksheet.mergeCells('A2:G2');
        worksheet.getCell('A2').value = `Report Period: ${period}`;
        worksheet.getCell('A2').alignment = { horizontal: 'center' };

        // Add empty row
        worksheet.addRow([]);

        // Add summary section
        worksheet.addRow(['Summary']);
        worksheet.addRow(['Total Orders', summary.totalOrders]);
        worksheet.addRow(['Total Amount', `$${summary.totalAmount.toFixed(2)}`]);
        worksheet.addRow(['Total Discount', `$${summary.totalDiscount.toFixed(2)}`]);
        worksheet.addRow(['Total Returns', summary.totalReturns]);
        worksheet.addRow(['Total Products', summary.totalProducts]);
        worksheet.addRow(['Total Categories', summary.totalCategories]);
        worksheet.addRow(['Total Users', summary.totalUsers]);

        // Add empty row
        worksheet.addRow([]);

        // Add orders table
        worksheet.addRow(['Order Details']);
        const headers = ['Order ID', 'Date', 'Customer', 'Amount', 'Discount', 'Status'];
        worksheet.addRow(headers);

        // Style header row
        const headerRow = worksheet.lastRow;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
        });

        // Add order data
        orders.forEach(order => {
            worksheet.addRow([
                order.orderId,
                moment(order.createdAt).format('DD/MM/YYYY'),
                order.userId?.name || 'N/A',
                order.finalAmount,
                order.discountAmount || 0,
                order.status
            ]);
        });

        // Format currency columns
        ['D', 'E'].forEach(col => {
            worksheet.getColumn(col).numFmt = '"$"#,##0.00';
        });

        // Set column widths
        worksheet.columns.forEach(column => {
            column.width = 15;
        });

        // Add footer
        worksheet.addRow([]);
        worksheet.mergeCells(`A${worksheet.rowCount}:G${worksheet.rowCount}`);
        worksheet.getCell(`A${worksheet.rowCount}`).value = `Generated on ${moment().format('MMMM Do YYYY, h:mm:ss a')}`;
        worksheet.getCell(`A${worksheet.rowCount}`).alignment = { horizontal: 'center' };

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating Excel report'
        });
    }
};

// Helper function to get report data
async function getReportData(params) {
    const { startDate, endDate, reportType } = params;
    let query = { status: 'Delivered' };
    let start, end;

    switch (reportType) {
        case 'daily':
            start = moment().startOf('day');
            end = moment().endOf('day');
            break;
        case 'weekly':
            start = moment().startOf('week');
            end = moment().endOf('week');
            break;
        case 'monthly':
            start = moment().startOf('month');
            end = moment().endOf('month');
            break;
        case 'yearly':
            start = moment().startOf('year');
            end = moment().endOf('year');
            break;
        case 'custom':
            start = moment(startDate).startOf('day');
            end = moment(endDate).endOf('day');
            break;
        default:
            start = moment().startOf('day');
            end = moment().endOf('day');
    }

    query.createdAt = {
        $gte: start.toDate(),
        $lte: end.toDate()
    };

    // Get orders data
    const orders = await Order.find(query)
        .populate('userId', 'name')
        .sort({ createdAt: -1 });
    
    // Get total counts
    const totalProducts = await Product.countDocuments({ isBlocked: false });
    const totalCategories = await Category.countDocuments({ isListed: true });
    const totalUsers = await User.countDocuments({ isBlocked: false });
    const totalReturns = await Order.countDocuments({ status: 'Returned' });

    const summary = {
        totalOrders: orders.length,
        totalAmount: 0,
        totalDiscount: 0,
        totalReturns,
        totalProducts,
        totalCategories,
        totalUsers
    };

    orders.forEach(order => {
        summary.totalAmount += order.finalAmount;
        summary.totalDiscount += order.discountAmount || 0;
    });

    return { orders, summary };
}

// Helper function to get report period string
function getReportPeriod(params) {
    const { startDate, endDate, reportType } = params;
    
    switch (reportType) {
        case 'daily':
            return moment().format('MMMM Do YYYY');
        case 'weekly':
            return `${moment().startOf('week').format('MMM Do')} - ${moment().endOf('week').format('MMM Do YYYY')}`;
        case 'monthly':
            return moment().format('MMMM YYYY');
        case 'yearly':
            return moment().format('YYYY');
        case 'custom':
            return `${moment(startDate).format('MMM Do')} - ${moment(endDate).format('MMM Do YYYY')}`;
        default:
            return moment().format('MMMM Do YYYY');
    }
}

module.exports = {
    getSalesReport,
    downloadPDF,
    downloadExcel
};
