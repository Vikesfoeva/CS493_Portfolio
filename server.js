// Brandon Lenz
// CS 493 Portfolio Assignment

// https://console.cloud.google.com/datastore/entities;kind=Boats;ns=Boats/query/kind?project=lenzb-cs493-assignment3

// Imports the Google Cloud client library & create client
const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();

const express = require('express');
const app = express();

const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

app.get('/', async (req, res) => {
    res.send('Hello World');
});
