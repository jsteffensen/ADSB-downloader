const fs = require('fs');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('connected: ' + socket['id']);
  
  socket.on('disconnect', () => {
  	console.log('disconnect: ' + socket['id']);
  });
  
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });
  
});

let startTime = 1727783155;
let simTime;
let plotStore;

let counter = 0;

const loadFlightData = () => {
  return new Promise((resolve, reject) => {

    // Read the entire file content as a string
    fs.readFile('./manipulatedData.json', 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading data.json', err);
        return reject(err);
      }

      try {
        plotStore = JSON.parse(data);
		
		idCount = 0;
		for (const [key, value] of Object.entries(plotStore)) {
		  idCount++;
		}
		console.log('data loaded with ' + idCount + ' IDs.');
		
		
        simTime = startTime;
        
        
	resolve();
		
      } catch (error) {
        console.error('Error processing JSON in file', error);
        reject(error);
      }
    });
  });
};

const intervalID = setInterval(plotUpdater, 2000);

function plotUpdater() {

  let dataBurst = [];
  
  for (const [key, value] of Object.entries(plotStore)) {

	if(plotStore[key].hasOwnProperty('datapoints')) {
		let flight = JSON.parse(JSON.stringify(plotStore[key]));
		  let flightDataPoints = JSON.parse(JSON.stringify(flight['datapoints']));
		  delete flight['datapoints'];
		  
		  for(let i=0; i<flightDataPoints.length; i++) {
			if(flightDataPoints[i]['now'] == simTime) {
			  let dataPointNow = JSON.parse(JSON.stringify(flightDataPoints[i]));
			  flight = {...flight, ...dataPointNow};
			  dataBurst.push(flight);
			  break;
			}
		  }
	}
      
  }
  
  if(dataBurst.length > 0) {
  	simTime = simTime + 5;
  } else {
  	simTime = startTime;
  }
  
  console.log(simTime);
  io.emit('plots', dataBurst);
}

server.listen(3000, () => {
  console.log('listening on *:3000');
  loadFlightData();
});
