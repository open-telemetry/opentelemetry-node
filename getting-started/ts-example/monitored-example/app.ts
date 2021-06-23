import * as express from 'express';
import axios from 'axios';

import { countAllRequests } from './monitoring';

const PORT: string = process.env.PORT || '8080';
const app = express();
app.use(countAllRequests());

app.get('/', (req, res) => {
  axios
    .get(`http://localhost:${PORT}/middle-tier`)
    .then(() => axios.get(`http://localhost:${PORT}/middle-tier`))
    .then((result) => {
      res.send(result.data);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send();
    });
});

app.get('/middle-tier', (req, res) => {
  axios
    .get(`http://localhost:${PORT}/backend`)
    .then(() => axios.get(`http://localhost:${PORT}/backend`))
    .then((result) => {
      res.send(result.data);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send();
    });
});

app.get('/backend', (req, res) => {
  res.send('Hello from the backend');
});

app.listen(parseInt(PORT, 10), () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
