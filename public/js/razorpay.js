async function initializeRazorpay(addressId) {
    try {
        // Create Razorpay order
        const response = await fetch('/create-razorpay-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ addressId })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message);
        }

        const options = {
            key: RAZORPAY_KEY_ID, 
            amount: data.order.amount,
            currency: data.order.currency,
            name: 'ArrowMart',
            description: 'Purchase from ArrowMart',
            order_id: data.order.id,
            handler: async function (response) {
                await handlePaymentSuccess(response, addressId);
            },
            prefill: {
                name: userDetails.name,
                email: userDetails.email,
                contact: userDetails.phone
            },
            theme: {
                color: '#3399cc'
            }
        };

        const rzp = new Razorpay(options);
        rzp.open();
        
    } catch (error) {
        console.error('Razorpay initialization failed:', error);
        alert('Payment initialization failed. Please try again.');
    }
}

async function handlePaymentSuccess(response, addressId) {
    try {
        // Verify payment
        const verifyResponse = await fetch('/verify-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
            })
        });

        const verifyData = await verifyResponse.json();
        if (!verifyData.success) {
            throw new Error(verifyData.message);
        }

        // Place order
        const orderResponse = await fetch('/place-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                addressId,
                paymentMethod: 'RAZORPAY',
                razorpayOrderId: response.razorpay_order_id
            })
        });

        const orderData = await orderResponse.json();
        if (!orderData.success) {
            throw new Error(orderData.message);
        }

        // Redirect to success page
        window.location.href = `/order-success?orderId=${orderData.orderId}`;
        
    } catch (error) {
        console.error('Payment verification failed:', error);
        alert('Payment verification failed. Please contact support if amount was deducted.');
    }
}
