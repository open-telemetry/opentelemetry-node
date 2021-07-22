import * as express from 'express';
import axios from 'axios';

const PORT: string = process.env.PORT || '8080';

const app = express();

app.get('/', (req, res) => {
  axios
    .get(`http://localhost:${PORT}/middle-tier`)
    .then(() => axios.get(`http://localhost:${PORT}/middle-tier`))
    .then((response) => {
      res.send(response.data);
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
    .then((response) => {
      res.send(response.data);
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
