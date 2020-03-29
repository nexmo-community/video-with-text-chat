require('dotenv').config();

const express = require("express");
const OpenTok = require("opentok");
const PouchDB = require("pouchdb-node");

const app = express();
const OT = new OpenTok(process.env.API_KEY, process.env.API_SECRET);

/* To replace with actual DB when things work properly */
const chatDb = new PouchDB("chatDb");

app.use(express.static("public"));
app.use(express.json());

app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/landing.html");
});

app.get("/session/:name", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

app.post("/session/:name", (request, response) => {
  const roomName = request.params.name;
  const streamName = request.body.username;
  const isExistingSession = checkSession(roomName);

  isExistingSession.then(function(sessionExists) {
    if (sessionExists) {
      chatDb
        .get(roomName)
        .then(function(sessionInfo) {
          generateToken(roomName, streamName, sessionInfo, response);
        })
        .catch(function(error) {
          return error;
        });
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
          chatDb.put(sessionInfo);
          generateToken(roomName, streamName, sessionInfo, response);
        }
      });
    }
  });
});

app.get("/messages/:name", (request, response) => {
  const roomName = request.params.name;
  chatDb
    .get(roomName)
    .then(function(result) {
      response.status(200);
      response.send({
        messagesArray: result.messages
      });
    })
    .catch(function(err) {
      console.log(err);
    });
});

app.post("/message", (request, response) => {
  const roomName = request.body.roomname;
  const message = {
    timeStamp: request.body._id,
    content: request.body.content,
    user: request.body.user
  };
  chatDb
    .get(roomName)
    .then(function(result) {
      result.messages = [...result.messages, message];
      return chatDb.put(result);
    })
    .then(function() {
      return chatDb.get(roomName);
    })
    .then(function(result) {
      console.log(result.messages);
      response.status(200);
      response.send({
        latestMessage: result.messages[result.messages.length - 1]
      });
    })
    .catch(function(err) {
      console.log(err);
    });
});

function checkSession(roomName) {
  return chatDb
    .get(roomName)
    .then(function() {
      console.log("Room exists");
      return Promise.resolve(true);
    })
    .catch(function() {
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
