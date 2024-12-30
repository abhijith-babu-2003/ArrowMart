const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');


const walletController = {
    getWallet: async (req, res) => {
        try {
            const user = req.session.user;
            let wallet = await Wallet.findOne({ userId: user });
            
            if (!wallet) {
                wallet = await new Wallet({ userId: user }).save();
            }

            res.render('wallet', { wallet, user: user });
        } catch (error) {
            console.error('Error fetching wallet:', error);
            res.render('pageNotFound');
        }
    }
};

module.exports = walletController;
