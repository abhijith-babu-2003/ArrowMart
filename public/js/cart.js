// Cart functionality
function addToCart(productId, quantity = 1) {
   
    showLoadingIndicator();

    fetch('/addToCart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            productId: productId,
            quantity: quantity
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoadingIndicator();
        
        if (data.success) {
            // Show success message
            showNotification('Success', 'Product added to cart!', 'success');
            
            // Update cart count in header
            updateCartCount(data.cartCount);
            
            // Optional: Show mini cart preview
            if (data.cartItem) {
                showMiniCartPreview(data.cartItem);
            }
        } else {
            showNotification('Error', data.message || 'Failed to add product to cart', 'error');
        }
    })
    .catch(error => {
        hideLoadingIndicator();
        showNotification('Error', 'Something went wrong. Please try again.', 'error');
        console.error('Error:', error);
    });
}

function updateCartCount(count) {
    const cartCountElements = document.querySelectorAll('.cart-count');
    cartCountElements.forEach(element => {
        element.textContent = count;
    });
}

function showLoadingIndicator() {
    // Create or show loading spinner
    const spinner = document.getElementById('loading-spinner') || createLoadingSpinner();
    spinner.style.display = 'flex';
}

function hideLoadingIndicator() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
}

function createLoadingSpinner() {
    const spinner = document.createElement('div');
    spinner.id = 'loading-spinner';
    spinner.className = 'loading-spinner';
    spinner.innerHTML = `
        <div class="spinner-overlay"></div>
        <div class="spinner-content">
            <div class="spinner"></div>
        </div>
    `;
    document.body.appendChild(spinner);
    return spinner;
}

function showNotification(title, message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function showMiniCartPreview(cartItem) {
    const preview = document.createElement('div');
    preview.className = 'mini-cart-preview';
    preview.innerHTML = `
        <div class="mini-cart-item">
            <img src="/uploads/${cartItem.image}" alt="${cartItem.name}">
            <div class="mini-cart-details">
                <h4>${cartItem.name}</h4>
                <p>Price: ₹${cartItem.price}</p>
                <p>Quantity: ${cartItem.quantity}</p>
            </div>
        </div>
        <div class="mini-cart-actions">
            <button onclick="window.location.href='/cart'">View Cart</button>
            <button onclick="window.location.href='/checkout'">Checkout</button>
        </div>
    `;
    
    document.body.appendChild(preview);
    
    // Animate in
    setTimeout(() => {
        preview.classList.add('show');
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        preview.classList.remove('show');
        setTimeout(() => {
            preview.remove();
        }, 300);
    }, 5000);
}


// Remove item from cart
async function removeItem(productId) {
    try {
     
        const confirmation = await Swal.fire({
            title: 'Are you sure?',
            text: 'Do you really want to remove this item from the cart?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, remove it!',
            cancelButtonText: 'Cancel'
        });

        if (!confirmation.isConfirmed) {
          
            return;
        }

  
        const response = await fetch('/removeitem', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productId })
        });

        const data = await response.json();

        if (data.success) {
          
            const row = document.querySelector(`button[onclick="removeItem('${productId}')"]`).closest('tr');
            if (row) {
                row.remove();
                
               
                const updateCartTotals = window.updateCartTotals;
                if (typeof updateCartTotals === 'function') {
                    updateCartTotals();
                }
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Item removed from cart'
                });
            }
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error removing item:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Failed to remove item'
        });
    }
}


// Add CSS styles for the loading spinner and notifications
const style = document.createElement('style');
style.textContent = `
    .loading-spinner {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
    }
    
    .spinner-overlay {
        position: absolute;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
    }
    
    .spinner-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
    
    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        border-radius: 4px;
        transform: translateX(120%);
        transition: transform 0.3s ease;
        z-index: 9999;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification-success {
        border-left: 4px solid #2ecc71;
    }
    
    .notification-error {
        border-left: 4px solid #e74c3c;
    }
    
    .notification h4 {
        margin: 0 0 5px;
        color: #333;
    }
    
    .notification p {
        margin: 0;
        color: #666;
    }
    
    .mini-cart-preview {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        border-radius: 4px;
        padding: 15px;
        transform: translateX(120%);
        transition: transform 0.3s ease;
        z-index: 9998;
        width: 300px;
    }
    
    .mini-cart-preview.show {
        transform: translateX(0);
    }
    
    .mini-cart-item {
        display: flex;
        align-items: center;
        margin-bottom: 15px;
    }
    
    .mini-cart-item img {
        width: 60px;
        height: 60px;
        object-fit: cover;
        margin-right: 15px;
        border-radius: 4px;
    }
    
    .mini-cart-details h4 {
        margin: 0 0 5px;
        font-size: 14px;
        color: #333;
    }
    
    .mini-cart-details p {
        margin: 0;
        font-size: 12px;
        color: #666;
    }
    
    .mini-cart-actions {
        display: flex;
        gap: 10px;
    }
    
    .mini-cart-actions button {
        flex: 1;
        padding: 8px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.3s;
    }
    
    .mini-cart-actions button:first-child {
        background: #f8f9fa;
        color: #333;
    }
    
    .mini-cart-actions button:last-child {
        background: #007bff;
        color: white;
    }
    
    .mini-cart-actions button:hover {
        opacity: 0.9;
    }
`;

document.head.appendChild(style);
