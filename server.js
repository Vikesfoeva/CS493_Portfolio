// Brandon Lenz
// CS 493 Portfolio Assignment

// TO DO
// Need to remove planes from fares when a plane is deleted
// Run testing suite


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

const { auth } = require('express-openid-connect');
const { requiresAuth } = require('express-openid-connect');

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});

// AUTH 0 Start
// const releaseURL = 'https://lenzb-cs493-assignment7.ue.r.appspot.com/';
const releaseURL = 'http://localhost:8080';

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
    checkIfNewPilot(req.oidc.user);
    res.send({
        "profile": req.oidc.user,
        "jwt_Token": req.appSession.id_token
    });
});

async function checkIfNewPilot(thisUser) {
    let query = datastore.createQuery('pilots');

    const results = await datastore.runQuery(query);
    let isNewPilot = true;
    const thisSub = thisUser.sub;
    const thisName = thisUser.name;

    for (let i=0; i < results[0].length; i++) {
        const thisPilot = results[0][i].sub;
        if (thisPilot === thisSub) {
            isNewPilot = false;
            break;
        }
    }

    if (!isNewPilot) {
        return;
    }
  
    const newKey = datastore.key('pilots');
    const newEntry = {
        key: newKey,
        data: {
            sub: thisSub,
            name: thisName        }
    }
    await datastore.save(newEntry);

    return;
}

// AUTH O END

// Authenticate via Auth0
// See the method I used in assignment 7
// You must have a User entity in your database which stores at least the unique user ID of each user of your application.
// The first time someone logs in and generates a JWT in your app they must be added as a user in the User entity of your database.

// GET All Pilots
// You must provide an unprotected endpoint GET /users that returns all the users currently registered in the app, even 
// if they don't currently have any relationship with a non-user entity. The response does not need to be paginated.
app.get('/users', async (req, res) => {
    const accept = req.headers.accept;
    if (accept !== 'application/json') {
        res.status(406);
        return res.send({"Error" : "Invalid Conent Type - please specify 'application/json'"})
    }

    const kind = 'pilots';
    let query = datastore.createQuery(kind);
    const results = await datastore.runQuery(query);

    const outputUsers = [];
    results[0].forEach(thisUser => {
        outputUsers.push({
            id: parseInt(thisUser[Datastore.KEY]['id']),
            sub: thisUser.sub,
            name: thisUser.name
        })
    });

    res.status(200);
    res.send(outputUsers);
});


// All protected
// GET All Planes
// The collection URL for an entity must implement pagination showing 5 entities at a time
// At a minimum it must have a 'next' link on every page except the last
// The collection must include a property that indicates how many total items are in the collection
app.get('/planes', async (req, res) => {
    //https://cloud.google.com/datastore/docs/concepts/queries#cursors_limits_and_offsets
    const accept = req.headers.accept;
    const bearerToken = req.headers.authorization;
    if (accept !== 'application/json') {
        res.status(406);
        return res.send({"Error" : "Invalid Conent Type - please specify 'application/json'"})
    }
    const checkIsValid = await checkInvalidJWT(bearerToken);
    if (checkIsValid[0]) {
        const error = {"Error": "Missing or invalid JWT"};
        res.status(401);
        return res.send(error);
    }
    try {
        const kind = 'planes';
        const pageCursor = req.query.cursor;
        const thisJwtOwner = checkIsValid[1];
        let query = datastore.createQuery(kind).filter('owner', '=', thisJwtOwner).limit(5);
        if (pageCursor) {
            query = query.start(pageCursor)
        }

        const results = await datastore.runQuery(query);
        const allPlanes = results[0];
        const cursorInfo = results[1];

        const outputPlanes = [];
        allPlanes.forEach(thisPlane => {
            outputPlanes.push({
                id: thisPlane[Datastore.KEY]['id'],
                capacity: thisPlane.capacity,
                owner: thisPlane.owner,
                serialNumber: thisPlane.serialNumber,
                type: thisPlane.type,
                self: BASEURL + 'planes/' + thisPlane[Datastore.KEY]['id']
            })
        });
        
        const response = {planes: outputPlanes};
        if (cursorInfo.moreResults === 'NO_MORE_RESULTS') {
            response['next'] = null;
        } else {
            // https://stackoverflow.com/questions/67260882/using-datastores-pagination-example-causes-error-13-internal-request-messag
            // Answer by Ralemos solved the cursor containint URL protected characters
            response['next'] = BASEURL + 'planes/?cursor=' + encodeURIComponent(cursorInfo.endCursor)
        }

        res.status(200);
        res.send(response);
    } 
    catch (error) {
        console.log(error);
        res.status(404);
        res.send({"Error": "An error has occured, ensure you sent a valid cursor"})
    }
});

// GET One Plane
app.get('/planes/:plane_id', async (req, res) => {
    const accept = req.headers.accept;
    const bearerToken = req.headers.authorization;
    if (accept !== 'application/json') {
        res.status(406);
        return res.send({"Error" : "Invalid Conent Type - please specify 'application/json'"})
    }
    const checkIsValid = await checkInvalidJWT(bearerToken);
    if (checkIsValid[0]) {
        const error = {"Error": "Missing or invalid JWT"};
        res.status(401);
        return res.send(error);
    }
    
    try {
        const thisId = parseInt(req.params.plane_id);
        const dataKey = datastore.key(['planes', thisId])
        const [thisPlane] = await datastore.get(dataKey);
        const thisJwtOwner = checkIsValid[1];
        if (thisJwtOwner !== thisPlane.owner) {
            throw error();
        }
        const response = {
            id: thisId,
            capacity: thisPlane.capacity,
            owner: thisPlane.owner,
            serialNumber: thisPlane.serialNumber,
            type: thisPlane.type,
            self: BASEURL + 'planes/' + thisId
        }
        res.status(200);
        return res.send(response);
    }
    catch {
        const error = {"Error":  "No plane with this plane_id exists or it is owned by someone else"};
        res.status(404);
        return res.send(error);
    }
});

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
              owner: reqOwner,
              serialNumber: reqSerial,
              type: reqType
          }
      }
      const response = await datastore.save(newEntry);
      const newId = parseInt(response[0]['mutationResults'][0]['key']['path'][0]['id']);
      const newEntryRes = {
          id: newId,
          capacity: reqCap,
          owner: reqOwner,
          serialNumber: reqSerial,
          type: reqType,
          self: BASEURL + 'planes/' + newId
      }
      res.status(201);
      return res.send(newEntryRes);
  }
});

// PUT a Plane
app.put('/planes/:plane_id', async (req, res) => {
    const accept = req.headers.accept;
    const bearerToken = req.headers.authorization;
    const contentType = req.headers['content-type'];

    const checkIsValid = await checkInvalidJWT(bearerToken);
    if (checkIsValid[0]) {
        const error = {"Error": "Missing or invalid JWT"};
        res.status(401);
        return res.send(error);
    }
  
    const thisJwtOwner = checkIsValid[1];

    if (accept !== 'application/json') {
        res.status(406);
        return res.send({"Error" : "Invalid Conent Type"})
    }

    if (contentType !== 'application/json') {
        res.status(415);
        return res.send({"Error" : "Invalid Content-Type sent, must be application/json"});
    }

    let reqCap = req.body.capacity;
    let reqSerial = req.body.serialNumber;
    let reqType = req.body.type;

    if (reqCap === undefined && reqSerial === undefined && reqType === undefined) {
        const error = {"Error":  "The request object is missing at least one of the required attributes"}
        res.status(400);
        return res.send(error);
    } else {
        try {
            const thisId = parseInt(req.params.plane_id);
            const dataKey = datastore.key(['planes', thisId]);
            const [thisPlane] = await datastore.get(dataKey);
        
            if (reqCap === undefined) {reqCap = null};
            if (reqSerial === undefined) {reqSerial = null};
            if (reqType === undefined) {reqType = null};

            if (thisJwtOwner !== thisPlane.owner) {
                throw error();
            }

            const entry = {
                key: dataKey,
                data: {
                    capacity: reqCap,
                    owner: thisJwtOwner,
                    serialNumber: reqSerial,
                    type: reqType
                }
            }
            await datastore.update(entry);

            const responseEntry = {
                id: thisId,
                capacity: reqCap,
                owner: thisJwtOwner,
                serialNumber: reqSerial,
                type: reqType,
                self: BASEURL + 'planes/' + thisId
            }

            res.status(200);
            return res.send(responseEntry);
        }
        catch (error) {
            console.log(error);
            const errorMsg = {"Error":  "No plane with this plane_id exists or is not owned by this user"}
            res.status(404);
            return res.send(errorMsg);
        }
    }
});

// Patch a Plane
app.patch('/planes/:plane_id', async (req, res) => {
    const accept = req.headers.accept;
    const bearerToken = req.headers.authorization;
    const contentType = req.headers['content-type'];

    const checkIsValid = await checkInvalidJWT(bearerToken);
    if (checkIsValid[0]) {
        const error = {"Error": "Missing or invalid JWT"};
        res.status(401);
        return res.send(error);
    }
  
    const thisJwtOwner = checkIsValid[1];

    if (accept !== 'application/json') {
        res.status(406);
        return res.send({"Error" : "Invalid Conent Type"})
    }

    if (contentType !== 'application/json') {
        res.status(415);
        return res.send({"Error" : "Invalid Content-Type sent, must be application/json"});
    }

    let reqCap = req.body.capacity;
    let reqSerial = req.body.serialNumber;
    let reqType = req.body.type;

    if (reqCap === undefined && reqSerial === undefined && reqType === undefined) {
        const error = {"Error":  "The request object is missing at least one of the required attributes"}
        res.status(400);
        return res.send(error);
    } else {
        try {
            const thisId = parseInt(req.params.plane_id);
            const dataKey = datastore.key(['planes', thisId]);
            const [thisPlane] = await datastore.get(dataKey);
        
            if (reqCap === undefined) {reqCap = thisPlane.capacity};
            if (reqSerial === undefined) {reqSerial = thisPlane.serialNumber};
            if (reqType === undefined) {reqType = thisPlane.type};

            if (thisJwtOwner !== thisPlane.owner) {
                throw error();
            }

            const entry = {
                key: dataKey,
                data: {
                    capacity: reqCap,
                    owner: thisJwtOwner,
                    serialNumber: reqSerial,
                    type: reqType
                }
            }
            await datastore.update(entry);

            const responseEntry = {
                id: thisId,
                capacity: reqCap,
                owner: thisJwtOwner,
                serialNumber: reqSerial,
                type: reqType,
                self: BASEURL + 'planes/' + thisId
            }

            res.status(200);
            return res.send(responseEntry);
        }
        catch (error) {
            console.log(error);
            const errorMsg = {"Error":  "No plane with this plane_id exists or is not owned by this user"}
            res.status(404);
            return res.send(errorMsg);
        }
    }
});

// DELETE a Plane
app.delete('/planes/:plane_id', async (req, res) => {

    const bearerToken = req.headers.authorization;
    const checkIsValid = await checkInvalidJWT(bearerToken);
    if (checkIsValid[0]) {
        const error = {"Error": "Missing or invalid JWT"};
        res.status(401);
        return res.send(error);
    }

    try {
        const planeId = parseInt(req.params.plane_id);
        const dataKey = datastore.key(['planes', planeId]);
        const [thisPlane] = await datastore.get(dataKey);
        const thisJwtOwner = checkIsValid[1];

        if (thisJwtOwner !== thisPlane.owner) { throw error(); }
        if (thisPlane === undefined) { throw new error('error'); }

        await datastore.delete(dataKey);
        res.status(204);
        res.send();
    }
    catch {
        const error = {"Error":  "No plane with this plane_id exists or it is owned by someone else"};
        res.status(404);
        return res.send(error);
    }
});


// GET All Fares
app.get('/fares', async (req, res) => {
    const accept = req.headers.accept;

    if (accept !== 'application/json') {
        res.status(406);
        return res.send({"Error" : "Invalid Conent Type - please specify 'application/json'"})
    }

    try {
        const kind = 'fares';
        const pageCursor = req.query.cursor;
        let query = datastore.createQuery(kind).limit(5);
        if (pageCursor) {
            query = query.start(pageCursor)
        }

        const results = await datastore.runQuery(query);
        const allFares = results[0];
        const cursorInfo = results[1];

        const outputFares = [];
        allFares.forEach(thisFare => {
            outputFares.push({
                id: thisFare[Datastore.KEY]['id'],
                age: thisFare.age,
                fare: thisFare.fare,
                flymilesNumber: thisFare.flymilesNumber,
                name: thisFare.name,
                plane: thisFare.plane,
                self: BASEURL + 'fares/' + thisFare[Datastore.KEY]['id']
            })
        });
        
        const response = {fares: outputFares};
        if (cursorInfo.moreResults === 'NO_MORE_RESULTS') {
            response['next'] = null;
        } else {
            // https://stackoverflow.com/questions/67260882/using-datastores-pagination-example-causes-error-13-internal-request-messag
            // Answer by Ralemos solved the cursor containint URL protected characters
            response['next'] = BASEURL + 'fares/?cursor=' + encodeURIComponent(cursorInfo.endCursor)
        }

        res.status(200);
        res.send(response);
    } 
    catch (error) {
        console.log(error);
        res.status(404);
        res.send({"Error": "An error has occured, ensure you sent a valid cursor"})
    }
});

// GET One Fares
app.get('/fares/:fare_id', async (req, res) => {
    const accept = req.headers.accept;
    const bearerToken = req.headers.authorization;
    if (accept !== 'application/json') {
        res.status(406);
        return res.send({"Error" : "Invalid Conent Type - please specify 'application/json'"})
    }
    
    try {
        const thisId = parseInt(req.params.fare_id);
        const dataKey = datastore.key(['fares', thisId])
        const [thisFare] = await datastore.get(dataKey);

        const response = {
            id: thisId,
            age: thisFare.age,
            fare: thisFare.fare,
            flymilesNumber: thisFare.flymilesNumber,
            name: thisFare.name,
            plane: thisFare.plane,
            self: BASEURL + 'fares/' + thisId
        }
        res.status(200);
        return res.send(response);
    }
    catch {
        const error = {"Error":  "No fare with this fare_id exists"};
        res.status(404);
        return res.send(error);
    }
});

// POST a Fares
app.post('/fares', async (req, res) => {
    const newKey = datastore.key('fares');
    const reqAge = req.body.age;
    const reqFare = req.body.fare;
    const reqFlyerNum = req.body.flymilesNumber;
    const reqName = req.body.name;
  
    if (reqAge === undefined || reqFare === undefined || reqFlyerNum === undefined || reqName === undefined) {
        const error = {"Error":  "The request object is missing at least one of the required attributes"}
        res.status(400);
        return res.send(error);
    } else {
        const newEntry = {
            key: newKey,
            data: {
                age: thisFare.age,
                fare: thisFare.fare,
                flymilesNumber: thisFare.flymilesNumber,
                name: thisFare.name,
                plane: null
            }
        }
        const response = await datastore.save(newEntry);
        const newId = parseInt(response[0]['mutationResults'][0]['key']['path'][0]['id']);
        const newEntryRes = {
            id: newId,
            age: reqAge,
            fare: reqFare,
            flymilesNumber: reqFlyerNum,
            name: reqName,
            plane: null,
            self: BASEURL + 'fares/' + newId
        }
        res.status(201);
        return res.send(newEntryRes);
    }
  });

// PUT a Fares
app.put('/fares/:fare_id', async (req, res) => {
    const accept = req.headers.accept;
    const contentType = req.headers['content-type'];

    if (accept !== 'application/json') {
        res.status(406);
        return res.send({"Error" : "Invalid Conent Type"})
    }

    if (contentType !== 'application/json') {
        res.status(415);
        return res.send({"Error" : "Invalid Content-Type sent, must be application/json"});
    }

    let reqAge = req.body.age;
    let reqFare = req.body.fare;
    let reqFlyerNum = req.body.flymilesNumber;
    let reqName = req.body.name;
    let reqPlane = req.body.plane;

    if (!planeExists(reqPlane)) {
        const error = {"Error":  "No plane with this plane_id exists"};
        res.status(404);
        return res.send(error);
    }

    if (reqAge === undefined && reqFare === undefined && reqFlyerNum === undefined && reqName === undefined && reqPlane === undefined) {
        const error = {"Error":  "The request object is missing at least one of the required attributes"}
        res.status(400);
        return res.send(error);
    } else {
        try {
            const thisId = parseInt(req.params.fare_id);
            const dataKey = datastore.key(['fares', thisId]);
            const [thisFare] = await datastore.get(dataKey);
        
            if (reqAge === undefined) {reqAge = null};
            if (reqFare === undefined) {reqFare = null};
            if (reqFlyerNum === undefined) {reqFlyerNum = null};
            if (reqName === undefined) {reqName = null};
            if (reqPlane === undefined) {reqPlane = null};

            const entry = {
                key: dataKey,
                data: {
                    age: thisFare.age,
                    fare: thisFare.fare,
                    flymilesNumber: thisFare.flymilesNumber,
                    name: thisFare.name,
                    plane: thisFare.plane
                }
            }
            await datastore.update(entry);

            const responseEntry = {
                id: thisId,
                age: thisFare.age,
                fare: thisFare.fare,
                flymilesNumber: thisFare.flymilesNumber,
                name: thisFare.name,
                plane: thisFare.plane,
                self: BASEURL + 'fares/' + thisId
            }

            res.status(200);
            return res.send(responseEntry);
        }
        catch (error) {
            console.log(error);
            const errorMsg = {"Error":  "No fare with this fare_id exists"};
            res.status(404);
            return res.send(errorMsg);
        }
    }
});

// Patch a Fares
app.patch('/fares/:fare_id', async (req, res) => {
    const accept = req.headers.accept;
    const contentType = req.headers['content-type'];

    if (accept !== 'application/json') {
        res.status(406);
        return res.send({"Error" : "Invalid Conent Type"})
    }

    if (contentType !== 'application/json') {
        res.status(415);
        return res.send({"Error" : "Invalid Content-Type sent, must be application/json"});
    }

    let reqAge = req.body.age;
    let reqFare = req.body.fare;
    let reqFlyerNum = req.body.flymilesNumber;
    let reqName = req.body.name;
    let reqPlane = req.body.plane;

    if (!planeExists(reqPlane)) {
        const error = {"Error":  "No plane with this plane_id exists"};
        res.status(404);
        return res.send(error);
    }

    if (reqAge === undefined && reqFare === undefined && reqFlyerNum === undefined && reqName === undefined && reqPlane === undefined) {
        const error = {"Error":  "The request object is missing at least one of the required attributes"}
        res.status(400);
        return res.send(error);
    } else {
        try {
            const thisId = parseInt(req.params.fare_id);
            const dataKey = datastore.key(['fares', thisId]);
            const [thisFare] = await datastore.get(dataKey);
        
            if (reqAge === undefined) {reqAge = thisFare.age};
            if (reqFare === undefined) {reqFare = thisFare.fare};
            if (reqFlyerNum === undefined) {reqFlyerNum = thisFare.flymilesNumber};
            if (reqName === undefined) {reqName = thisFare.name};
            if (reqPlane === undefined) {reqPlane = thisFare.plane};

            const entry = {
                key: dataKey,
                data: {
                    age: thisFare.age,
                    fare: thisFare.fare,
                    flymilesNumber: thisFare.flymilesNumber,
                    name: thisFare.name,
                    plane: thisFare.plane
                }
            }
            await datastore.update(entry);

            const responseEntry = {
                id: thisId,
                age: thisFare.age,
                fare: thisFare.fare,
                flymilesNumber: thisFare.flymilesNumber,
                name: thisFare.name,
                plane: thisFare.plane,
                self: BASEURL + 'fares/' + thisId
            }

            res.status(200);
            return res.send(responseEntry);
        }
        catch (error) {
            console.log(error);
            const errorMsg = {"Error":  "No fare with this fare_id exists"};
            res.status(404);
            return res.send(errorMsg);
        }
    }
});

// DELETE a Fares
app.delete('/fares/:fare_id', async (req, res) => {

    try {
        const fare_id = parseInt(req.params.fare_id);
        const dataKey = datastore.key(['fares', fare_id]);
        const [thisFare] = await datastore.get(dataKey);

        if (thisFare === undefined) { throw new error('error'); }

        await datastore.delete(dataKey);
        res.status(204);
        res.send();
    }
    catch {
        const errorMsg = {"Error":  "No fare with this fare_id exists"};
        res.status(404);
        return res.send(error);
    }
});


// PUT Fare onto a plane
app.put('/planes/:plane_id/fares/:fare_id', async (req, res) => {
    const accept = req.headers.accept;
    const contentType = req.headers['content-type'];

    if (accept !== 'application/json') {
        res.status(406);
        return res.send({"Error" : "Invalid Conent Type"})
    }

    if (contentType !== 'application/json') {
        res.status(415);
        return res.send({"Error" : "Invalid Content-Type sent, must be application/json"});
    }

    let reqPlane = req.body.plane;
    if (!planeExists(reqPlane)) {
        const error = {"Error":  "No plane with this plane_id exists"};
        res.status(404);
        return res.send(error);
    }

    if (reqPlane === undefined || req.params.fare_id === undefined) {
        const error = {"Error":  "The request object is missing at least one of the required attributes"}
        res.status(400);
        return res.send(error);
    } else {
        try {
            const thisId = parseInt(req.params.fare_id);
            const dataKey = datastore.key(['fares', thisId]);
            const [thisFare] = await datastore.get(dataKey);

            const entry = {
                key: dataKey,
                data: {
                    age: thisFare.age,
                    fare: thisFare.fare,
                    flymilesNumber: thisFare.flymilesNumber,
                    name: thisFare.name,
                    plane: reqPlane
                }
            }
            await datastore.update(entry);

            const responseEntry = {
                id: thisId,
                age: thisFare.age,
                fare: thisFare.fare,
                flymilesNumber: thisFare.flymilesNumber,
                name: thisFare.name,
                plane: reqPlane,
                self: BASEURL + 'fares/' + thisId
            }

            res.status(200);
            return res.send(responseEntry);
        }
        catch (error) {
            console.log(error);
            const errorMsg = {"Error":  "No fare with this fare_id exists"};
            res.status(404);
            return res.send(errorMsg);
        }
    }
});

// DELETE Fare from a Plane
app.delete('/planes/fares/:fare_id', async (req, res) => {
    const accept = req.headers.accept;
    const contentType = req.headers['content-type'];

    if (accept !== 'application/json') {
        res.status(406);
        return res.send({"Error" : "Invalid Conent Type"})
    }

    if (contentType !== 'application/json') {
        res.status(415);
        return res.send({"Error" : "Invalid Content-Type sent, must be application/json"});
    }

    if (req.params.fare_id === undefined) {
        const error = {"Error":  "The request object is missing at least one of the required attributes"}
        res.status(400);
        return res.send(error);
    } else {
        try {
            const thisId = parseInt(req.params.fare_id);
            const dataKey = datastore.key(['fares', thisId]);
            const [thisFare] = await datastore.get(dataKey);

            const entry = {
                key: dataKey,
                data: {
                    age: thisFare.age,
                    fare: thisFare.fare,
                    flymilesNumber: thisFare.flymilesNumber,
                    name: thisFare.name,
                    plane: null
                }
            }
            await datastore.update(entry);

            const responseEntry = {
                id: thisId,
                age: thisFare.age,
                fare: thisFare.fare,
                flymilesNumber: thisFare.flymilesNumber,
                name: thisFare.name,
                plane: null,
                self: BASEURL + 'fares/' + thisId
            }

            res.status(200);
            return res.send(responseEntry);
        }
        catch (error) {
            console.log(error);
            const errorMsg = {"Error":  "No fare with this fare_id exists"};
            res.status(404);
            return res.send(errorMsg);
        }
    }
});

async function planeExists(planeID) {
    try {
        const dataKey = datastore.key(['planes', planeID]);
        await datastore.get(dataKey);
        return true;
    }
    catch (error) {
        return false;
    }
}

async function checkInvalidJWT(inputJwt) {
  // Decode the JWT to check validity
  // https://www.npmjs.com/package/jwt-decode
  // Returns [isInvalid as true or false, owner name]
  try {
      const tokenComponent = inputJwt.split(" ")[1];
      const decoded = jwt_decode(tokenComponent);
      const out = [false, decoded.sub];
      return out;
  } catch (error) {
      out = [true, '']
      return out;
  }
}