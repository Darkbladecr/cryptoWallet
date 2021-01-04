import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Spinner } from '@blueprintjs/core';
import './App.css';
import useWindowDimensions from './windowDimensions';

const gbpFormatter = new Intl.NumberFormat('en-UK', {
  style: 'currency',
  currency: 'GBP',
});

const walletPcnt = 1;
// GBP + EUR (converted to GBP)
const investment = 42437.94 + (43731.57 - 12000) * 0.9;

function App() {
  const [btcGbp, setBtcGbp] = useState(0);
  const [walletGbpTotal, setWalletGbpTotal] = useState(0);
  const [wallet, setWallet] = useState();
  const [latestBtcPrices, setLatestBtcPrices] = useState({});
  const [percent, setPercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rowData, setRowData] = useState({});
  const { width } = useWindowDimensions();

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

  const getWallet = async () => {
    try {
      const { data: wallet } = await axios.get('/api/wallet');
      // setWallet((prev) => ({ ...prev, base: wallet }));
      const { data: walletBtc } = await axios.post('/api/walletBtc', {
        base: wallet,
      });
      // setWallet((prev) => ({ ...prev, BTC: walletBtc }));
      setWallet({ base: wallet, BTC: walletBtc });
    } catch (e) {
      throw e;
    }
  };

  useEffect(() => {
    getWallet()
      .then(() => {
        setInterval(() => {
          getWallet().catch(() =>
            console.error('Unable to fetch wallet data.')
          );
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

  const ExchangeRows = ({ name, data }) => {
    const symbolRows = data
      .filter((x) => x.gbpTotal > 0.1)
      .map((x) => {
        return (
          <tr key={x.symbol}>
            <td>{x.symbol}</td>
            <td>{x.holdings}</td>
            {width > 900 && <td>{x.gbpQuote}</td>}
            <td>{gbpFormatter.format(x.gbpTotal)}</td>
          </tr>
        );
      });
    const exchangeValue = data.reduce((a, b) => a + b.gbpTotal, 0);
    return (
      <React.Fragment>
        <tr>
          <td colSpan={width > 900 ? '3' : '2'}>
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
    if (wallet) {
      const tableData = {};
      const exchanges = Object.keys(wallet.base);
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
            gbpTotal: wallet?.BTC ? wallet.BTC[ex][k] * btcGbp : 0,
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
            <table className="bp3-html-table bp3-html-table-bordered bp3-html-table-condensed bp3-html-table-striped bp3-interactive">
              <thead>
                <tr>
                  <th>Exchange</th>
                  <th>Holdings</th>
                  {width > 900 && <th>GBP Quote</th>}
                  <th>GBP Total</th>
                </tr>
              </thead>
              <tbody>
                <ExchangeRows name="Bitmex Scalp" data={rowData.bitmexScalp} />
                <ExchangeRows name="Bitmex Hold" data={rowData.bitmexHold} />
                <ExchangeRows name="Coinbase" data={rowData.coinbase} />
                <ExchangeRows name="Binance" data={rowData.binance} />
                <ExchangeRows name="Kraken" data={rowData.kraken} />
                <ExchangeRows name="Gemini" data={rowData.gemini} />
                <ExchangeRows name="Cold Storage" data={rowData.coldStorage} />
              </tbody>
            </table>
          </>
        )}
      </header>
    </div>
  );
}

export default App;
