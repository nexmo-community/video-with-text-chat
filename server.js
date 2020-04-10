require('dotenv').config();

const express = require("express");
const OpenTok = require("opentok");
const PouchDB = require("pouchdb-node");

const app = express();
const OT = new OpenTok(process.env.API_KEY, process.env.API_SECRET);

const sessionDb = new PouchDB("sessionDb");

sessionDb.info().then(info => console.log(info));

app.use(express.static("public"));
app.use(express.json());

app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/landing.html");
});

app.get("/session/:room", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

app.get("/messages/:room", (request, response) => {
  const roomName = request.params.room;
  sessionDb
    .get(roomName)
    .then(result => {
      response.status(200);
      response.send({
        messagesArray: result.messages
      });
    })
    .catch(error => console.log(error));
});

app.post("/session/:room", (request, response) => {
  const roomName = request.params.room;
  const streamName = request.body.username;
  const isExistingSession = checkSession(roomName);

  isExistingSession.then(sessionExists => {
    if (sessionExists) {
      sessionDb
        .get(roomName)
        .then(sessionInfo => {
          generateToken(roomName, streamName, sessionInfo, response);
        })
        .catch(error => error);
    } else {
      OT.createSession((error, session) => {
        if (error) {
          console.log("Error creating session:", error);
        } else {
          const sessionInfo = {
            _id: roomName,
            sessionId: session.sessionId,
            messages: []
          };
          sessionDb.put(sessionInfo);
          generateToken(roomName, streamName, sessionInfo, response);
        }
      });
    }
  });
});

app.post("/message", (request, response) => {
  const roomName = request.body.roomName;
  const message = {
    timeStamp: request.body._id,
    content: request.body.content,
    user: request.body.user
  };
  sessionDb
    .get(roomName)
    .then(result => {
      result.messages = [...result.messages, message];
      return sessionDb.put(result);
    })
    .then(() => {
      return sessionDb.get(roomName);
    })
    .then(result => {
      response.status(200);
      response.send({
        latestMessage: result.messages[result.messages.length - 1]
      });
    })
    .catch(error => console.log(error));
});

function checkSession(roomName) {
  return sessionDb
    .get(roomName)
    .then(() => {
      console.log(roomName + "exists");
      return Promise.resolve(true);
    })
    .catch(() => {
      console.log("Room does not exist");
      return Promise.resolve(false);
    });
}

function generateToken(roomName, streamName, sessionInfo, response) {
  const tokenOptions = {
    role: "publisher",
    data: `roomname=${roomName}?streamname=${streamName}`
  };
  let token = OT.generateToken(sessionInfo.sessionId, tokenOptions);
  response.status(200);
  response.send({
    sessionId: sessionInfo.sessionId,
    token: token,
    apiKey: process.env.API_KEY,
    streamName: streamName
  });
}

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});