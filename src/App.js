import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Spinner } from '@blueprintjs/core';
import './App.css';

const gbpFormatter = new Intl.NumberFormat('en-UK', {
  style: 'currency',
  currency: 'GBP',
});

// Ali's investment
const walletPcnt = 1141 / 30151;
const investment = 1141;

function App() {
  const [btcGbp, setBtcGbp] = useState(0);
  const [walletGbpTotal, setWalletGbpTotal] = useState(0);
  const [wallet, setWallet] = useState();
  const [latestBtcPrices, setLatestBtcPrices] = useState({});
  const [percent, setPercent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get('https://api.pro.coinbase.com/products/BTC-GBP/ticker')
      .then(({ data: { price: btcGbp } }) => {
        setBtcGbp(btcGbp);
      });
    const ws = new WebSocket('wss://ws-feed.pro.coinbase.com');
    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          product_ids: ['BTC-GBP'],
          channels: ['ticker'],
        })
      );
    };
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type === 'ticker' && data.product_id === 'BTC-GBP') {
        setBtcGbp(parseFloat(data.price));
      }
    };
    ws.onerror = (ev) => {
      const data = JSON.parse(ev.data);
      console.error(data);
    };
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe' }));
        ws.close();
      }
    };
  }, []);

  useEffect(() => {
    axios
      .get('/api/wallet')
      .then(({ data }) => {
        setWallet(data);
        setInterval(() => {
          axios
            .get('/api/wallet')
            .then(({ data }) => {
              setWallet(data);
            })
            .catch(() => console.error('Unable to fetch wallet data.'));
        }, 1000 * 10);
      })
      .catch(() => console.error('Unable to fetch wallet data.'));
  }, []);

  useEffect(() => {
    if (wallet) {
      const symbols = new Set();
      for (const k in wallet.base) {
        const symbolKeys = Object.keys(wallet.base[k]);
        symbolKeys.forEach((x) => symbols.add(x));
      }
      symbols.delete('BTC');
      symbols.delete('EON');
      symbols.delete('GBP');
      symbols.delete('EUR');
      symbols.delete('USD');

      axios
        .get('/api/binanceTickers', {
          params: { symbols: [...symbols].map((x) => x + 'BTC').join(',') },
        })
        .then(({ data }) => {
          if (Object.keys(data).length > 0) {
            setLatestBtcPrices(data);
            setLoading(false);
          }
        })
        .catch((err) => console.error(err));

      const binanceTickers = [...symbols].map(
        (x) => x.toLowerCase() + 'btc@miniTicker'
      );

      const ws = new WebSocket('wss://stream.binance.com:9443/ws');

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            method: 'SUBSCRIBE',
            params: binanceTickers,
            id: 1,
          })
        );
      };

      ws.onmessage = ({ data }) => {
        data = JSON.parse(data);
        if (data.hasOwnProperty('c')) {
          const symbol = data.s.substring(0, data.s.length - 3);
          setLatestBtcPrices((prev) => ({
            ...prev,
            [symbol]: parseFloat(data.c),
          }));
        }
      };
      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              method: 'UNSUBSCRIBE',
              params: binanceTickers,
              id: 1,
            })
          );
          ws.close();
        }
      };
    }
  }, [wallet]);

  useEffect(() => {
    if (wallet) {
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
      let total = 0;
      for (const ex in tableData) {
        for (const x of tableData[ex]) {
          total += x.gbpTotal;
        }
      }
      setWalletGbpTotal(total * walletPcnt);
    }
  }, [btcGbp, wallet, latestBtcPrices]);

  useEffect(() => {
    setPercent(Math.round((walletGbpTotal / investment - 1) * 10000) / 100);
  }, [walletGbpTotal, setPercent]);

  return (
    <div className="App bp3-dark">
      <header className="App-header">
        {loading ? (
          <Spinner size={100} intent="warning" />
        ) : (
          <>
            <h1>
              {gbpFormatter.format(walletGbpTotal)}
              <span style={{ fontSize: 18, paddingLeft: 15 }}>
                {percent > 0 ? '+' : ''}
                {percent}%
              </span>
            </h1>
          </>
        )}
      </header>
    </div>
  );
}

export default App;
