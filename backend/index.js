require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { cryptoWallet } = require('./exchanges');

const app = express();
const port = 4000;
app.use('/api');
app.get('/', (req, res) => res.send('Hello World!'));
app.get('/wallet', (_, res) => {
  cryptoWallet()
    .then(wallet => res.json(wallet))
    .catch(err => res.status(500).json(err));
});
app.get('/binanceTickers', (req, res) => {
  axios
    .get('https://api.binance.com/api/v3/ticker/price')
    .then(({ data }) => {
      if (req.query.hasOwnProperty('symbols')) {
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
    .catch(err => console.error(err));
});

app.listen(port, () =>
  console.log(`Crypto Wallet Server listening on port ${port}!`)
);
