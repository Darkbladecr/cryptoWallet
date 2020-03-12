import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const gbpFormatter = new Intl.NumberFormat('en-UK', {
  style: 'currency',
  currency: 'GBP',
});

function App() {
  const [btcGbp, setBtcGbp] = useState(0);
  const [walletGbpTotal, setWalletGbpTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ base: {}, BTC: {} });
  const [latestBtcPrices, setLatestBtcPrices] = useState({});
  const [rowData, setRowData] = useState({});

  useEffect(() => {
    const req = {
      type: 'subscribe',
      product_ids: ['BTC-GBP'],
      channels: ['ticker'],
    };
    const ws = new WebSocket('wss://ws-feed.pro.coinbase.com');
    ws.onopen = () => {
      ws.send(JSON.stringify(req));
    };
    ws.onmessage = ev => {
      const data = JSON.parse(ev.data);
      if (data.type === 'ticker' && data.product_id === 'BTC-GBP') {
        setBtcGbp(parseFloat(data.price));
      }
    };
    ws.onerror = ev => {
      const data = JSON.parse(ev.data);
      console.error(data);
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    axios
      .get('/api/wallet')
      .then(({ data }) => {
        setWallet(data);
        setLoading(false);
      })
      .catch(() => console.error('Unable to fetch wallet data.'));
  }, []);

  // const wallet = {
  //   base: {
  //     bitmexScalp: { BTC: 0.12241473 },
  //     bitmexHold: { BTC: 0.46466595 },
  //     coinbase: {
  //       BTC: 9.67863e-9,
  //       GBP: 8.72376956900635,
  //       EUR: 0.16710143448055,
  //       ETH: 52.06446293,
  //     },
  //     binance: {
  //       BTC: 1e-7,
  //       BNB: 7.76158721,
  //       EOS: 93.75,
  //       DOGE: 1651404,
  //     },
  //   },
  //   BTC: {
  //     bitmexScalp: { BTC: 0.11650731 },
  //     bitmexHold: { BTC: 0.50965795 },
  //     coinbase: {
  //       BTC: 9.67863e-9,
  //       GBP: 0.0013116478076990454,
  //       EUR: 0.000021689541665440073,
  //       ETH: 1.35200997336624,
  //     },
  //     binance: {
  //       BTC: 1e-7,
  //       BNB: 0.016906289260822,
  //       EOS: 0.03729375,
  //       DOGE: 0.42936504,
  //     },
  //   },
  // };

  useEffect(() => {
    const symbols = new Set();
    for (const k in wallet.base) {
      const symbolKeys = Object.keys(wallet.base[k]);
      symbolKeys.forEach(x => symbols.add(x));
    }
    symbols.delete('BTC');
    symbols.delete('EON');
    symbols.delete('GBP');
    symbols.delete('EUR');
    symbols.delete('USD');

    axios
      .get('/api/binanceTickers', {
        params: { symbols: [...symbols].map(x => x + 'BTC').join(',') },
      })
      .then(({ data }) => setLatestBtcPrices(data))
      .catch(err => console.error(err));

    const binanceTickers = [...symbols].map(
      x => x.toLowerCase() + 'btc@miniTicker'
    );

    const ws = new WebSocket('wss://stream.binance.com:9443/ws');

    ws.onopen = () => {
      const config = {
        method: 'SUBSCRIBE',
        params: binanceTickers,
        id: 1,
      };
      ws.send(JSON.stringify(config));
    };

    ws.onmessage = ({ data }) => {
      data = JSON.parse(data);
      if (data.hasOwnProperty('c')) {
        const symbol = data.s.substring(0, data.s.length - 3);
        setLatestBtcPrices(prev => ({ ...prev, [symbol]: parseFloat(data.c) }));
      }
    };
  }, [wallet]);

  const ExchangeRows = ({ name, data }) => {
    const symbolRows = data
      .filter(x => x.gbpTotal > 0.1)
      .map(x => {
        return (
          <tr key={x.symbol}>
            <td>{x.symbol}</td>
            <td>{x.holdings}</td>
            <td>{x.gbpQuote}</td>
            <td>{gbpFormatter.format(x.gbpTotal)}</td>
          </tr>
        );
      });
    const exchangeValue = data.reduce((a, b) => a + b.gbpTotal, 0);
    return (
      <React.Fragment>
        <tr>
          <td colSpan="3">
            <b>{name}</b>
          </td>
          <td>
            <b>{gbpFormatter.format(exchangeValue)}</b>
          </td>
        </tr>
        {symbolRows}
      </React.Fragment>
    );
  };

  useEffect(() => {
    if (wallet && wallet.BTC) {
      const tableData = {};
      const exchanges = Object.keys(wallet.BTC);
      for (const ex of exchanges) {
        tableData[ex] = [];
        for (const k in wallet.base[ex]) {
          let quote = btcGbp;
          if (Object.keys(latestBtcPrices).includes(k)) {
            quote = latestBtcPrices[k];
          }
          const tmp = {
            symbol: k,
            holdings: wallet.base[ex][k],
            gbpQuote: quote,
            gbpTotal: wallet.BTC[ex][k] * btcGbp,
          };
          tableData[ex].push(tmp);
        }
      }
      setRowData(tableData);
      let total = 0;
      for (const ex in tableData) {
        for (const x of tableData[ex]) {
          total += x.gbpTotal;
        }
      }
      setWalletGbpTotal(total);
    }
  }, [btcGbp, wallet, latestBtcPrices]);

  return (
    <div className="App bp3-dark">
      <header className="App-header">
        <h1>{gbpFormatter.format(walletGbpTotal)}</h1>
        <table className="bp3-html-table bp3-html-table-bordered bp3-html-table-condensed bp3-html-table-striped bp3-interactive">
          <thead>
            <tr>
              <th>Exchange</th>
              <th>Holdings</th>
              <th>GBP Quote</th>
              <th>GBP Total</th>
            </tr>
          </thead>
          <tbody>
            {!loading && (
              <React.Fragment>
                <ExchangeRows name="Bitmex Scalp" data={rowData.bitmexScalp} />
                <ExchangeRows name="Bitmex Hold" data={rowData.bitmexHold} />
                <ExchangeRows name="Coinbase" data={rowData.coinbase} />
                <ExchangeRows name="Binance" data={rowData.binance} />
              </React.Fragment>
            )}
          </tbody>
        </table>
      </header>
    </div>
  );
}

export default App;
