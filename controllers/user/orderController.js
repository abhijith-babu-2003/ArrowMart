const PDFDocument = require('pdfkit');
const Order = require('../../models/orderSchema');
const fs = require('fs');
const path = require('path');

// Generate and download invoice
const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('userId')
            .populate({
                path: 'orderedItems.product',
                select: 'productName salePrice'
            });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status === 'delivered') {
         return res.status(403).json({ success: false, message: 'Invoice is only available for delivered orders.' });
     }

       
        const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            layout: 'portrait'
        });

        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');

        const invoiceName = `invoice-${order.orderId}.pdf`;

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${invoiceName}`);
        doc.pipe(res);

        // Add company logo/name with styling
        doc.fontSize(28).font('Helvetica-Bold').fillColor('#333333')
           .text('ArrowMart', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(16).font('Helvetica').fillColor('#666666')
           .text('Tax Invoice', { align: 'center' });
        
        // Add decorative line
        doc.moveDown(0.5);
        doc.lineWidth(1)
           .strokeColor('#CCCCCC')
           .moveTo(50, doc.y)
           .lineTo(545, doc.y)
           .stroke();
        doc.moveDown(1);

        // Create two-column layout with better spacing
        const leftColumn = 50;
        const rightColumn = 300;
        const startY = doc.y;
        
        // Left column - Order details with box
        doc.rect(leftColumn - 10, startY - 10, 230, 100)
           .lineWidth(0.5)
           .strokeColor('#EEEEEE')
           .stroke();
        
        doc.fillColor('#333333')
           .font('Helvetica-Bold')
           .fontSize(12)
           .text('Order Information', leftColumn, startY);
        doc.moveDown(0.5);
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#666666')
           .text(`Order ID: ${order.orderId}`)
           .moveDown(0.3)
           .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`)
           .moveDown(0.3)
           .text(`Payment Method: ${order.paymentMethod}`);

        // Right column - Customer details with box
        doc.rect(rightColumn - 10, startY - 10, 255, 160)
           .lineWidth(0.5)
           .strokeColor('#EEEEEE')
           .stroke();

        doc.fillColor('#333333')
           .font('Helvetica-Bold')
           .fontSize(12)
           .text('Bill To:', rightColumn, startY);
        doc.moveDown(0.5);
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#666666')
           .text(order.userId.username)
           .moveDown(0.3)
           .text(order.userId.email)
           .moveDown(0.3)
           .text(order.userId.phone)
           .moveDown(0.3)
           .text(order.shippingAddress.name)
           .moveDown(0.3)
           .text(order.shippingAddress.landMark)
           .moveDown(0.3)
           .text(`${order.shippingAddress.city}, ${order.shippingAddress.state}`)
           .moveDown(0.3)
           .text(`PIN: ${order.shippingAddress.pincode}`);

        // Move down to clear both columns
        doc.moveDown(4);

        // Add items table with enhanced styling
        const tableTop = doc.y + 10;
        
        // Table header background
        doc.rect(50, tableTop - 5, 495, 25)
           .fillColor('#F8F9FA')
           .fill();
        
        // Table headers
        doc.fillColor('#333333')
           .font('Helvetica-Bold')
           .fontSize(10);
        
        const columnPositions = {
            product: 70,
            quantity: 280,
            price: 380,
            total: 480
        };

        doc.text('Product', columnPositions.product, tableTop);
        doc.text('Qty', columnPositions.quantity, tableTop, { width: 50, align: 'center' });
        doc.text('Price', columnPositions.price, tableTop, { width: 70, align: 'right' });
        doc.text('Total', columnPositions.total, tableTop, { width: 65, align: 'right' });

        // Table content
        let tableY = tableTop + 30;
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#666666');

        order.orderedItems.forEach((item, i) => {
            const y = tableY + (i * 25);
            
            // Alternate row background
            if (i % 2 === 0) {
                doc.rect(50, y - 5, 495, 25)
                   .fillColor('#FAFAFA')
                   .fill();
            }
            
            doc.fillColor('#666666')
               .text(item.product.productName, columnPositions.product, y, { width: 200 })
               .text(item.quantity.toString(), columnPositions.quantity, y, { width: 50, align: 'center' })
               .text(`₹${item.price.toFixed(2)}`, columnPositions.price, y, { width: 70, align: 'right' })
               .text(`₹${(item.quantity * item.price).toFixed(2)}`, columnPositions.total, y, { width: 65, align: 'right' });
        });

        // Summary section with box
        const summaryTop = tableY + (order.orderedItems.length * 25) + 20;
        
        // Summary box
        doc.rect(300, summaryTop - 5, 245, order.discountAmount > 0 ? 125 : 95)
           .lineWidth(0.5)
           .strokeColor('#EEEEEE')
           .stroke();

        let currentY = summaryTop;
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#666666');

        // Summary items
        const addSummaryLine = (label, value, isBold = false) => {
            if (isBold) doc.font('Helvetica-Bold').fillColor('#333333');
            doc.text(label, 320, currentY, { width: 100, align: 'right' });
            doc.text(value, 440, currentY, { width: 85, align: 'right' });
            if (isBold) doc.font('Helvetica').fillColor('#666666');
            currentY += 25;
        };

        addSummaryLine('Subtotal:', `₹${order.totalPrice.toFixed(2)}`);
        addSummaryLine('GST (5%):', `₹${order.tax.toFixed(2)}`);
        if (order.discountAmount > 0) {
            addSummaryLine('Discount:', `-₹${order.discountAmount.toFixed(2)}`);
        }
        addSummaryLine('Final Amount:', `₹${order.finalAmount.toFixed(2)}`, true);

        // Footer
        doc.fontSize(10)
           .fillColor('#666666')
           .text('Thank you for shopping with ArrowMart!', 50, doc.page.height - 100, {
               width: 495,
               align: 'center'
           });

        doc.fontSize(8)
           .fillColor('#999999')
           .font('Helvetica-Oblique')
           .text(
               'This is a computer-generated invoice and does not require a signature.',
               50,
               doc.page.height - 70,
               {
                   width: 495,
                   align: 'center'
               }
           );

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Invoice generation error:', error);
        res.status(500).json({ success: false, message: 'Error generating invoice' });
    }
};



module.exports = {
    downloadInvoice,
   
};

