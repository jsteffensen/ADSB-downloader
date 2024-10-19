const fs = require('fs');
//TODO:
const fsPromises = fs.promises;
const fsp = require('fs').promises;

const JSONStream = require('JSONStream');
const https = require('https');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const dataFile = './mergedData.json';

let compiledData = {};
let idCount = 0;
let writeCount = 0;

let filesToMerge = 24;


(async () => {
  
  for(let i=0; i<filesToMerge; i++) {
	  let file = '' + i + '.json';
	  let inputFile = path.join(dataDir, file);

	// Read the entire file content as a string
	await fs.readFile(inputFile, 'utf8', (err, data) => {
	  if (err) {
		console.error(`Error reading file ${inputFile}:`, err);
		return reject(err);
	  }

	  return parseJsonAndMerge(data);

	});
	  
  }
  

})();


function parseJsonAndMerge(jsonString) {
    try {
        const jsonData = JSON.parse(jsonString);

		for (const [key, value] of Object.entries(jsonData)) {
			
			if(!compiledData.hasOwnProperty(key)) {
				compiledData[key] = jsonData[key];
			} else {
				for(let i=0; i<jsonData[key]['datapoints'].length; i++) {
					compiledData[key]['datapoints'].push(jsonData[key]['datapoints'][i]);
				}
			}
		}
		
		writeDataFile();

    } catch (error) {
        console.error("Error parsing JSON data: ", error);
        return null;
    }
}

const writeDataFile = () => {
	
	writeCount++;
	
	//if(writeCount == filesToMerge) {
	if(writeCount == 24) {
	  return new Promise((resolve, reject) => {
		  
		  fs.closeSync(fs.openSync(dataFile, 'w'));
		  
		  // remove flights with few datapoints
		  for (const [key, value] of Object.entries(compiledData)) {
			  if(compiledData[key].hasOwnProperty('datapoints')) {
				  if(compiledData[key]['datapoints'].length < 96) {
					  console.log('remove ' + key);
					  delete compiledData[key];
				  }
			  }
		  }
		  
		  // count hex IDs
		  idCount = 0;
		  for (const [key, value] of Object.entries(compiledData)) {
			  idCount++;
		  }
		  
					  
			let jsonStream = JSONStream.stringifyObject();
			let outputStream = fs.createWriteStream(dataFile);
			jsonStream.pipe(outputStream);
			Object.entries(compiledData).forEach(([key, value]) => {
				jsonStream.write([key, value]); // Write key-value pairs
			});
			jsonStream.end();

			outputStream.on('finish', () => {
				console.log('Merged data written.');
			});
		  
		  
			/* old
			fs.appendFile(dataFile, JSON.stringify(compiledData, null, 2), (err) => {
				if (err) {
					console.error(`Error writing to ${dataFile}:`, err);
					return reject(err);
				}

				console.log(writeCount + '-> Merged data written. ' + idCount + ' IDs, Size: ' + dataLength);
				resolve();
			});*/
	  });	
	}
	
};

