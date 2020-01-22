module.exports = function(db) {
    let data = []; // Všechny nabídky

    return {
        data,
        init: () => {
            console.log('Načítám trh..');
            db.loadMarket((result) => {
                data = result;
            });
        }
    }
};