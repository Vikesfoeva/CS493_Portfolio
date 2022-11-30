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

// Authenticate via Auth0
// See the method I used in assignment 7
// You must have a User entity in your database which stores at least the unique user ID of each user of your application.
// The first time someone logs in and generates a JWT in your app they must be added as a user in the User entity of your database.

// GET All Pilots
// You must provide an unprotected endpoint GET /users that returns all the users currently registered in the app, even 
// if they don't currently have any relationship with a non-user entity. The response does not need to be paginated.


// All protected
// GET All Planes
// The collection URL for an entity must implement pagination showing 5 entities at a time
// At a minimum it must have a 'next' link on every page except the last
// The collection must include a property that indicates how many total items are in the collection

// GET One Plane

// POST a Plane

// PUT a Plane

// Patch a Plane

// DELETE a Plane


// All protected
// GET All Ticket
// The collection URL for an entity must implement pagination showing 5 entities at a time
// At a minimum it must have a 'next' link on every page except the last
// The collection must include a property that indicates how many total items are in the collection

// GET One Ticket

// POST a Ticket

// PUT a Ticket

// Patch a Ticket

// DELETE a Ticket



// PUT Passenger onto a plane

// DELETE Passenger from a Plane