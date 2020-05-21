const ccxt = require('ccxt');

const bitmexScalp = new ccxt.bitmex({
  apiKey: process.env.bitmex_scalp_api,
  secret: process.env.bitmex_scalp_secret,
  enableRateLimit: true,
});
const coinbase = new ccxt.coinbasepro({
  apiKey: process.env.coinbase_api,
  secret: process.env.coinbase_secret,
  password: process.env.coinbase_password,
  enableRateLimit: true,
});
const binance = new ccxt.binance({
  apiKey: process.env.binance_api,
  secret: process.env.binance_secret,
  enableRateLimit: true,
});
const bitmexHold = new ccxt.bitmex({
  apiKey: process.env.bitmex_hold_api,
  secret: process.env.bitmex_hold_secret,
  enableRateLimit: true,
});

const fetchActiveBal = (wallet) => {
  const output = {};
  for (const k in wallet.total) {
    const val = wallet.total[k];
    if (val > 0) {
      output[k] = val;
    }
  }
  return output;
};

const cryptoWallet = async () => {
  try {
    const [
      bitmexScalpWallet,
      bitmexHoldWallet,
      coinbaseWallet,
      binanceWallet,
      btcUsd,
      btcGbp,
      btcEur,
      // binanceMarkets,
      // coinbaseMarkets,
    ] = await Promise.all([
      bitmexScalp.fetchBalance(),
      bitmexHold.fetchBalance(),
      coinbase.fetchBalance(),
      binance.fetchBalance(),
      coinbase.fetchTicker('BTC/USD'),
      coinbase.fetchTicker('BTC/GBP'),
      coinbase.fetchTicker('BTC/EUR'),
      // binance.loadMarkets(),
      // coinbase.loadMarkets(),
    ]);

    const wallet = {
      bitmexScalp: {
        BTC: bitmexScalpWallet.info[0].marginBalance / 10 ** 8,
      },
      bitmexHold: {
        BTC: bitmexHoldWallet.info[0].marginBalance / 10 ** 8,
      },
      coinbase: fetchActiveBal(coinbaseWallet),
      binance: fetchActiveBal(binanceWallet),
    };

    // delete shitcoins
    delete wallet.binance.EON;

    const symbols = new Set([
      ...Object.keys(wallet.bitmexScalp),
      ...Object.keys(wallet.bitmexHold),
      ...Object.keys(wallet.coinbase),
      ...Object.keys(wallet.binance),
    ]);
    const removeSym = ['BTC', 'EON', 'GBP', 'EUR', 'USD', 'USDT', 'USDC'];
    removeSym.forEach((x) => symbols.delete(x));

    // await binance.loadMarkets();
    const latestBtcPrices = {};
    for (const k of symbols) {
      const symbol = k + '/BTC';
      latestBtcPrices[k] = (await binance.fetchTicker(symbol)).last;
    }

    // console.time('loadCoinbaseMarkets');
    // await coinbase.loadMarkets();
    // const [btcGbp, btcEur] = await Promise.all([
    //   coinbase.fetchTicker('BTC/GBP'),
    //   coinbase.fetchTicker('BTC/EUR'),
    // ]);
    latestBtcPrices['GBP'] = 1 / btcGbp.last;
    latestBtcPrices['EUR'] = 1 / btcEur.last;
    latestBtcPrices['USDC'] = 1 / btcUsd.last;
    // console.timeEnd('loadCoinbaseMarkets');

    const walletBtc = JSON.parse(JSON.stringify(wallet));
    for (const ex in walletBtc) {
      for (const k in walletBtc[ex]) {
        if (k !== 'BTC') {
          walletBtc[ex][k] = latestBtcPrices[k] * walletBtc[ex][k];
        }
      }
    }

    const output = {
      base: wallet,
      BTC: walletBtc,
    };
    return output;
  } catch (err) {
    throw err;
  }
};

module.exports = (req, res) => {
  cryptoWallet()
    .then((wallet) => {
      return res.json(wallet);
    })
    .catch((err) => res.status(500).json(err));
};
