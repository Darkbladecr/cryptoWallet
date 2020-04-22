const axios = require('axios');

module.exports = (req, res) => {
  axios
    .get('https://api.binance.com/api/v3/ticker/price')
    .then(({ data }) => {
      if (Object.prototype.hasOwnProperty.call(req.query, 'symbols')) {
        const symbols = req.query.symbols.split(',');
        const rates = {};
        for (const x of data) {
          if (symbols.includes(x.symbol)) {
            const symbol = x.symbol.substring(0, x.symbol.length - 3);
            rates[symbol] = parseFloat(x.price);
          }
        }
        return res.json(rates);
      }
      return res.json(data);
    })
    .catch((err) => console.error(err));
};
