
function generateOrderId() {
    const prefix = 'ARM';
    const date = new Date();
    const dateStr = date.getFullYear() +
        String(date.getMonth() + 1).padStart(2, '0') +
        String(date.getDate()).padStart(2, '0');
    const randomNum = Math.floor(1000 + Math.random() * 9000); 
    
    return `${prefix}-${dateStr}-${randomNum}`;
}

module.exports={
    generateOrderId
}