const WebSocket = require('ws');

const wallet = {
  bitmexScalp: { BTC: 0.12241473 },
  bitmexHold: { BTC: 0.46466595 },
  coinbase: {
    BTC: 9.67863e-9,
    GBP: 8.72376956900635,
    EUR: 0.16710143448055,
    ETH: 52.06446293,
  },
  binance: {
    BTC: 1e-7,
    BNB: 7.76158721,
    EOS: 93.75,
    EON: 0.00001988,
    DOGE: 1651404,
  },
};

// delete shitcoins
delete wallet.binance.EON;

const symbols = new Set([
  ...Object.keys(wallet.bitmexScalp),
  ...Object.keys(wallet.bitmexHold),
  ...Object.keys(wallet.coinbase),
  ...Object.keys(wallet.binance),
]);
symbols.delete('BTC');
symbols.delete('EON');
symbols.delete('GBP');
symbols.delete('EUR');
symbols.delete('USD');

const binanceTickers = [...symbols].map(
  x => x.toLowerCase() + 'btc@miniTicker'
);

const ws = new WebSocket('wss://stream.binance.com:9443/ws');

ws.on('open', function open() {
  const config = {
    method: 'SUBSCRIBE',
    params: binanceTickers,
    id: 1,
  };
  ws.send(JSON.stringify(config));
});

const latestPrices = {};
ws.on('message', function incoming(data) {
  data = JSON.parse(data);
  if (data.hasOwnProperty('c')) {
    latestPrices[data.s] = parseFloat(data.c);
    console.log(latestPrices);
  }
});
// const res = [
//   {
//     e: '24hrMiniTicker',
//     E: 1583796360681,
//     s: 'EOSBTC',
//     c: '0.00038400',
//     o: '0.00037940',
//     h: '0.00039800',
//     l: '0.00037180',
//     v: '3585220.09000000',
//     q: '1381.10598092',
//   },
//   {
//     e: '24hrMiniTicker',
//     E: 1583796360557,
//     s: 'DOGEBTC',
//     c: '0.00000028',
//     o: '0.00000026',
//     h: '0.00000028',
//     l: '0.00000026',
//     v: '196729823.00000000',
//     q: '53.39242249',
//   },
//   {
//     e: '24hrMiniTicker',
//     E: 1583796361210,
//     s: 'BNBBTC',
//     c: '0.00208670',
//     o: '0.00216650',
//     h: '0.00218330',
//     l: '0.00204250',
//     v: '1610462.38000000',
//     q: '3404.99301551',
//   },
//   {
//     e: '24hrMiniTicker',
//     E: 1583796360622,
//     s: 'ETHBTC',
//     c: '0.02525000',
//     o: '0.02536600',
//     h: '0.02617200',
//     l: '0.02445800',
//     v: '364279.30500000',
//     q: '9244.77362528',
//   },
// ];
