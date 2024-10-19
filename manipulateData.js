const fs = require('fs');
const fsPromises = fs.promises;
const fsp = require('fs').promises;
const https = require('https');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const inputFile = './mergedData.json';
const dataFile = './manipulatedData.json';

let compiledData = {};
let idCount = 0;
let startTime = 0;
let stopTime = 0;

const muteBefore = 1727782100;
const muteAfter = 1727786470;
const alignToMidpoint = 5 * Math.round(1727784000/5); // 01-10-2024 12:00:00

(async () => {
  
  fs.readFile(inputFile, 'utf8', (err, data) => {
	  if (err) {
		console.error(`Error reading file ${inputFile}:`, err);
		return reject(err);
	  }

	  const jsonData = JSON.parse(data);
	  
	  /*compiledData['source'] = jsonData['source'];
	  compiledData['time'] = jsonData['time'];
	  compiledData['geobox_corners'] = jsonData['geobox_corners'];
	  compiledData['geobox_size_km'] = jsonData['geobox_size_km'];
	  compiledData['hex_count'] = jsonData['hex_count'];*/
  
	  for (const [key, value] of Object.entries(jsonData)) {
		  
		let isNotSource = key != 'source';
		let isNotTime = key != 'time';
		let isNotGeoCorners = key != 'geobox_corners';
		let isNotGeoSize = key != 'geobox_size_km';
		let isNotHexCount = key != 'hex_count';
		
		let isFlight = isNotSource && isNotTime && isNotGeoCorners && isNotGeoSize && isNotHexCount;
		
		if(isFlight) {
			compiledData[key] = jsonData[key];
			compiledData[key]['datapoints'] = manipulateDatapoints(jsonData[key]['datapoints']);
			if(compiledData[key]['datapoints'].length == 0) {
					delete compiledData[key];
			}
		}
	  }
	  
	  writeDataFile();

	});
  

})();

function manipulateDatapoints(datapoints) {
	
	// calculate offset
	let firstDatapoint = 0;
	let lastDatapoint = 0;
	
	let consequtiveFlag = false;
	let consequtiveCounter = 0;
	let consequtiveStart = 0;
	let consequtiveStop = 0;
	let consequtiveMidpoint = 0;
	
	for(let i=0; i<datapoints.length; i++) {
		
		let datapoint = datapoints[i];
		
		if(i>0 && consequtiveCounter == 0 && !consequtiveFlag) {
			if(datapoint['now'] - datapoints[i-1]['now'] < 11) {
				consequtiveFlag = true;
				consequtiveStart = datapoint['now'];
				consequtiveCounter++;
			}
		}
		
		if(i>0 && consequtiveFlag) {
			if(datapoint['now'] - datapoints[i-1]['now'] < 11) {
				consequtiveCounter++;
			} else {
				consequtiveStop = datapoint['now'];
				consequtiveFlag = false;
				let halfConsequtiveCounter = Math.round(consequtiveCounter/2);
				consequtiveMidpoint = datapoints[i-halfConsequtiveCounter]['now'];
				consequtiveMidpoint = 5 * Math.round(consequtiveMidpoint/5);
			}
		}
				
		// first
		if(datapoint['now'] < firstDatapoint || firstDatapoint == 0) {
			firstDatapoint = datapoint['now'];
		}
		
		// last
		if(datapoint['now'] > lastDatapoint) {
			lastDatapoint = datapoint['now'];
		}

	}
	
	/*if(datapoints.length != consequtiveCounter && consequtiveCounter/datapoints.length > 0.8) {
			console.log('-----------------> ' + consequtiveCounter + ' of ' + datapoints.length);
	}*/
	
	
	let midpoint = 0;
	if(consequtiveMidpoint != 0 && consequtiveCounter > 96) {
		midpoint = consequtiveMidpoint;
	} else {
		midpoint = Math.round((firstDatapoint + lastDatapoint)/2);
		midpoint = 5 * Math.round(midpoint/5);
	}
	
	let offset = alignToMidpoint - midpoint;
	
	console.log('offset ' + offset);
	
	// manipulate datapoint
	let returnData = [];
	
	for(let k=0; k<datapoints.length; k++) {
		let manipulatedDatapoint = JSON.parse(JSON.stringify(datapoints[k]));
		let offsetTime = manipulatedDatapoint['now'] + offset
		offsetTime = 5 * Math.round(offsetTime/5);
		manipulatedDatapoint['now'] = offsetTime;
		
		// get global start/stop time
		if(offsetTime < startTime || startTime ==0) {
			startTime = offsetTime;
		}
		
		if(offsetTime > stopTime) {
			stopTime = offsetTime;
		}
		
		if(offsetTime > muteBefore && offsetTime < muteAfter) {
			returnData.push(manipulatedDatapoint);
		}
		
	}
	 return returnData;
}

const writeDataFile = () => {
	
	return new Promise((resolve, reject) => {
			  
		fs.closeSync(fs.openSync(dataFile, 'w'));
		  
		  idCount = 0;
		  for (const [key, value] of Object.entries(compiledData)) {
			  idCount++;
		  }
		  compiledData['start_time'] = startTime;
		  /*compiledData['stop_time'] = stopTime;
		  compiledData['hex_count'] = idCount;*/
		  
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

