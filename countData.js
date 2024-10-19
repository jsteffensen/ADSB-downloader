const fs = require('fs');
const fsPromises = fs.promises;
const fsp = require('fs').promises;
const https = require('https');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
//const inputFile = './mergedData.json';
const inputFile = './manipulatedData.json';
const dataFile = './countData.json';

let compiledData = {};

let idCount = 0;
let startTime = 0;
let stopTime = 0;

(async () => {
  
  fs.readFile(inputFile, 'utf8', (err, data) => {
	  if (err) {
		console.error(`Error reading file ${inputFile}:`, err);
		return reject(err);
	  }

	  const jsonData = JSON.parse(data);
  
	  for (const [key, value] of Object.entries(jsonData)) {
		let isFlight = jsonData[key].hasOwnProperty('datapoints');
		
		if(isFlight) {
			for(let i=0; i<jsonData[key]['datapoints'].length; i++) {
				
				let datapoint = jsonData[key]['datapoints'][i];
				let timeKey = Math.round(datapoint['now'] / 5);
				timeKey = '' + Math.round(timeKey * 5);
				
				if(compiledData.hasOwnProperty(timeKey)) {
					compiledData[timeKey] = compiledData[timeKey] +1;
				} else {
					compiledData[timeKey] = 1;
				}
			}
		}
	  }
	  
	  writeDataFile();

	});
  

})();

const writeDataFile = () => {
	return new Promise((resolve, reject) => {
			  
		fs.closeSync(fs.openSync(dataFile, 'w'));

		compiledData['start_time'] = startTime;
		compiledData['stop_time'] = stopTime;
		compiledData['hex_count'] = idCount;

		fs.appendFile(dataFile, JSON.stringify(compiledData, null, 2), (err) => {
			if (err) {
				console.error(`Error writing to ${dataFile}:`, err);
				return reject(err);
			}
			let dataLength = JSON.stringify(compiledData).length;
			console.log('Manipulated data written. ' + idCount + ' IDs, Size: ' + dataLength);
			resolve();
		});
	});
	
};

