const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const moment = require('moment');
const axios = require('axios');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';

fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorize(JSON.parse(content), writeRow);
});

function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err)
        return console.error(
          'Error while trying to retrieve access token',
          err
        );
      oAuth2Client.setCredentials(token);
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

const investment = 41922 + 43731.57 * 0.9;
const spreadsheetId = '1FiQt9m_KDVN9_Ga2bEqSVBgezUv0QP1No-IRRZHlNbw';
function writeRow(auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  axios
    .get('https://cryptowallet.now.sh/api/wallet')
    .then(({ data: wallet }) => {
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
        .get('https://cryptowallet.now.sh/api/binanceTickers', {
          params: { symbols: [...symbols].map((x) => x + 'BTC').join(',') },
        })
        .then(({ data }) => {
          if (Object.keys(data).length > 0) {
            const latestBtcPrices = data;
            const tableData = {};
            const exchanges = Object.keys(wallet.BTC);
            axios
              .get('https://api.pro.coinbase.com/products/BTC-GBP/ticker')
              .then(({ data: { price: btcGbp } }) => {
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
                let totalValue = 0;
                for (const ex in tableData) {
                  for (const x of tableData[ex]) {
                    totalValue += x.gbpTotal;
                  }
                }
                const date = moment().format('MM/DD/YYYY');
                sheets.spreadsheets.values.append(
                  {
                    spreadsheetId,
                    range: 'Sheet1!A1:C1',
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    //   [date, total value, initial investment, ROI]
                    resource: {
                      values: [
                        [
                          date,
                          Math.round(totalValue * 100) / 100,
                          Math.round(investment * 100) / 100,
                          `${
                            Math.round((totalValue / investment - 1) * 10000) /
                            100
                          }%`,
                        ],
                      ],
                    },
                  },
                  (err) => {
                    if (err)
                      return console.log('The API returned an error: ' + err);
                    console.log(`${moment().format()}: Appended row`);
                  }
                );
              })
              .catch((err) => console.log(`Coinbase Error: ${err}`));
          }
        })
        .catch(() => console.log('Unable to fetch wallet data.'));
    })
    .catch((err) => console.log(err));
}
