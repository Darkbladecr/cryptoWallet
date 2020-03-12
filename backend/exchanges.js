const ccxt = require('ccxt');

const bitmexScalp = new ccxt.bitmex({
  apiKey: process.env.BITMEX_SCALP_API,
  secret: process.env.BITMEX_SCALP_SECRET,
  enableRateLimit: true,
});
const coinbase = new ccxt.coinbasepro({
  apiKey: process.env.COINBASE_API,
  secret: process.env.COINBASE_SECRET,
  password: process.env.COINBASE_PASSWORD,
  enableRateLimit: true,
});
const binance = new ccxt.binance({
  apiKey: process.env.BINANCE_API,
  secret: process.env.BINANCE_SECRET,
  enableRateLimit: true,
});
const bitmexHold = new ccxt.bitmex({
  apiKey: process.env.BITMEX_HOLD_API,
  secret: process.env.BITMEX_HOLD_SECRET,
  enableRateLimit: true,
});

const fetchActiveBal = wallet => {
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
    ] = await Promise.all([
      bitmexScalp.fetchBalance(),
      bitmexHold.fetchBalance(),
      coinbase.fetchBalance(),
      binance.fetchBalance(),
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
    symbols.delete('BTC');
    symbols.delete('EON');
    symbols.delete('GBP');
    symbols.delete('EUR');
    symbols.delete('USD');

    await binance.loadMarkets();
    const latestBtcPrices = {};
    for (const k of symbols) {
      const symbol = k + '/BTC';
      latestBtcPrices[k] = (await binance.fetchTicker(symbol)).last;
    }

    await coinbase.loadMarkets();
    const [btcUsd, btcGbp, btcEur] = await Promise.all([
      coinbase.fetchTicker('BTC/USD'),
      coinbase.fetchTicker('BTC/GBP'),
      coinbase.fetchTicker('BTC/EUR'),
    ]);
    latestBtcPrices['GBP'] = 1 / btcGbp.last;
    latestBtcPrices['EUR'] = 1 / btcEur.last;

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

module.exports = {
  cryptoWallet,
};
