const ccxt = require('ccxt');

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

const cryptoWallet = async (wallet) => {
  let btcUsd;
  let btcGbp;
  let btcEur;

  console.time('coinbase');
  try {
    const result = await Promise.all([
      coinbase.fetchTicker('BTC/USD'),
      coinbase.fetchTicker('BTC/GBP'),
      coinbase.fetchTicker('BTC/EUR'),
    ]);
    btcUsd = result[0];
    btcGbp = result[1];
    btcEur = result[2];
  } catch (e) {
    console.error(e);
    throw new Error(`Coinbase init error: ${e.toString()}`);
  }
  console.timeEnd('coinbase');

  const symbols = new Set([
    ...Object.keys(wallet.bitmexScalp),
    ...Object.keys(wallet.bitmexHold),
    ...Object.keys(wallet.coinbase),
    ...Object.keys(wallet.binance),
    ...Object.keys(wallet.gemini),
    ...Object.keys(wallet.kraken),
    ...Object.keys(wallet.coldStorage),
  ]);
  const removeSym = ['BTC', 'EON', 'GBP', 'EUR', 'USD'];
  removeSym.forEach((x) => symbols.delete(x));

  // await binance.loadMarkets();
  console.time('binanceTickers');
  const latestBtcPrices = {};
  try {
    for (const symbol of symbols) {
      try {
        const ticker = await binance.fetchTicker(`${symbol}/BTC`);
        latestBtcPrices[symbol] = ticker.last;
      } catch (e) {
        try {
          const ticker = await binance.fetchTicker(`BTC/${symbol}`);
          latestBtcPrices[symbol] = ticker.last;
        } catch (e) {
          throw new Error(symbol);
        }
      }
    }
  } catch (e) {
    console.error(e);
    throw new Error(`Error fetching Binance tickers: ${e.toString()}`);
  }
  console.timeEnd('binanceTickers');

  latestBtcPrices['GBP'] = 1 / btcGbp.last;
  latestBtcPrices['EUR'] = 1 / btcEur.last;
  latestBtcPrices['USDC'] = 1 / btcUsd.last;
  latestBtcPrices['USDT'] = 1 / btcUsd.last;

  const walletBtc = JSON.parse(JSON.stringify(wallet));
  for (const ex in walletBtc) {
    for (const k in walletBtc[ex]) {
      if (k !== 'BTC') {
        walletBtc[ex][k] = latestBtcPrices[k] * walletBtc[ex][k];
      }
    }
  }

  return walletBtc;
};

module.exports = (req, res) => {
  cryptoWallet(req.body.base)
    .then((wallet) => {
      return res.json(wallet);
    })
    .catch((err) => res.status(500).json(err));
};
