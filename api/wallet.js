const ccxt = require('ccxt');
const axios = require('axios');

function getEthWalletBalance(address) {
  if (address) {
    return axios
      .get(
        `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${process.env.ethscan_api}`
      )
      .then(({ data }) => {
        const balance = parseInt(data.result);
        return balance / 10 ** 18;
      })
      .catch((err) => console.error(err));
  }
  throw new Error('No address given');
}

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
const gemini = new ccxt.gemini({
  apiKey: process.env.gemini_api,
  secret: process.env.gemini_secret,
  enableRateLimit: true,
});
const kraken = new ccxt.kraken({
  apiKey: process.env.kraken_api,
  secret: process.env.kraken_secret,
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
  let bitmexScalpWallet;
  let bitmexHoldWallet;
  let coinbaseWallet;
  let binanceWallet;
  let geminiWallet;
  let krakenWallet;
  let btcUsd;
  let btcGbp;
  let btcEur;
  let coldEthWalletBalance;

  try {
    const result = await Promise.all([
      bitmexScalp.fetchBalance(),
      bitmexHold.fetchBalance(),
    ]);
    bitmexScalpWallet = result[0];
    bitmexHoldWallet = result[1];
  } catch (e) {
    console.error(e);
    throw new Error(`Bitmex init error: ${e.toString()}`);
  }

  try {
    const result = await Promise.all([
      coinbase.fetchBalance(),
      coinbase.fetchTicker('BTC/USD'),
      coinbase.fetchTicker('BTC/GBP'),
      coinbase.fetchTicker('BTC/EUR'),
    ]);
    coinbaseWallet = result[0];
    btcUsd = result[1];
    btcGbp = result[2];
    btcEur = result[3];
  } catch (e) {
    console.error(e);
    throw new Error(`Coinbase init error: ${e.toString()}`);
  }

  try {
    binanceWallet = await binance.fetchBalance();
  } catch (e) {
    console.error(e);
    throw new Error(`Binance init error: ${e.toString()}`);
  }

  try {
    geminiWallet = await gemini.fetchBalance();
  } catch (e) {
    console.error(e);
    throw new Error(`Gemini init error: ${e.toString()}`);
  }

  try {
    krakenWallet = await kraken.fetchBalance();
  } catch (e) {
    console.error(e);
    throw new Error(`Kraken init error: ${e.toString()}`);
  }

  try {
    coldEthWalletBalance = await getEthWalletBalance(
      '0xbc6d193e2829d7ae55fe81a1021ffedd38b42e70'
    );
  } catch (e) {
    console.error(e);
    throw new Error(`EthScan init error: ${e.toString()}`);
  }

  const wallet = {
    bitmexScalp: {
      BTC: bitmexScalpWallet.info[0].marginBalance / 10 ** 8,
    },
    bitmexHold: {
      BTC: bitmexHoldWallet.info[0].marginBalance / 10 ** 8,
    },
    coinbase: fetchActiveBal(coinbaseWallet),
    binance: fetchActiveBal(binanceWallet),
    gemini: fetchActiveBal(geminiWallet),
    kraken: fetchActiveBal(krakenWallet),
    coldStorage: {
      ETH: coldEthWalletBalance,
    },
  };

  // delete shitcoins
  delete wallet.binance.EON;

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
          console.log(e);
        }
      }
    }
  } catch (e) {
    console.error(e);
    throw new Error(`Error fetching Binance tickers ${e.toString()}`);
  }

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

  const output = {
    base: wallet,
    BTC: walletBtc,
  };
  return output;
};

module.exports = (req, res) => {
  cryptoWallet()
    .then((wallet) => {
      return res.json(wallet);
    })
    .catch((err) => res.status(500).json(err));
};
