const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');

const walletController = {
    getWallet: async (req, res) => {
        try {
            const user = req.session.user;
            const page = parseInt(req.query.page) || 1;
            const limit = 6; 
            
            let wallet = await Wallet.findOne({ userId: user });

            if (!wallet) {
                wallet = await new Wallet({ userId: user, balance: 0, transactions: [] }).save();
            }

            
            const reversedTransactions = [...wallet.transactions].reverse();

            // Calculate pagination
            const totalTransactions = reversedTransactions.length;
            const totalPages = Math.ceil(totalTransactions / limit);
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;

            // Get paginated transactions (already in reverse order)
            const paginatedTransactions = reversedTransactions.slice(startIndex, endIndex);

            res.render('wallet', { 
                wallet, 
                user,
                transactions: paginatedTransactions,
                currentPage: page,
                totalPages,
                hasNextPage: endIndex < totalTransactions,
                hasPrevPage: page > 1
            });
        } catch (error) {
            console.error('Error fetching wallet:', error);
            res.render('pageNotFound');
        }
    },

    addMoney: async (req, res) => {
        try {
            const { amount } = req.body;
            const user = req.session.user;

            if (amount <= 0) {
                return res.status(400).send('Amount must be greater than zero.');
            }

            let wallet = await Wallet.findOne({ userId: user });

            if (!wallet) {
                wallet = await new Wallet({ userId: user, balance: 0, transactions: [] }).save();
            }

            wallet.balance += parseFloat(amount);
            wallet.transactions.push({
                type: 'credit',
                amount: parseFloat(amount),
                date: new Date(),
                description: 'Added money to wallet'
            });

            await wallet.save();

            res.redirect('/wallet');
        } catch (error) {
            console.error('Error adding money:', error);
            res.status(500).send('Error adding money to wallet.');
        }
    }
};

module.exports = walletController;
