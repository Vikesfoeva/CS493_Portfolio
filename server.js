// Brandon Lenz
// CS 493 Portfolio Assignment

// https://console.cloud.google.com/datastore/entities;kind=Boats;ns=Boats/query/kind?project=lenzb-cs493-assignment3

// Imports the Google Cloud client library & create client
const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();

const jwt_decode = require('jwt-decode');

const express = require('express');
const app = express();
const path = require('path');

const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const BASEURL = 'https://lenzb-cs493-portfolio.ue.r.appspot.com/';

const { auth, requiresAuth } = require('express-openid-connect');

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

// AUTH 0 Start
// const releaseURL = 'https://lenzb-cs493-assignment7.ue.r.appspot.com/';
const releaseURL = 'http://localhost:8080/';

const thisClientSecret = 'y0F6qLWTkdd6ihhbF_zM1r1qTHzpIPMzJ25I4fxLCtss03_iGts22fB-vdzGxLZu'
const thisClientID = 'Nq6qNkJA5CEVqGoevLBsbRuyx7o3ZACb';
const config = {
    authRequired: false,
    auth0Logout: true,
    secret: thisClientSecret,
    baseURL: releaseURL,
    clientID: thisClientID,
    issuerBaseURL: 'https://dev-ovs150jfxgfxrydj.us.auth0.com'
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));

// req.isAuthenticated is provided from the auth router
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, './index.html'));
});

app.get('/checkAuthentication', (req, res) => {
    res.send(
        {"value": req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out'}
    );
});

app.get('/profile', requiresAuth(), async (req, res) => {
    res.send({
        "profile": req.oidc.user,
        "jwt_Token": req.appSession.id_token
    });
});

// AUTH O END

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
app.post('/planes', async (req, res) => {
  const newKey = datastore.key('planes');
  const reqCap = req.body.capacity;
  const reqSerial = req.body.serialNumber;
  const reqType = req.body.type;
  const bearerToken = req.headers.authorization;

  const checkIsValid = await checkInvalidJWT(bearerToken);
  if (checkIsValid[0]) {
      const error = {"Error": "Missing or invalid JWT"};
      res.status(401);
      return res.send(error);
  }

  const reqOwner = checkIsValid[1];

  if (reqCap === undefined || reqSerial === undefined || reqType === undefined) {
      const error = {"Error":  "The request object is missing at least one of the required attributes"}
      res.status(400);
      return res.send(error);
  } else {
      const newEntry = {
          key: newKey,
          data: {
              capacity: reqCap,
              owner: reqType,
              serialNumber: reqSerial,
              type: reqOwner
          }
      }
      const response = await datastore.save(newEntry);
      const newId = parseInt(response[0]['mutationResults'][0]['key']['path'][0]['id']);
      const newEntryRes = {
          id: newId,
          capacity: reqCap,
          owner: reqType,
          serialNumber: reqSerial,
          type: reqOwner,
          self: BASEURL + 'planes/' + newId
      }
      res.status(201);
      return res.send(newEntryRes);
  }
});

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

async function checkInvalidJWT(inputJwt) {
  // Decode the JWT to check validity
  // https://www.npmjs.com/package/jwt-decode
  // Returns [isInvalid as true or false, owner name]
  try {
      const tokenComponent = inputJwt.split(" ")[1];
      const decoded = jwt_decode(tokenComponent);
      const out = [false, decoded.sub];
      console.log('Auth Success');
      return out;
  } catch (error) {
      out = [true, '']
      return out;
  }
}