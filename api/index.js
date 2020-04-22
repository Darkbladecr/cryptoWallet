const express = require('express');
const app = express();
const port = 3000;
const router = express.Router();

router.all('/', (_, res) => res.send('Hello World!'));
router.all('/wallet', require('./wallet'));
router.all('/binanceTickers', require('./binanceTickers'));

app.use('/api', router);

app.listen(port, () =>
  console.log(`cryptowallet-api listening at http://localhost:${port}`)
);
